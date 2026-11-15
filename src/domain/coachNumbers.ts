// Coach IA (lot 4) : repérage des nombres d'un texte, pour vérifier qu'une réponse du coach
// ne contient que des nombres présents dans son résumé chiffré (le coach ne calcule rien).

/** Tous les nombres d'un texte, virgule décimale convertie en point (« 6,4 » → 6.4). */
export function extractNumbers(text: string): number[] {
  return (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => Number(n.replace(',', '.')));
}

/**
 * Nombres de la réponse absents de la liste autorisée (indice de chiffre inventé).
 * Les numéros de liste en début de ligne (« 1. », « 2) ») sont ignorés.
 */
export function unknownNumbers(answer: string, allowed: readonly number[]): number[] {
  const known = new Set(allowed);
  const withoutListMarkers = answer.replace(/^\s*\d+[.)]\s/gm, ' ');
  return [...new Set(extractNumbers(withoutListMarkers))].filter((n) => !known.has(n));
}
