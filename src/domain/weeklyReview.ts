// Coach IA (lot 4, étape C4) : bilan de la semaine.
// L'app décide ce qui a marché et ce qui coince (règles `coach.weekly` de settings.ts) et écrit les
// chiffres utilisés (« D'après : … ») ; le modèle écrit la phrase de synthèse et 2 actions ciblées
// sur ce qui coince, contrôlées comme tout conseil. En cas d'échec : synthèse et actions de l'app.

import { fr, type CoachContext, type CoachSection } from './coachContext';
import type { CoachTask } from './coachPrompt';
import { runCoach, type CoachModel, type CoachOutcome } from './coachRun';
import { addDays, startOfWeek } from './dates';
import { SETTINGS, type Settings, type WeeklyRule } from './settings';

export type WeeklyItem = { section: string; text: string; action: string };

export type WeeklyReview = {
  /** Lundi et dimanche de la semaine couverte. */
  weekStart: string;
  weekEnd: string;
  synthesis: string;
  actions: string[];
  worked: string[];
  stuck: string[];
  /** Chiffres utilisés, écrits par l'app (« D'après : … »). */
  facts: string[];
  /** 'model' : synthèse et actions écrites par le modèle (contrôlées) ; 'app' : repli de l'app. */
  source: 'model' | 'app';
  createdMs: number;
};

/** Semaine à faire : la semaine en cours le dimanche, sinon la dernière semaine terminée. */
export function weekToReview(today: string): { weekStart: string; weekEnd: string } {
  const monday = startOfWeek(today);
  const sunday = addDays(monday, 6);
  if (today === sunday) return { weekStart: monday, weekEnd: sunday };
  return { weekStart: addDays(monday, -7), weekEnd: addDays(monday, -1) };
}

/** Un bilan est dû s'il n'existe pas encore pour la semaine à faire. */
export function isReviewDue(today: string, latestWeekStart: string | null): boolean {
  return latestWeekStart === null || latestWeekStart < weekToReview(today).weekStart;
}

function matches(rule: WeeklyRule, section: CoachSection | undefined): boolean {
  if (!section?.available) return false;
  const v = section.values[rule.field];
  if (v === undefined || v === null) return false;
  switch (rule.op) {
    case 'eq':
      return v === rule.value;
    case 'in':
      return Array.isArray(rule.value) && rule.value.includes(v as string | number | boolean);
    case 'gt':
      return typeof v === 'number' && v > (rule.value as number);
    case 'lte':
      return typeof v === 'number' && v <= (rule.value as number);
  }
}

/** Ce qui a marché et ce qui coince, d'après les verdicts du résumé (une règle par rubrique et valeur). */
export function weekStatus(context: CoachContext, settings: Settings = SETTINGS): { worked: WeeklyItem[]; stuck: WeeklyItem[] } {
  const w = settings.coach.weekly;
  const seen = new Set<string>();
  const worked: WeeklyItem[] = [];
  const stuck: WeeklyItem[] = [];
  for (const rule of w.rules) {
    const key = `${rule.section}.${rule.field}`;
    if (seen.has(key)) continue;
    if (!matches(rule, context.sections.find((s) => s.key === rule.section))) continue;
    seen.add(key);
    const item = { section: rule.section, text: rule.text, action: rule.action };
    (rule.kind === 'worked' ? worked : stuck).push(item);
  }
  return { worked: worked.slice(0, w.maxItems), stuck: stuck.slice(0, w.maxItems) };
}

/** Chiffre court d'une rubrique, pour « D'après : … » (écrit par l'app, depuis les valeurs du résumé). */
function shortFact(s: CoachSection): string | null {
  const v = s.values;
  switch (s.key) {
    case 'sleep':
      return typeof v.hours7d === 'number' ? `sommeil ${fr(v.hours7d)} h par nuit` : null;
    case 'hrv':
      return typeof v.ms7d === 'number' ? `HRV ${v.ms7d} ms` : null;
    case 'recovery':
      return typeof v.mean7d === 'number' ? `récupération ${v.mean7d} sur 100 en moyenne` : null;
    case 'load':
      return typeof v.ratio === 'number' ? `charge ${fr(v.ratio, 2)}` : null;
    case 'zone2':
      return typeof v.zone2Minutes === 'number' ? `zone 2 : ${v.zone2Minutes} min pour ${v.zone2Target} visées` : null;
    case 'nutrition': {
      if (typeof v.proteinDaysBelow7d !== 'number' || typeof v.proteinDaysKnown7d !== 'number') return null;
      const reached = v.proteinDaysKnown7d - v.proteinDaysBelow7d;
      return `protéines dans la cible ${reached} jour${reached > 1 ? 's' : ''} sur ${v.proteinDaysKnown7d} avec repas`;
    }
    case 'strength': {
      const parts = (['squat', 'bench', 'deadlift'] as const)
        .filter((e) => typeof v[`${e}Kg`] === 'number')
        .map((e) => `${{ squat: 'squat', bench: 'développé couché', deadlift: 'soulevé de terre' }[e]} ${v[`${e}Kg`]} kg`);
      return parts.length ? parts.join(', ') : null;
    }
    default:
      return null;
  }
}

/** Chiffres utilisés : ceux des rubriques citées dans ce qui a marché ou ce qui coince. */
export function weeklyFacts(context: CoachContext, items: WeeklyItem[]): string[] {
  const keys = [...new Set(items.map((i) => i.section))];
  return keys
    .map((k) => context.sections.find((s) => s.key === k))
    .map((s) => (s ? shortFact(s) : null))
    .filter((f): f is string => !!f);
}

const ACTION_LINE = /^\s*(\d+[.)]|action\s*n°?\s*\d+\s*:?)\s*/i;

/**
 * Sépare le conseil du modèle en synthèse et actions numérotées. Synthèse : les premières phrases
 * hors actions (au plus `weeklySynthesisSentences`), sans les phrases d'annonce (« Voici… », « … : »).
 */
export function parseWeeklyAnswer(text: string, settings: Settings = SETTINGS): { synthesis: string; actions: string[] } {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const actions = lines.filter((l) => ACTION_LINE.test(l)).map((l) => l.replace(ACTION_LINE, '').trim());
  const prose = lines.filter((l) => !ACTION_LINE.test(l) && !/^voici\b/i.test(l)).join(' ');
  // Phrases (terminées par . ! ? ou :) ; les phrases d'annonce finissent par « : ».
  const sentences = (prose.match(/[^.!?:]+[.!?:]+/g) ?? []).map((s) => s.trim()).filter((s) => !s.endsWith(':'));
  const synthesis = sentences.slice(0, settings.coach.generation.weeklySynthesisSentences).join(' ');
  return { synthesis, actions };
}

/** Première lettre en minuscule, sauf sigle (« HRV »). */
function lowerFirst(text: string): string {
  return /^[A-ZÀ-Ý]{2}/.test(text) ? text : text.charAt(0).toLowerCase() + text.slice(1);
}

/** « a », « a et b », « a, b et c ». */
function joinFr(items: string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

/**
 * Repli écrit par l'app : deux phrases (ce qui a marché, ce qui coince) et deux actions
 * (corriger ce qui coince d'abord, puis garder ce qui a marché).
 */
export function fallbackWeekly(worked: WeeklyItem[], stuck: WeeklyItem[], settings: Settings = SETTINGS): { synthesis: string; actions: string[] } {
  const max = settings.coach.generation.weeklyMaxActions;
  const good = joinFr(worked.map((w) => lowerFirst(w.text)));
  const bad = joinFr(stuck.map((s) => lowerFirst(s.text)));
  const goodLine = `${worked.length > 1 ? 'Bons points' : 'Bon point'} de la semaine : ${good}.`;
  let synthesis: string;
  if (worked.length && stuck.length) synthesis = `${goodLine} À travailler : ${bad}.`;
  else if (stuck.length) synthesis = `Semaine à ajuster : ${bad}. Concentre-toi sur ${stuck.length > 1 ? 'ces points' : 'ce point'} la semaine prochaine.`;
  else if (worked.length) synthesis = `${goodLine} Rien ne coince d’après tes chiffres.`;
  else synthesis = 'Pas assez de données cette semaine pour un bilan détaillé.';
  const actions = [...stuck, ...worked].map((i) => i.action).filter(Boolean).slice(0, max);
  return { synthesis, actions: actions.length ? actions : ['Garde ton rythme actuel la semaine prochaine.'] };
}

/** Rédige le bilan de la semaine `week` à partir du résumé (construit pour le dimanche de cette semaine). */
export async function runWeeklyReview(
  model: CoachModel,
  context: CoachContext,
  week: { weekStart: string; weekEnd: string },
  onText: (text: string) => void = () => undefined,
  nowMs: number = Date.now(),
  settings: Settings = SETTINGS,
): Promise<{ review: WeeklyReview; outcome: CoachOutcome }> {
  const { worked, stuck } = weekStatus(context, settings);
  const task: CoachTask = {
    kind: 'weekly',
    worked: worked.map((w) => w.text),
    stuck: stuck.map((s) => s.text),
    sections: [...new Set([...stuck, ...worked].map((i) => i.section))],
  };
  const outcome = await runCoach(model, context, task, onText, settings);
  const parsed = outcome.kind === 'answer' ? parseWeeklyAnswer(outcome.text, settings) : null;
  const usable = parsed && parsed.synthesis && parsed.actions.length === settings.coach.generation.weeklyMaxActions;
  const content = usable ? parsed! : fallbackWeekly(worked, stuck, settings);
  return {
    outcome,
    review: {
      ...week,
      synthesis: content.synthesis,
      actions: content.actions,
      worked: worked.map((w) => w.text),
      stuck: stuck.map((s) => s.text),
      facts: weeklyFacts(context, [...stuck, ...worked]),
      source: usable ? 'model' : 'app',
      createdMs: nowMs,
    },
  };
}
