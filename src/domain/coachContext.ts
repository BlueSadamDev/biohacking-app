// Coach IA (lot 4, étape C2) : résumé chiffré donné au coach. C'est sa SEULE source de chiffres.
// Le coach ne calcule rien : ce résumé reprend les résultats des calculs de l'app (récap, normes,
// charge, zones, nutrition, force, poids, alertes, liens observés) et y joint le verdict déjà
// calculé (« sous la cible », « dans ta plage normale »…), écrit en phrases courtes pour un petit
// modèle. Une donnée absente est écrite « non disponible », jamais inventée.

import type { Alert, SelectedAlert } from './alerts';
import { LEVEL_LABEL } from './alerts';
import type { BodyComposition, WeightTrend } from './bodyComposition';
import type { Link } from './correlations';
import { extractNumbers } from './coachNumbers';
import { addDays } from './dates';
import type { LoadStatus, LoadSummary } from './load';
import type { NightValue } from './nightly';
import { mean, nightsBetween, type NormPosition } from './norms';
import type { NutritionDayView } from './nutrition';
import { computeRecovery } from './recovery';
import type { MorningRecap } from './recap';
import { SETTINGS, type Settings } from './settings';
import { EXERCISE_LABEL, type ExerciseProgress, type StrengthTrend } from './strength';
import type { WeekActivity } from './zones';

/** Ce que le coach reçoit : uniquement des résultats déjà calculés par l'app. */
export type CoachInputs = {
  today: string;
  nights: NightValue[];
  recap: MorningRecap;
  load: LoadSummary | null;
  /** Nutrition d'hier (avec le compte des jours sous la cible sur 7 jours). */
  nutrition: NutritionDayView | null;
  week: (Pick<WeekActivity, 'weekStart' | 'sessions' | 'zone2Minutes' | 'zone2Target' | 'zone2Reached'> & { sessionsTarget: number }) | null;
  strength: ExerciseProgress[];
  body: Pick<BodyComposition, 'average7d' | 'trendKgPerWeek' | 'trend' | 'targetKg' | 'gapToTarget' | 'sentence'> | null;
  alerts: (Pick<Alert, 'date' | 'level' | 'title' | 'finding' | 'cause' | 'action'> & Partial<Pick<SelectedAlert, 'persistent'>>)[];
  links: Pick<Link, 'strength' | 'favorable' | 'days' | 'sentence' | 'action'>[];
};

export type SectionKey =
  | 'calibration'
  | 'recovery'
  | 'sleep'
  | 'hrv'
  | 'restingHr'
  | 'load'
  | 'zone2'
  | 'nutrition'
  | 'strength'
  | 'weight'
  | 'alerts'
  | 'links';

export type CoachSection = {
  key: SectionKey;
  title: string;
  available: boolean;
  /** Phrase(s) donnée(s) au modèle. */
  line: string;
  /** Mêmes informations en valeurs brutes (objet JSON du résumé). */
  values: Record<string, number | string | boolean | null>;
};

export type CoachContext = {
  date: string;
  calibrating: boolean;
  sections: CoachSection[];
  /** Texte complet donné au modèle. */
  text: string;
  /** Nombres que le coach a le droit d'écrire (tous ceux du texte). */
  numbers: number[];
};

const NA = 'non disponible';

/** Nombre à la française, sans zéro inutile : 6.4 → « 6,4 », 7.0 → « 7 ». */
export function fr(value: number, digits = 1): string {
  return String(Number(value.toFixed(digits))).replace('.', ',');
}

const hours = (minutes: number) => fr(minutes / 60, 1);

function trendWord(diff: number, margin: number): 'en hausse' | 'en baisse' | 'stable' {
  if (diff > margin) return 'en hausse';
  if (diff < -margin) return 'en baisse';
  return 'stable';
}

const POSITION: Record<NormPosition, string> = {
  below: 'sous ta plage normale',
  within: 'dans ta plage normale',
  above: 'au-dessus de ta plage normale',
};

const LOAD_STATUS: Record<LoadStatus, string> = {
  under: 'sous-charge',
  balanced: 'équilibrée',
  rising: 'en hausse',
  high: 'trop élevée',
};

function strengthTrend(trend: StrengthTrend, s: Settings): string {
  switch (trend) {
    case 'rising':
      return 'en hausse';
    case 'falling':
      return 'en baisse';
    case 'stagnant':
      return `stagnation, pas de record depuis ${Math.round(s.strength.stagnationDays / 7)} semaines`;
    case 'steady':
      return 'stable';
    case 'insufficient':
      return 'pas assez de séances saisies pour une tendance';
  }
}

const WEIGHT_TREND: Record<WeightTrend, string> = {
  loss: 'en baisse',
  stable: 'stable',
  'slow-gain': 'en hausse lente',
  'fast-gain': 'en hausse rapide',
};

function section(key: SectionKey, title: string, line: string | null, values: CoachSection['values'] = {}): CoachSection {
  return { key, title, available: line !== null, line: `${title} : ${line ?? NA}.`, values };
}

/** Score de récupération moyen sur les `days` derniers jours (jours calculables seulement). */
function meanScore(nights: NightValue[], today: string, days: number, settings: Settings): { mean: number | null; days: number } {
  const scores = Array.from({ length: days }, (_, i) => computeRecovery(nights, addDays(today, -i), settings).score).filter(
    (s): s is number => s !== null,
  );
  return { mean: scores.length >= settings.coach.context.minNights ? mean(scores) : null, days: scores.length };
}

function recoverySection(i: CoachInputs, s: Settings): CoachSection {
  const c = s.coach.context;
  const score = i.recap.recovery.score;
  const short = meanScore(i.nights, i.today, c.shortDays, s);
  const long = meanScore(i.nights, i.today, c.longDays, s);
  if (score === null && short.mean === null) return section('recovery', 'Récupération', null);
  const parts: string[] = [];
  if (score !== null) {
    parts.push(
      i.recap.calibration.done
        ? `score de ${score} sur 100 aujourd'hui (${i.recap.recommendation.status.toLowerCase()})`
        : `score de ${score} sur 100 aujourd'hui (calibration en cours : pas encore comparé à ta norme)`,
    );
  }
  if (short.mean !== null) parts.push(`moyenne ${Math.round(short.mean)} sur ${c.shortDays} jours`);
  if (long.mean !== null) parts.push(`moyenne ${Math.round(long.mean)} sur ${c.longDays} jours`);
  if (short.mean !== null && long.mean !== null) parts.push(trendWord(short.mean - long.mean, c.recoveryTrendPoints));
  return section('recovery', 'Récupération', parts.join(', '), {
    score,
    status: i.recap.calibration.done ? i.recap.recommendation.status : null,
    mean7d: short.mean === null ? null : Math.round(short.mean),
    mean30d: long.mean === null ? null : Math.round(long.mean),
  });
}

function sleepSection(i: CoachInputs, s: Settings): CoachSection {
  const c = s.coach.context;
  const minutesOf = (days: number) => nightsBetween(i.nights, addDays(i.today, -(days - 1)), i.today).map((n) => n.asleepMinutes);
  const short = minutesOf(c.shortDays);
  const long = minutesOf(c.longDays);
  if (short.length < c.minNights) return section('sleep', 'Sommeil', null);
  const shortMean = mean(short)!;
  const longMean = long.length >= c.minNights ? mean(long) : null;
  const shortNights = short.filter((m) => m < s.alerts.sleepShortMinutes).length;
  const parts = [`${hours(shortMean)} h par nuit en moyenne sur ${c.shortDays} jours`];
  if (longMean !== null) parts.push(`${hours(longMean)} h sur ${c.longDays} jours`);
  parts.push(
    `${shortNights} nuit${shortNights > 1 ? 's' : ''} sous ${hours(s.alerts.sleepShortMinutes)} h sur les ${short.length} dernières`,
  );
  parts.push(
    shortMean < s.recovery.sleepTargetMinutes
      ? `sous la durée visée de ${hours(s.recovery.sleepTargetMinutes)} h`
      : `durée visée de ${hours(s.recovery.sleepTargetMinutes)} h atteinte`,
  );
  if (longMean !== null) parts.push(`${trendWord(shortMean - longMean, c.sleepTrendMinutes)} par rapport à d'habitude`);
  return section('sleep', 'Sommeil', parts.join(', '), {
    hours7d: Number(hours(shortMean).replace(',', '.')),
    hours30d: longMean === null ? null : Number(hours(longMean).replace(',', '.')),
    shortNights7d: shortNights,
  });
}

function hrvSection(i: CoachInputs, s: Settings): CoachSection {
  const h = i.recap.hrv;
  if (h.shortMean === null) return section('hrv', 'HRV de la nuit', null);
  const ms = Math.round(Math.exp(h.shortMean));
  const parts = [`${ms} ms en moyenne sur ${s.norms.hrvShortWindowDays} jours`];
  const values: CoachSection['values'] = { ms7d: ms, low: null, high: null, position: null };
  // Pendant la calibration, la plage normale repose sur trop peu de nuits : ni plage ni jugement.
  if (!i.recap.calibration.done) {
    parts.push('calibration en cours : pas encore de plage normale ni de jugement');
  } else if (h.baseline) {
    const low = Math.round(Math.exp(h.baseline.low));
    const high = Math.round(Math.exp(h.baseline.high));
    parts.push(`plage normale de ${low} à ${high} ms`);
    Object.assign(values, { low, high });
    if (h.position) {
      parts.push(POSITION[h.position]);
      values.position = h.position;
    }
  }
  return section('hrv', 'HRV de la nuit', parts.join(', '), values);
}

function restingHrSection(i: CoachInputs, s: Settings): CoachSection {
  const r = i.recap.restingHr;
  if (r.tonight === null) return section('restingHr', 'FC au repos', null);
  const parts = [`${Math.round(r.tonight)} bpm cette nuit`];
  if (r.baselineMean !== null && r.delta !== null) {
    parts.push(`moyenne ${Math.round(r.baselineMean)} bpm sur ${s.norms.restingHrBaselineDays} jours`);
    const d = Math.round(r.delta);
    if (Math.abs(r.delta) < s.coach.context.restingHrUsualBpm) parts.push("comme d'habitude");
    else parts.push(`${Math.abs(d)} bpm ${d > 0 ? 'au-dessus' : 'en dessous'} de ta moyenne`);
  }
  return section('restingHr', 'FC au repos', parts.join(', '), {
    tonight: Math.round(r.tonight),
    mean30d: r.baselineMean === null ? null : Math.round(r.baselineMean),
    delta: r.delta === null ? null : Math.round(r.delta),
  });
}

function loadSection(i: CoachInputs, s: Settings): CoachSection {
  const l = i.load;
  const title = "Charge d'entraînement";
  if (!l) return section('load', title, null);
  switch (l.state) {
    case 'profile-missing':
      return section('load', title, `${NA} (sexe ou FC max à renseigner dans les Réglages)`, { state: l.state });
    case 'calibrating':
      return section('load', title, `calibration en cours (${l.days} jours sur ${l.required})`, { state: l.state });
    case 'no-load':
      return section('load', title, `aucune séance avec fréquence cardiaque sur les 7 derniers jours (${l.sessions7d} séance(s) au total)`, {
        state: l.state,
        sessions7d: l.sessions7d,
      });
    case 'ok':
      return section(
        'load',
        title,
        `ratio 7 jours / 28 jours de ${fr(l.ratio, 2)}, charge ${LOAD_STATUS[l.status]} (équilibrée entre ${fr(s.load.underMax, 2)} et ${fr(
          s.load.balancedMax,
          2,
        )}, trop élevée au-dessus de ${fr(s.load.highMin, 2)}), ${l.sessions7d} séance${l.sessions7d > 1 ? 's' : ''} sur les 7 derniers jours`,
        { ratio: Number(l.ratio.toFixed(2)), status: l.status, sessions7d: l.sessions7d },
      );
  }
}

function zone2Section(i: CoachInputs): CoachSection {
  const w = i.week;
  const title = 'Activité de la semaine';
  if (!w) return section('zone2', title, null);
  const parts = [`${w.sessions} séance${w.sessions > 1 ? 's' : ''} depuis lundi pour ${w.sessionsTarget} visées par semaine`];
  if (w.zone2Minutes === null) parts.push(`zone 2 ${NA} (FC max inconnue)`);
  else
    parts.push(
      `${Math.round(w.zone2Minutes)} min en zone 2 pour ${w.zone2Target} min visées (${w.zone2Reached ? 'cible atteinte' : 'sous la cible'})`,
    );
  return section('zone2', title, parts.join(', '), {
    sessions: w.sessions,
    sessionsTarget: w.sessionsTarget,
    zone2Minutes: w.zone2Minutes === null ? null : Math.round(w.zone2Minutes),
    zone2Target: w.zone2Target,
    zone2Reached: w.zone2Reached,
  });
}

function nutritionSection(i: CoachInputs, s: Settings): CoachSection {
  const n = i.nutrition;
  const title = 'Nutrition';
  if (!n || !n.day) return section('nutrition', title, n ? "aucun repas enregistré hier dans Suivi macro" : null);
  const parts: string[] = [];
  const p = n.protein;
  if (p.value !== null) {
    parts.push(
      p.target === null
        ? `protéines hier : ${Math.round(p.value)} g (cible ${NA})`
        : `protéines hier : ${Math.round(p.value)} g pour une cible de ${Math.round(p.target)} g (${p.reached ? 'cible atteinte' : 'sous la cible'})`,
    );
  }
  parts.push(`sous la cible de protéines ${n.proteinDaysBelow} jour${n.proteinDaysBelow > 1 ? 's' : ''} sur ${s.nutrition.weekDays}`);
  const k = n.calories;
  if (k.value !== null) {
    parts.push(
      k.target === null
        ? `calories hier : ${Math.round(k.value)} kcal (cible ${NA})`
        : `calories hier : ${Math.round(k.value)} kcal pour une cible de ${Math.round(k.target)} kcal`,
    );
  }
  return section('nutrition', title, parts.join(', '), {
    proteinG: p.value === null ? null : Math.round(p.value),
    proteinTargetG: p.target === null ? null : Math.round(p.target),
    proteinReached: p.reached,
    proteinDaysBelow7d: n.proteinDaysBelow,
    caloriesKcal: k.value === null ? null : Math.round(k.value),
    caloriesTargetKcal: k.target === null ? null : Math.round(k.target),
  });
}

function strengthSection(i: CoachInputs, s: Settings): CoachSection {
  const done = i.strength.filter((e) => e.current !== null);
  if (done.length === 0) return section('strength', 'Force (1RM estimé)', null);
  const line = done
    .map((e) => `${EXERCISE_LABEL[e.exercise].toLowerCase()} ${Math.round(e.current!)} kg (${strengthTrend(e.trend, s)})`)
    .join(', ');
  const values: CoachSection['values'] = {};
  for (const e of done) {
    values[`${e.exercise}Kg`] = Math.round(e.current!);
    values[`${e.exercise}Trend`] = e.trend;
  }
  return section('strength', 'Force (1RM estimé)', line, values);
}

function weightSection(i: CoachInputs): CoachSection {
  const b = i.body;
  if (!b || b.average7d === null) return section('weight', 'Poids', null);
  const parts = [`${fr(b.average7d, 1)} kg en moyenne sur 7 jours`];
  if (b.trendKgPerWeek !== null && b.trend) parts.push(`${WEIGHT_TREND[b.trend]} (${fr(b.trendKgPerWeek, 2)} kg par semaine)`);
  if (b.targetKg !== null && b.gapToTarget !== null) parts.push(`poids visé ${fr(b.targetKg, 1)} kg`);
  if (b.sentence) parts.push(`lecture de l'app : ${b.sentence.replace(/\.$/, '')}`);
  return section('weight', 'Poids', parts.join(', '), {
    kg7d: Number(b.average7d.toFixed(1)),
    trendKgPerWeek: b.trendKgPerWeek === null ? null : Number(b.trendKgPerWeek.toFixed(2)),
    targetKg: b.targetKg,
  });
}

function alertsSection(i: CoachInputs, s: Settings): CoachSection {
  const since = addDays(i.today, -(s.coach.context.alertDays - 1));
  const recent = i.alerts.filter((a) => a.date >= since && a.date <= i.today);
  const title = `Alertes des ${s.coach.context.alertDays} derniers jours`;
  if (recent.length === 0) return section('alerts', title, 'aucune', { count: 0 });
  const line = recent
    .map(
      (a) =>
        `« ${a.title} » (${LEVEL_LABEL[a.level]}, le ${a.date}) : constat : ${a.finding.replace(/\.$/, '')} ; cause probable : ${a.cause.replace(
          /\.$/,
          '',
        )} ; action proposée : ${a.action.replace(/\.$/, '')}${a.persistent ? ' ; cette alerte revient souvent : un avis médical peut être utile' : ''}`,
    )
    .join(' | ');
  return section('alerts', title, line, { count: recent.length });
}

function linksSection(i: CoachInputs): CoachSection {
  const title = 'Liens observés (90 derniers jours)';
  if (i.links.length === 0) return section('links', title, 'aucun lien assez régulier', { count: 0 });
  const STRENGTH: Record<Link['strength'], string> = { strong: 'fort', moderate: 'modéré', weak: 'faible' };
  const line = i.links
    .map((l) => `lien ${STRENGTH[l.strength]} (${l.days} jours comparés) : ${l.sentence.replace(/\.$/, '')} ; action : ${l.action.replace(/\.$/, '')}`)
    .join(' | ');
  return section('links', title, line, { count: i.links.length });
}

/** Construit le résumé chiffré du coach à partir des résultats de l'app. */
export function buildCoachContext(i: CoachInputs, settings: Settings = SETTINGS): CoachContext {
  const cal = i.recap.calibration;
  const sections: CoachSection[] = [
    section(
      'calibration',
      'Calibration',
      cal.done
        ? 'terminée, les comparaisons à ta norme sont fiables'
        : `en cours (${cal.nights} nuits sur ${cal.required}) : les comparaisons à ta norme ne sont pas encore fiables`,
      { nights: cal.nights, required: cal.required, done: cal.done },
    ),
    recoverySection(i, settings),
    sleepSection(i, settings),
    hrvSection(i, settings),
    restingHrSection(i, settings),
    loadSection(i, settings),
    zone2Section(i),
    nutritionSection(i, settings),
    strengthSection(i, settings),
    weightSection(i),
    alertsSection(i, settings),
    linksSection(i),
  ];
  const text = [`Résumé de mes données calculé par l'app Aube (au ${i.today}) :`, ...sections.map((s) => `- ${s.line}`)].join('\n');
  return { date: i.today, calibrating: !cal.done, sections, text, numbers: [...new Set(extractNumbers(text))] };
}
