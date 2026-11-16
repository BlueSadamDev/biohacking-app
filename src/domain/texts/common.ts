// Textes communs à tous les écrans (DESIGN.md, « Textes ») : vrais pluriels, listes, messages
// d'erreur simples. Les textes propres à un écran vont dans le fichier de leur domaine
// (today.ts, alerts.ts, journal.ts, links.ts, sport.ts, coach.ts, reglages.ts).

/** Nombre au format français : virgule décimale, pas de zéro inutile (1,5 ; 2). */
function frenchNumber(n: number): string {
  return String(n).replace('.', ',');
}

/** Le mot accordé : singulier pour 0 et 1 (règle française), pluriel au-delà. */
export function pluralWord(n: number, singular: string, plural = defaultPlural(singular)): string {
  return Math.abs(n) < 2 ? singular : plural;
}

/** Le nombre suivi du mot accordé : « 1 nuit », « 3 nuits », « 2 jours ». */
export function countOf(n: number, singular: string, plural?: string): string {
  return `${frenchNumber(n)} ${pluralWord(n, singular, plural)}`;
}

function defaultPlural(word: string): string {
  return /[sxz]$/.test(word) ? word : `${word}s`;
}

/** Liste en français : « a », « a et b », « a, b et c ». */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

/** Messages d'erreur affichés (jamais l'erreur technique, réservée à l'écran de diagnostic). */
export const ERRORS = {
  save: 'Pas enregistré. *Réessaie dans un instant.*',
} as const;
