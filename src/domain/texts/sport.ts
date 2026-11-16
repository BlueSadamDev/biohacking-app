// Textes de l'onglet Sport, de la saisie de séance et des écrans de détail (lot 5a.1, DESIGN.md « Textes »).

import { countOf, pluralWord } from './common';

export const SPORT = {
  loadLabel: 'Charge',
  loadCalibrating: (days: number, required: number) => `Calibration : ${days} / ${required} jours`,
  loadProfileMissing: 'Complète ton profil cardiaque dans Réglages.',
  loadNoSession: 'Aucune séance avec fréquence cardiaque ces 28 derniers jours.',
  hrMaxMissing: 'Indique ta fréquence cardiaque max ou ton année de naissance dans Réglages pour voir tes zones cardiaques.',
  noSessionThisWeek: 'Aucune séance cette semaine : pas encore de zones cardiaques.',
  notEnoughHr: 'Pas assez de fréquence cardiaque enregistrée pendant tes séances pour calculer les zones.',
  sessionsWithoutHr: (n: number) =>
    `${countOf(n, 'séance')} sans fréquence cardiaque suffisante, non ${pluralWord(n, 'comptée')} dans les zones.`,
  /** Lecteur d'écran : « Squat : force estimée (1RM) 120 kg, en hausse ». */
  oneRepMax: (kg: number) => `force estimée (1RM) ${kg} kg`,
  noRecentOneRepMax: 'pas de force estimée (1RM) récente',
} as const;

export const DETAIL = {
  unfavorable: { hrv: 'Sous ta norme', restingHr: 'Au-dessus de ta moyenne', sleep: 'Nuit courte' },
  band: 'Ta norme',
  today: 'Aujourd’hui',
} as const;

export const BODY = {
  noTarget: 'Indique ton poids visé dans Réglages.',
} as const;
