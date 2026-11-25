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

/** Durée en secondes, au dixième : 1234 ms → « 1,2 s ». */
function seconds(ms: number): string {
  return `${String(Math.round(ms / 100) / 10).replace('.', ',')} s`;
}

/** Carte « Dernières synchros » de Contrôle des données (lot 5b) : comptages et durées seulement. */
export const SYNC_RUNS = {
  title: 'Dernières synchros',
  help: (kept: number) =>
    `Durées et comptages des ${countOf(kept, 'dernière synchro', 'dernières synchros')}, pour comparer avant et après les optimisations. Touche une synchro pour le détail par type.`,
  none: 'Aucune synchro mesurée pour l’instant.',
  running: (since: string) => `Synchro en cours de mesure depuis le ${since}.`,
  /** Écran de diagnostic seulement : détail technique de l'échec d'enregistrement d'un relevé. */
  saveError: (detail: string) => `Dernier relevé non enregistré : ${detail}`,
  origin: { launch: 'ouverture', background: 'tâche de fond', button: 'bouton' } as const,
  seconds,
  line: (origin: string, totalMs: number, homeReadyMs: number | null) =>
    homeReadyMs === null
      ? `${origin} · ${seconds(totalMs)} en tout`
      : `${origin} · accueil à jour en ${seconds(homeReadyMs)} · ${seconds(totalMs)} en tout`,
  totals: (calls: number, read: number, written: number, inserted: number) =>
    `${countOf(calls, 'appel')} à Health Connect · ${countOf(read, 'enregistrement lu', 'enregistrements lus')} · ${countOf(written, 'ligne écrite', 'lignes écrites')}, dont ${countOf(inserted, 'nouvelle', 'nouvelles')}`,
  access: (calls: number) => `Accès à Health Connect : ${countOf(calls, 'appel')}`,
  nights: (runs: number, readMs: number, computeMs: number) =>
    runs === 0
      ? 'Calcul des nuits : aucun pendant cette synchro'
      : `Calcul des nuits : ${countOf(runs, 'fois', 'fois')}, lecture en base ${seconds(readMs)}, calcul ${seconds(computeMs)}`,
  type: (label: string, durationMs: number, calls: number, read: number, written: number, inserted: number) =>
    `${label} : ${seconds(durationMs)} · ${countOf(calls, 'appel')} · ${read} lus · ${written} écrits, dont ${inserted} nouveaux`,
  denied: (label: string) => `${label} : permission refusée`,
  error: (label: string) => `${label} : lecture impossible`,
} as const;
