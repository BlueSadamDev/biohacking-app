// Liens observés (lot 3, cahier des charges section 4 F4). Calcul pur, local, sur 90 jours.
//
// Méthode (simple et explicable) : pour chaque paire de la liste fixe ci-dessous, on range les jours
// en deux groupes (situation étudiée / situation de référence) et on compare la moyenne du résultat.
// - Force du lien : écart des deux moyennes ÷ écart-type commun (« d de Cohen ») ;
//   faible dès 0,3, modéré dès 0,5, fort dès 0,8 (settings.ts). En dessous : non affiché.
// - Assez de données : au moins 20 jours comparables, dont au moins 5 dans chaque groupe.
// - Régularité : l'écart va dans le même sens dans la première et la seconde moitié de la période.
// - Sens : « favorable » si la situation étudiée donne un meilleur résultat que la référence
//   (HRV plus haute, sommeil plus long, récupération plus haute).
// Un lien observé n'est pas une preuve de cause : l'écran le rappelle.

import { bedtimeMinutes } from './alerts';
import type { DailyWeight } from './daily';
import { addDays, dayKey } from './dates';
import type { ExerciseSession } from './load';
import type { NightValue } from './nightly';
import type { DayNutrition } from './nutrition';
import { averageWeight, proteinTargetGrams } from './profile';
import { computeRecovery } from './recovery';
import { SETTINGS, type Settings } from './settings';

export type Observation = { date: string; study: boolean; value: number };
export type ValueKind = 'ms' | 'minutes' | 'score';

export type CorrelationInputs = {
  nights: NightValue[];
  sessions: ExerciseSession[];
  /** Charge (TRIMP) par jour ; null si le profil cardiaque est incomplet. */
  dailyLoad: Map<string, number> | null;
  steps: Map<string, number>;
  nutrition: Map<string, DayNutrition>;
  weights: Map<string, DailyWeight>;
  proteinGPerKg: number;
  today: string;
};

type Context = CorrelationInputs & {
  settings: Settings;
  nightByDate: Map<string, NightValue>;
  /** Jours de la période (du plus ancien à aujourd'hui). */
  days: string[];
};

type PairResult = { observations: Observation[]; studyLabel: string; refLabel: string; detail?: string };

type Pair = {
  id: string;
  kind: ValueKind;
  observe: (ctx: Context) => PairResult;
  /** Phrase : `higher` = la situation étudiée donne un résultat plus haut. */
  sentence: (higher: boolean, pct: number, detail?: string) => string;
  action: (favorable: boolean) => string;
};

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const hm = (minutesFrom18h: number) => {
  const total = (Math.round(minutesFrom18h) + 18 * 60) % 1440;
  return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, '0')}`;
};

/** Liste fixe des paires testées. */
export const PAIRS: readonly Pair[] = [
  {
    id: 'late-session-hrv',
    kind: 'ms',
    observe: (ctx) => {
      const hour = ctx.settings.correlations.lateSessionHour;
      const observations: Observation[] = [];
      for (const day of ctx.days) {
        const sessions = ctx.sessions.filter((s) => dayKey(s.start) === day);
        const hrv = ctx.nightByDate.get(addDays(day, 1))?.hrvMs;
        if (sessions.length === 0 || hrv == null) continue;
        observations.push({ date: day, study: sessions.some((s) => new Date(s.start).getHours() >= hour), value: hrv });
      }
      return { observations, studyLabel: `Séance après ${hour} h`, refLabel: `Séance avant ${hour} h` };
    },
    sentence: (higher, pct) =>
      `Les soirs de séance après ${SETTINGS.correlations.lateSessionHour} h, ta HRV de la nuit est ${higher ? 'supérieure' : 'inférieure'} de ${pct} % en moyenne.`,
    action: (fav) =>
      fav ? 'Tes séances du soir ne pèsent pas sur ta nuit : garde ce rythme.' : 'Quand c’est possible, place tes séances intenses avant 20 h.',
  },
  {
    id: 'bedtime-sleep',
    kind: 'minutes',
    observe: (ctx) => {
      const nights = ctx.days.map((d) => ctx.nightByDate.get(d)).filter((n): n is NightValue => !!n);
      if (nights.length === 0) return { observations: [], studyLabel: '', refLabel: '' };
      const cut = median(nights.map((n) => bedtimeMinutes(n.sleep.start)));
      return {
        observations: nights.map((n) => ({ date: n.date, study: bedtimeMinutes(n.sleep.start) > cut, value: n.asleepMinutes })),
        studyLabel: `Coucher après ${hm(cut)}`,
        refLabel: `Coucher avant ${hm(cut)}`,
        detail: hm(cut),
      };
    },
    sentence: (higher, pct, cut) => `Quand tu te couches après ${cut}, tu dors ${pct} % de ${higher ? 'plus' : 'moins'} en moyenne.`,
    action: (fav) =>
      fav ? 'Tes couchers tardifs n’écourtent pas ta nuit : garde des horaires réguliers.' : 'Vise un coucher avant cette heure pour allonger tes nuits.',
  },
  {
    id: 'protein-recovery',
    kind: 'score',
    observe: (ctx) => {
      const observations: Observation[] = [];
      for (const day of ctx.days) {
        const protein = ctx.nutrition.get(day)?.proteinG;
        const target = proteinTargetGrams(ctx.proteinGPerKg, averageWeight(ctx.weights, day, ctx.settings));
        const next = addDays(day, 1);
        if (protein == null || target === null || next > ctx.today) continue;
        const score = computeRecovery(ctx.nights, next, ctx.settings).score;
        if (score === null) continue;
        observations.push({ date: day, study: protein >= ctx.settings.nutrition.reachedFraction * target, value: score });
      }
      return { observations, studyLabel: 'Protéines atteintes', refLabel: 'Protéines sous la cible' };
    },
    sentence: (higher, pct) =>
      `Les lendemains de protéines atteintes, ton score de récupération est ${higher ? 'supérieur' : 'inférieur'} de ${pct} % en moyenne.`,
    action: (fav) =>
      fav ? 'Garde tes protéines à la cible chaque jour, surtout les jours de séance.' : 'Atteindre tes protéines ne suffit pas : regarde aussi ton sommeil et ta charge.',
  },
  {
    id: 'load-hrv',
    kind: 'ms',
    observe: (ctx) => {
      if (!ctx.dailyLoad) return { observations: [], studyLabel: '', refLabel: '' };
      const rows = ctx.days
        .map((day) => ({ day, load: ctx.dailyLoad!.get(addDays(day, -1)) ?? 0, hrv: ctx.nightByDate.get(day)?.hrvMs }))
        .filter((r): r is { day: string; load: number; hrv: number } => r.hrv != null);
      if (rows.length === 0) return { observations: [], studyLabel: '', refLabel: '' };
      const cut = median(rows.map((r) => r.load));
      return {
        observations: rows.map((r) => ({ date: r.day, study: r.load > cut, value: r.hrv })),
        studyLabel: 'Veille chargée',
        refLabel: 'Veille légère',
      };
    },
    sentence: (higher, pct) => `Après une journée chargée, ta HRV est ${higher ? 'supérieure' : 'inférieure'} de ${pct} % en moyenne.`,
    action: (fav) =>
      fav ? 'Tu absorbes bien tes grosses journées : continue à bien dormir après.' : 'Après une grosse séance, prévois une journée plus légère et un coucher tôt.',
  },
  {
    id: 'steps-sleep',
    kind: 'minutes',
    observe: (ctx) => {
      const rows = ctx.days
        .map((day) => ({ day, steps: ctx.steps.get(day), sleep: ctx.nightByDate.get(addDays(day, 1))?.asleepMinutes }))
        .filter((r): r is { day: string; steps: number; sleep: number } => !!r.steps && r.sleep != null);
      if (rows.length === 0) return { observations: [], studyLabel: '', refLabel: '' };
      const cut = median(rows.map((r) => r.steps));
      const rounded = `${Math.round(cut / 500) * 500}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      return {
        observations: rows.map((r) => ({ date: r.day, study: r.steps > cut, value: r.sleep })),
        studyLabel: `Plus de ${rounded} pas`,
        refLabel: `Moins de ${rounded} pas`,
        detail: rounded,
      };
    },
    sentence: (higher, pct, cut) => `Les jours à plus de ${cut} pas, tu dors ${pct} % de ${higher ? 'plus' : 'moins'} la nuit suivante.`,
    action: (fav) =>
      fav ? 'Bouger dans la journée t’aide à dormir : garde tes marches.' : 'Les journées très actives écourtent ta nuit : avance un peu ton coucher ces jours-là.',
  },
];

export type Strength = 'strong' | 'moderate' | 'weak';

export type Link = {
  id: string;
  strength: Strength;
  favorable: boolean;
  /** Jours comparés. */
  days: number;
  /** d de Cohen (signé : > 0 si la situation étudiée donne un résultat plus haut). */
  effect: number;
  sentence: string;
  action: string;
  kind: ValueKind;
  study: { label: string; mean: number; count: number };
  reference: { label: string; mean: number; count: number };
};

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

/** Écart-type commun des deux groupes (variances pondérées). */
function pooledSd(a: number[], b: number[]): number {
  const ss = (v: number[]) => {
    const m = mean(v);
    return v.reduce((s, x) => s + (x - m) ** 2, 0);
  };
  const dof = a.length + b.length - 2;
  return dof > 0 ? Math.sqrt((ss(a) + ss(b)) / dof) : 0;
}

/** d de Cohen : (moyenne étudiée − moyenne de référence) ÷ écart-type commun ; null si non calculable. */
export function cohenD(study: number[], reference: number[]): number | null {
  if (study.length < 2 || reference.length < 2) return null;
  const sd = pooledSd(study, reference);
  return sd === 0 ? null : (mean(study) - mean(reference)) / sd;
}

export function strengthOf(effect: number, settings: Settings = SETTINGS): Strength | null {
  const c = settings.correlations;
  const e = Math.abs(effect);
  if (e >= c.strong) return 'strong';
  if (e >= c.moderate) return 'moderate';
  if (e >= c.weak) return 'weak';
  return null;
}

/** Même sens dans la 1re et la 2e moitié de la période (assez de jours par groupe dans chaque moitié) ? */
export function isRegular(observations: Observation[], overallSign: number, settings: Settings = SETTINGS): boolean {
  const sorted = [...observations].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const half = Math.floor(sorted.length / 2);
  return [sorted.slice(0, half), sorted.slice(half)].every((part) => {
    const s = part.filter((o) => o.study).map((o) => o.value);
    const r = part.filter((o) => !o.study).map((o) => o.value);
    const min = settings.correlations.minPerGroupPerHalf;
    if (s.length < min || r.length < min) return false;
    return Math.sign(mean(s) - mean(r)) === overallSign;
  });
}

export type PairStatus = 'shown' | 'not-enough-days' | 'too-weak' | 'irregular';

/** Évalue une paire à partir de ses observations ; renvoie le lien s'il est affichable, sinon la raison. */
export function evaluatePair(
  pair: Pick<Pair, 'id' | 'kind' | 'sentence' | 'action'>,
  result: PairResult,
  settings: Settings = SETTINGS,
): { status: PairStatus; link: Link | null } {
  const c = settings.correlations;
  const study = result.observations.filter((o) => o.study).map((o) => o.value);
  const reference = result.observations.filter((o) => !o.study).map((o) => o.value);
  if (result.observations.length < c.minDays || study.length < c.minPerGroup || reference.length < c.minPerGroup) {
    return { status: 'not-enough-days', link: null };
  }
  const effect = cohenD(study, reference);
  const strength = effect === null ? null : strengthOf(effect, settings);
  if (effect === null || strength === null) return { status: 'too-weak', link: null };
  if (!isRegular(result.observations, Math.sign(effect), settings)) return { status: 'irregular', link: null };

  const ms = mean(study);
  const mr = mean(reference);
  const higher = ms > mr;
  const pct = mr === 0 ? 0 : Math.round((Math.abs(ms - mr) / Math.abs(mr)) * 100);
  return {
    status: 'shown',
    link: {
      id: pair.id,
      strength,
      favorable: higher,
      days: result.observations.length,
      effect,
      sentence: pair.sentence(higher, pct, result.detail),
      action: pair.action(higher),
      kind: pair.kind,
      study: { label: result.studyLabel, mean: ms, count: study.length },
      reference: { label: result.refLabel, mean: mr, count: reference.length },
    },
  };
}

export type CorrelationReport = {
  /** Liens affichés, du plus fort au plus faible (au plus `maxShown`). */
  links: Link[];
  /** Raison par paire (pour comprendre pourquoi rien ne s'affiche). */
  statuses: Record<string, PairStatus>;
};

/** Teste toutes les paires sur les 90 derniers jours. */
export function findLinks(input: CorrelationInputs, settings: Settings = SETTINGS): CorrelationReport {
  const c = settings.correlations;
  const ctx: Context = {
    ...input,
    settings,
    nightByDate: new Map(input.nights.map((n) => [n.date, n])),
    days: Array.from({ length: c.windowDays }, (_, i) => addDays(input.today, -(c.windowDays - 1 - i))),
  };
  const statuses: Record<string, PairStatus> = {};
  const links: Link[] = [];
  for (const pair of PAIRS) {
    const { status, link } = evaluatePair(pair, pair.observe(ctx), settings);
    statuses[pair.id] = status;
    if (link) links.push(link);
  }
  links.sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
  return { links: links.slice(0, c.maxShown), statuses };
}
