// Coach IA (lot 4, étape C3) : contrôle du conseil écrit par le modèle avant de l'afficher.
// Le constat chiffré est écrit par l'app ; le modèle ne doit écrire AUCUN chiffre.
// Refusé si : chiffre, verdict du résumé contredit, mot de diagnostic, renvoi vers un professionnel
// sans alerte qui persiste, trop d'actions dans le bilan, texte vide. Les emoji sont retirés.

import type { CoachContext } from './coachContext';
import { unknownNumbers } from './coachNumbers';
import type { CoachTask } from './coachPrompt';
import { SETTINGS, type Settings } from './settings';

export type GuardProblem =
  | { kind: 'empty' }
  | { kind: 'number'; numbers: number[] }
  | { kind: 'contradiction'; section: string; text: string }
  | { kind: 'diagnosis'; text: string }
  | { kind: 'referral'; text: string }
  | { kind: 'action-count'; count: number; max: number }
  | { kind: 'formal'; text: string }
  | { kind: 'unsure' };

export type GuardResult = { ok: boolean; text: string; problems: GuardProblem[] };

// Pictogrammes, symboles divers, dingbats, sélecteur de variante et liant d'emoji.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;

/** Retire les emoji, les espaces en trop et les questions finales (« Qu'en penses-tu ? »). */
export function sanitize(text: string): string {
  const lines = text
    .replace(EMOJI, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
    .split('\n');
  // Le conseil se termine par une action, jamais par une question adressée à l'utilisateur.
  const isClosing = (line: string) => line.trim() === '' || /\?\s*$/.test(line);
  while (lines.length > 1 && isClosing(lines[lines.length - 1])) lines.pop();
  return lines.join('\n').trim();
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

/** Actions numérotées (« 1. », « 2) », « Action n°3 ») du texte. */
function countActions(text: string): number {
  return (text.match(/^\s*(\d+[.)]|action\s*n°?\s*\d)/gim) ?? []).length;
}

/** Contrôle le conseil du modèle par rapport au résumé qui l'a produit. */
export function checkAnswer(
  answer: string,
  context: CoachContext,
  task: CoachTask | null = null,
  settings: Settings = SETTINGS,
): GuardResult {
  const text = sanitize(answer);
  const lower = text.toLowerCase();
  const contextLower = context.text.toLowerCase();
  const g = settings.coach.guard;
  const problems: GuardProblem[] = [];

  if (text.length === 0) problems.push({ kind: 'empty' });

  // Aucun chiffre : le constat chiffré est écrit par l'app (les noms comme « zone 2 » sont acceptés).
  const withoutNames = g.numberNames.reduce((t, p) => t.replace(new RegExp(p, 'gi'), ' '), text);
  const numbers = unknownNumbers(withoutNames, []);
  if (numbers.length) problems.push({ kind: 'number', numbers });

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
  if (Number(alerts?.values.persistent ?? 0) === 0) {
    const referral = firstMatch(lower, g.referral);
    if (referral) problems.push({ kind: 'referral', text: referral });
  }

  const formal = firstMatch(lower, g.formalYou);
  if (formal) problems.push({ kind: 'formal', text: formal });

  if (task?.kind === 'weekly') {
    const count = countActions(text);
    const max = settings.coach.generation.weeklyMaxActions;
    // Le bilan demande exactement `max` actions numérotées.
    if (count !== max) problems.push({ kind: 'action-count', count, max });
    // Le bilan s'appuie sur des verdicts de l'app : un « je ne sais pas » n'y a pas sa place.
    if (/je ne sais pas/.test(lower)) problems.push({ kind: 'unsure' });
  }

  return { ok: problems.length === 0, text, problems };
}

/** Raison lisible d'un refus (banc d'essai, et consigne de la seconde chance). */
export function describeProblem(p: GuardProblem): string {
  switch (p.kind) {
    case 'empty':
      return 'réponse vide';
    case 'number':
      return `chiffre écrit par le modèle (${p.numbers.join(', ')}) : les chiffres sont déjà dans le constat`;
    case 'contradiction':
      return `contredit le verdict « ${p.section} » (« ${p.text} »)`;
    case 'diagnosis':
      return `vocabulaire médical (« ${p.text} »)`;
    case 'referral':
      return `renvoi vers un professionnel sans alerte qui persiste (« ${p.text} »)`;
    case 'action-count':
      return `${p.count} actions au lieu de ${p.max}`;
    case 'formal':
      return `vouvoiement (« ${p.text} ») : tutoie l'utilisateur`;
    case 'unsure':
      return '« je ne sais pas » dans le bilan : ce qui a marché et ce qui coince sont déjà donnés';
  }
}
