// Textes de Réglages, Sources de données et Mes périodes (lot 5a.1, DESIGN.md « Textes »).

import { countOf } from './common';

export const REGLAGES = {
  exportFailed: 'L’export a échoué : choisis un autre dossier et réessaie.',
  eraseFailed: 'L’effacement a échoué.',
  clearConversationFailed: 'L’effacement de la conversation a échoué.',
  /** Champ vide : une invitation plutôt que « à définir ». */
  empty: 'à indiquer',
  choose: 'Choisis',
  targetWeightA11y: 'Poids visé en kg',
  proteinA11y: 'Protéines en grammes par kg de poids',
  quietStart: 'Heures de silence : début',
  quietEnd: 'Heures de silence : fin',
  quietStartA11y: 'Début des heures de silence',
  quietEndA11y: 'Fin des heures de silence',
} as const;

export const SOURCES = {
  calibrationLeft: (n: number) =>
    `Encore ${countOf(n, 'nuit complète', 'nuits complètes')} (HRV et FC au repos) avant le score coloré.`,
  dataCheck: 'Contrôle des données',
} as const;
