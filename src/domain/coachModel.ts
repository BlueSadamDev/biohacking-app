// Coach IA (lot 4, étape C1) : règles de vérification du fichier du modèle importé.
// Calculs purs : l'accès aux fichiers est dans src/coach/modelStore.ts.

import { SETTINGS } from './settings';

export type ModelSpec = { sizeBytes: number; sha256: string };

export type ModelProblem = 'no-space' | 'wrong-size' | 'wrong-hash' | 'unreadable';

/** Espace libre nécessaire pour importer le modèle (fichier + marge), en octets. */
export function requiredFreeSpace(
  spec: ModelSpec = SETTINGS.coach.model,
  margin: number = SETTINGS.coach.freeSpaceMarginBytes,
): number {
  return spec.sizeBytes + margin;
}

/** Assez de place pour l'import ? Une place inconnue (null) n'empêche pas d'essayer. */
export function hasEnoughSpace(available: number | null, spec: ModelSpec = SETTINGS.coach.model): boolean {
  return available === null || available >= requiredFreeSpace(spec);
}

/** Taille exacte attendue ? (contrôle instantané, avant l'empreinte) */
export function sizeMatches(size: number | null | undefined, spec: ModelSpec = SETTINGS.coach.model): boolean {
  return size === spec.sizeBytes;
}

/** Empreinte SHA-256 identique (sans tenir compte des majuscules ni des espaces) ? */
export function hashMatches(hash: string | null | undefined, spec: ModelSpec = SETTINGS.coach.model): boolean {
  return typeof hash === 'string' && hash.trim().toLowerCase() === spec.sha256.toLowerCase();
}

/** Message affiché quand le fichier est refusé. */
export function problemMessage(problem: ModelProblem, freeSpaceText?: string): string {
  switch (problem) {
    case 'no-space':
      return `Pas assez de place sur le téléphone${freeSpaceText ? ` (${freeSpaceText} libres)` : ''}. Libère de l'espace, puis réessaie.`;
    case 'wrong-size':
      return "Ce n'est pas le bon fichier : sa taille ne correspond pas. Vérifie le nom du fichier téléchargé.";
    case 'wrong-hash':
      return 'Le fichier est abîmé ou modifié (empreinte différente). Télécharge-le de nouveau depuis l’ordinateur.';
    case 'unreadable':
      return 'Le fichier n’a pas pu être lu. Réessaie, ou copie-le de nouveau sur le téléphone.';
  }
}

/** Taille lisible en français, en unités décimales comme Android : « 731 Mo », « 1,3 Go ». */
export function formatBytes(bytes: number): string {
  const mo = bytes / 1e6;
  if (mo < 1000) return `${Math.round(mo)} Mo`;
  return `${(mo / 1000).toFixed(1).replace('.', ',')} Go`;
}
