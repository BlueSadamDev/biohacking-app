// Banc d'essai du coach (lot 4) : TEMPORAIRE, retiré à la fin du lot.
// Les 3 demandes types, posées au vrai circuit du coach (consignes, contrôle, seconde chance,
// repli) sur un résumé construit à partir de données FICTIVES (src/domain/__fixtures__/coach.ts).

import { coachInputs } from '@/domain/__fixtures__/coach';
import { buildCoachContext, type CoachContext } from '@/domain/coachContext';
import { describeProblem } from '@/domain/coachGuard';
import type { CoachTask } from '@/domain/coachPrompt';
import type { CoachOutcome } from '@/domain/coachRun';

/** Résumé fictif utilisé par le banc d'essai. */
export const BENCH_CONTEXT: CoachContext = buildCoachContext(coachInputs());

export type BenchPrompt = { id: string; label: string; task: CoachTask };

/** Les 3 demandes types du test de faisabilité. */
export const BENCH_PROMPTS: BenchPrompt[] = [
  { id: 'bilan', label: 'Bilan de la semaine', task: { kind: 'weekly' } },
  {
    id: 'pourquoi',
    label: '« Pourquoi ? » d\'une alerte',
    task: { kind: 'why-alert', title: 'Charge en hausse', theme: 'load' },
  },
  {
    id: 'libre',
    label: 'Question libre',
    task: { kind: 'question', text: 'Est-ce que je mange assez de protéines pour progresser en musculation ?' },
  },
];

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

const ORDINAL = ['1er', '2e', '3e'];

/** Résultat du contrôle, en clair. */
export function outcomeLine(o: CoachOutcome): string {
  const refusals = o.rejections
    .map((r, i) => `${ORDINAL[i] ?? `${i + 1}e`} essai refusé : ${r.map(describeProblem).join(' ; ')}`)
    .join(' · ');
  switch (o.kind) {
    case 'answer':
      return `Contrôle réussi au ${ORDINAL[o.attempts - 1] ?? `${o.attempts}e`} essai${refusals ? ` (${refusals})` : ''}`;
    case 'fallback':
      return `Message de repli (${refusals})`;
    case 'stopped':
      return `Arrêté${refusals ? ` (${refusals})` : ''}`;
  }
}
