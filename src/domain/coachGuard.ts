// Coach IA (lot 4, étape C3) : contrôle d'une réponse du modèle avant de l'afficher.
// Refusée si : nombre absent du résumé, verdict du résumé contredit, mot de diagnostic,
// renvoi vers un professionnel sans alerte qui persiste, réponse vide. Les emoji sont retirés.

import type { CoachContext } from './coachContext';
import { unknownNumbers } from './coachNumbers';
import { SETTINGS, type Settings } from './settings';

export type GuardProblem =
  | { kind: 'empty' }
  | { kind: 'unknown-number'; numbers: number[] }
  | { kind: 'contradiction'; section: string; text: string }
  | { kind: 'diagnosis'; text: string }
  | { kind: 'referral'; text: string };

export type GuardResult = { ok: boolean; text: string; problems: GuardProblem[] };

// Pictogrammes, symboles divers, dingbats, sélecteur de variante et liant d'emoji.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;

/** Retire les emoji et les espaces en trop. */
export function sanitize(text: string): string {
  return text
    .replace(EMOJI, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** Première expression trouvée hors négation (« pas assez de protéines » ne compte pas). */
function findAffirmed(text: string, patterns: readonly string[], settings: Settings): string | null {
  const negation = new RegExp(settings.coach.guard.negation);
  for (const p of patterns) {
    const re = new RegExp(p, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (!negation.test(text.slice(Math.max(0, m.index - 30), m.index))) return m[0];
    }
  }
  return null;
}

function firstMatch(text: string, patterns: readonly string[]): string | null {
  for (const p of patterns) {
    const m = new RegExp(p).exec(text);
    if (m) return m[0];
  }
  return null;
}

/** Contrôle une réponse par rapport au résumé qui l'a produite. */
export function checkAnswer(answer: string, context: CoachContext, settings: Settings = SETTINGS): GuardResult {
  const text = sanitize(answer);
  const lower = text.toLowerCase();
  const contextLower = context.text.toLowerCase();
  const g = settings.coach.guard;
  const problems: GuardProblem[] = [];

  if (text.length === 0) problems.push({ kind: 'empty' });

  const unknown = unknownNumbers(text, context.numbers);
  if (unknown.length) problems.push({ kind: 'unknown-number', numbers: unknown });

  for (const c of g.contradictions) {
    const section = context.sections.find((s) => s.key === c.section);
    if (!section || !c.when.includes(section.values[c.field] as string | number | boolean)) continue;
    const found = findAffirmed(lower, c.forbidden, settings);
    if (found) problems.push({ kind: 'contradiction', section: section.title, text: found });
  }

  // Un mot de diagnostic déjà présent dans le résumé (texte d'une alerte de l'app) est accepté.
  const diagnosis = firstMatch(lower, g.diagnosis.filter((p) => !new RegExp(p).test(contextLower)));
  if (diagnosis) problems.push({ kind: 'diagnosis', text: diagnosis });

  const alerts = context.sections.find((s) => s.key === 'alerts');
  const persistent = Number(alerts?.values.persistent ?? 0) > 0;
  if (!persistent) {
    const referral = firstMatch(lower, g.referral);
    if (referral) problems.push({ kind: 'referral', text: referral });
  }

  return { ok: problems.length === 0, text, problems };
}

/** Raison lisible d'un refus (banc d'essai, et consigne de la seconde chance). */
export function describeProblem(p: GuardProblem): string {
  switch (p.kind) {
    case 'empty':
      return 'réponse vide';
    case 'unknown-number':
      return `nombre absent du résumé (${p.numbers.join(', ')})`;
    case 'contradiction':
      return `contredit le verdict « ${p.section} » (« ${p.text} »)`;
    case 'diagnosis':
      return `vocabulaire médical (« ${p.text} »)`;
    case 'referral':
      return `renvoi vers un professionnel sans alerte qui persiste (« ${p.text} »)`;
  }
}
