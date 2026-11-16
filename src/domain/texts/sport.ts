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

/** Carte « Charge : séances des 28 derniers jours » de l'écran « Contrôle des données ». */
export const LOAD_CHECK = {
  title: 'Charge : séances des 28 derniers jours',
  help: 'Une séance compte si elle dure au moins 20 min (musculation : toujours) et si la fréquence cardiaque couvre au moins la moitié de sa durée (une mesure compte au plus 2 min).',
  profileMissing: 'Indique ton sexe et ta fréquence cardiaque max (ou ton année de naissance) dans Réglages pour voir les points.',
  none: 'Aucune séance ces 28 derniers jours.',
  summary: (counted: number, short: number, noHr: number, noRest: number) => {
    const parts = [`${countOf(counted, 'séance comptée', 'séances comptées')}`];
    if (short) parts.push(`${countOf(short, 'séance')} de moins de 20 min`);
    if (noHr) parts.push(`${countOf(noHr, 'séance')} avec fréquence cardiaque insuffisante`);
    if (noRest) parts.push(`${countOf(noRest, 'séance')} sans fréquence cardiaque au repos de référence`);
    return `${parts.join(', ')}.`;
  },
  shortHidden: (n: number) => `${countOf(n, 'séance')} de moins de 20 min ${pluralWord(n, 'n’est pas listée', 'ne sont pas listées')}.`,
  coverage: (pct: number, samples: number) => `fréquence cardiaque sur ${pct} % de la séance (${countOf(samples, 'mesure')})`,
  points: (points: number) => `${countOf(points, 'point')}`,
  rejected: { 'no-heart-rate': 'non comptée : fréquence cardiaque insuffisante', 'no-resting-hr': 'non comptée : pas de fréquence cardiaque au repos de référence' },
} as const;

export const DETAIL = {
  unfavorable: { hrv: 'Sous ta norme', restingHr: 'Au-dessus de ta moyenne', sleep: 'Nuit courte' },
  band: 'Ta norme',
  today: 'Aujourd’hui',
} as const;

export const BODY = {
  noTarget: 'Indique ton poids visé dans Réglages.',
} as const;
