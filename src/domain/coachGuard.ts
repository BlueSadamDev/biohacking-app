// Coach IA (lot 4, étape C3) : contrôle du conseil écrit par le modèle avant de l'afficher.
// Le constat chiffré est écrit par l'app ; le modèle ne doit écrire AUCUN chiffre.
// Chaque phrase est contrôlée. Selon la sévérité réglée dans settings.ts (`coach.guard.policy`) :
// - refus de toute la réponse (verdict du résumé contredit) ;
// - phrase retirée (chiffre, diagnostic, notion non mesurée, renvoi vers un professionnel, première
//   personne, commentaire du résumé, « je ne sais pas » dans le bilan) ;
// - accepté (vouvoiement, sujet voisin de la question).
// Une réponse réparée reste refusée si elle a perdu toute son explication ou son action.
// Les emoji sont retirés ; le bilan garde ses premières actions s'il en a trop.

import type { CoachContext } from './coachContext';
import { unknownNumbers } from './coachNumbers';
import { focusSections, type CoachTask } from './coachPrompt';
import { SETTINGS, type GuardPolicy, type Settings } from './settings';

export type GuardProblem =
  | { kind: 'empty' }
  | { kind: 'number'; numbers: number[] }
  | { kind: 'contradiction'; section: string; text: string }
  | { kind: 'diagnosis'; text: string }
  | { kind: 'referral'; text: string }
  | { kind: 'action-count'; count: number; max: number }
  | { kind: 'formal'; text: string }
  | { kind: 'first-person'; text: string }
  | { kind: 'off-topic' }
  | { kind: 'unsure' }
  | { kind: 'meta'; text: string }
  | { kind: 'unmeasured'; text: string };

/** Phrase retirée de la réponse, avec sa raison. */
export type GuardRemoval = { problem: GuardProblem; sentence: string };

export type GuardResult = {
  ok: boolean;
  /** Réponse réparée (phrases fautives retirées). */
  text: string;
  /** Raisons du refus (vide si la réponse est acceptée). */
  problems: GuardProblem[];
  /** Phrases retirées. */
  removed: GuardRemoval[];
};

// Pictogrammes, symboles divers, dingbats, sélecteur de variante et liant d'emoji.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;

/** Début de ligne d'action numérotée du bilan (« 1. », « 2) », « Action n°1 : »). */
const NUMBERED = /^\s*(\d+[.)]|action\s*n°?\s*\d+\s*:?)\s*/i;
/** Ligne « Action : … » d'une réponse. */
const ACTION = /^\s*action\s*:/i;
/** Marque de liste (numéro, tiret, puce) : gardée à part pour ne pas être lue comme un chiffre. */
const MARKER = /^\s*(\d+[.)]|action\s*n°?\s*\d+\s*:?|[-*•])\s*/i;

/** Retire les emoji, les espaces en trop et les questions finales (« Qu'en penses-tu ? »). */
export function sanitize(text: string): string {
  const lines = text
    .replace(EMOJI, '')
    // Étiquettes recopiées de la consigne (« Réponse : », « 1re phrase : », « Phrase 2 : ») : retirées.
    .replace(/^[ \t]*(?:\*\*)?(?:réponse|explication|\d+(?:re|er|e|ère)? phrase|phrase \d+)(?:\*\*)?[ \t]*:[ \t]*/gim, '')
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

function policyOf(p: GuardProblem, settings: Settings): GuardPolicy {
  if (p.kind === 'empty' || p.kind === 'action-count') return 'reject';
  return settings.coach.guard.policy[p.kind];
}

/** Problèmes d'une phrase (sans sa marque de liste). */
function sentenceProblems(sentence: string, context: CoachContext, task: CoachTask | null, settings: Settings): GuardProblem[] {
  const g = settings.coach.guard;
  const lower = sentence.toLowerCase();
  const contextLower = context.text.toLowerCase();
  const problems: GuardProblem[] = [];

  // Aucun chiffre : le constat chiffré est écrit par l'app (les noms comme « zone 2 » sont acceptés).
  const withoutNames = g.numberNames.reduce((t, p) => t.replace(new RegExp(p, 'gi'), ' '), sentence);
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

  const firstPerson = firstMatch(lower, g.firstPerson);
  if (firstPerson) problems.push({ kind: 'first-person', text: firstPerson });

  const meta = firstMatch(lower, g.meta);
  if (meta) problems.push({ kind: 'meta', text: meta });

  // Notion non mesurée par l'app (« qualité du sommeil ») : acceptée seulement si le résumé en parle.
  const unmeasured = firstMatch(lower, g.unmeasured.filter((p) => !new RegExp(p).test(contextLower)));
  if (unmeasured) problems.push({ kind: 'unmeasured', text: unmeasured });

  // Le bilan s'appuie sur des verdicts de l'app : un « je ne sais pas » n'y a pas sa place.
  if (task?.kind === 'weekly' && /je ne sais pas/.test(lower)) problems.push({ kind: 'unsure' });

  return problems;
}

/**
 * Retire les phrases qui commentent le résumé (« Ce constat montre que… ») au lieu de répondre.
 * Renvoie le texte réparé et la première expression retirée (null si rien n'a été retiré).
 */
export function dropMetaSentences(text: string, settings: Settings = SETTINGS): { text: string; removed: string | null } {
  let removed: string | null = null;
  const lines = text.split('\n').map((line) => {
    const sentences = line.match(/[^.!?]+[.!?]*/g) ?? [];
    const kept = sentences.filter((s) => {
      const found = firstMatch(s.toLowerCase(), settings.coach.guard.meta);
      if (found && removed === null) removed = found;
      return !found;
    });
    return kept.join('').trim();
  });
  return { text: lines.filter((l) => l !== '').join('\n'), removed };
}

/** Contrôle le conseil du modèle par rapport au résumé qui l'a produit, et le répare si possible. */
export function checkAnswer(
  answer: string,
  context: CoachContext,
  task: CoachTask | null = null,
  settings: Settings = SETTINGS,
): GuardResult {
  const original = sanitize(answer);
  const removed: GuardRemoval[] = [];
  const rejected: GuardProblem[] = [];

  // 1. Phrase par phrase : refus, phrase retirée ou accepté, selon la sévérité de chaque problème.
  const repairedLines = original.split('\n').map((line) => {
    const marker = MARKER.exec(line)?.[0] ?? '';
    const sentences = line.slice(marker.length).match(/[^.!?]+[.!?]*/g) ?? [];
    const kept = sentences.filter((s) => {
      const problems = sentenceProblems(s, context, task, settings);
      const rejects = problems.filter((p) => policyOf(p, settings) === 'reject');
      if (rejects.length) {
        rejected.push(...rejects);
        return true;
      }
      const drop = problems.find((p) => policyOf(p, settings) === 'drop');
      if (drop) {
        removed.push({ problem: drop, sentence: s.trim() });
        return false;
      }
      return true;
    });
    const body = kept.join('').trim();
    return body ? `${marker}${body}` : '';
  });
  let lines = repairedLines.filter((l) => l !== '');

  // 2. Bilan : il demande exactement `max` actions numérotées ; les actions en trop sont retirées.
  if (task?.kind === 'weekly') {
    const max = settings.coach.generation.weeklyMaxActions;
    const count = lines.filter((l) => NUMBERED.test(l)).length;
    if (count > max) {
      let seen = 0;
      lines = lines.filter((l) => {
        if (!NUMBERED.test(l)) return true;
        seen++;
        if (seen <= max) return true;
        removed.push({ problem: { kind: 'action-count', count, max }, sentence: l.trim() });
        return false;
      });
    } else if (count < max) {
      rejected.push({ kind: 'action-count', count, max });
    }
  }

  // 3. Question sur un sujet reconnu : la réponse doit en parler (ou d'un sujet lié), si la règle est active.
  const text = lines.join('\n');
  const lower = text.toLowerCase();
  if (task?.kind === 'question' && text.length > 0 && settings.coach.guard.policy['off-topic'] === 'reject') {
    const sections = new Set<string>(focusSections(task, settings));
    const related = settings.coach.focus.filter((f) => f.sections.some((s) => sections.has(s)));
    if (related.length && !related.some((f) => new RegExp(f.pattern).test(lower))) rejected.push({ kind: 'off-topic' });
  }

  // 4. Une réparation ne doit pas vider la réponse : explication et action perdues = refus,
  //    avec les raisons des phrases retirées (pour la consigne du nouvel essai).
  const isAction = (l: string) => ACTION.test(l) || NUMBERED.test(l);
  const hadProse = original.split('\n').some((l) => l.trim() !== '' && !isAction(l));
  const hadAction = original.split('\n').some((l) => ACTION.test(l));
  const lostProse = hadProse && !lines.some((l) => !isAction(l));
  const lostAction = hadAction && !lines.some((l) => ACTION.test(l));
  if (text.length === 0 || lostProse || lostAction) {
    const reasons = removed.map((r) => r.problem).filter((p) => p.kind !== 'action-count');
    if (reasons.length) rejected.push(...reasons);
    else if (text.length === 0) rejected.push({ kind: 'empty' });
  }

  // Une seule fois chaque type de problème, dans l'ordre d'apparition.
  const problems = rejected.filter((p, i) => rejected.findIndex((q) => q.kind === p.kind) === i);
  return { ok: problems.length === 0, text, problems, removed };
}

/** Raison lisible d'un refus (banc d'essai, et consigne de la seconde chance). */
export function describeProblem(p: GuardProblem): string {
  switch (p.kind) {
    case 'empty':
      return 'réponse vide';
    case 'number':
      return `chiffre écrit (${p.numbers.join(', ')}) : l'utilisateur voit déjà ses chiffres, n'en écris aucun`;
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
    case 'first-person':
      return `écrit à la première personne (« ${p.text} ») : parle à l'utilisateur en le tutoyant`;
    case 'off-topic':
      return 'ne parle pas du sujet de la question';
    case 'meta':
      // Sans citer le mot : le redire au modèle le pousserait à le réécrire.
      return 'tu commentes au lieu de répondre directement à la question';
    case 'unmeasured':
      return `parle d'une notion que l'app ne mesure pas (« ${p.text} »)`;
    case 'unsure':
      return '« je ne sais pas » dans le bilan : ce qui a marché et ce qui coince sont déjà donnés';
  }
}
