// Banc d'essai du coach (lot 4) : TEMPORAIRE, retiré à la fin du lot.
// Les 3 demandes types, posées sur le résumé chiffré du coach (étape C2) construit à partir
// de données FICTIVES (src/domain/__fixtures__/coach.ts) : aucune vraie donnée de santé.

import { coachInputs } from '@/domain/__fixtures__/coach';
import { buildCoachContext, type CoachContext } from '@/domain/coachContext';
import { unknownNumbers as unknownIn } from '@/domain/coachNumbers';

/** Résumé fictif utilisé par le banc d'essai. */
export const BENCH_CONTEXT: CoachContext = buildCoachContext(coachInputs());

/** Consignes système (version de départ, affinée à l'étape C3). */
export const BENCH_SYSTEM_PROMPT = [
  "Tu es le coach de l'application Aube. Tu réponds en français, en tutoyant, en 5 phrases au plus.",
  "Tu n'utilises QUE les chiffres du résumé fourni. Tu ne calcules rien et tu n'inventes aucun chiffre.",
  "Tu ne poses jamais de diagnostic médical et tu ne parles pas de maladie.",
  "Si l'information n'est pas dans le résumé, tu dis « je ne sais pas ».",
  'Termine par une action concrète.',
].join(' ');

export type BenchPrompt = { id: string; label: string; question: string };

/** Les 3 demandes types du test de faisabilité. */
export const BENCH_PROMPTS: BenchPrompt[] = [
  {
    id: 'bilan',
    label: 'Bilan de la semaine',
    question:
      'Fais le bilan de ma semaine : une phrase de synthèse, ce qui a marché, ce qui coince, puis 2 actions numérotées pour la semaine prochaine.',
  },
  {
    id: 'pourquoi',
    label: '« Pourquoi ? » d\'une alerte',
    question: "Pourquoi ai-je reçu l'alerte « Charge en hausse » ? Explique simplement.",
  },
  {
    id: 'libre',
    label: 'Question libre',
    question: 'Est-ce que je mange assez de protéines pour progresser en musculation ?',
  },
];

/** Message utilisateur envoyé au modèle : le résumé chiffré puis la demande. */
export function buildUserMessage(question: string, context: CoachContext = BENCH_CONTEXT): string {
  return `${context.text}\n\nDemande : ${question}`;
}

/** Nombre de mots d'un texte (suite de caractères sans espace). */
export function countWords(text: string): number {
  const words = text.trim().split(/\s+/);
  return words[0] === '' ? 0 : words.length;
}

/** Mots par seconde, ou null si la durée est nulle. */
export function wordsPerSecond(text: string, durationMs: number): number | null {
  if (durationMs <= 0) return null;
  return countWords(text) / (durationMs / 1000);
}

/** Nombres de la réponse absents du résumé (indice de chiffre inventé). */
export function unknownNumbers(answer: string, context: CoachContext = BENCH_CONTEXT): number[] {
  return unknownIn(answer, context.numbers);
}
