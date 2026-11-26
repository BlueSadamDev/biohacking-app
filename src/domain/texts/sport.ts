// Textes de l'onglet Sport, de la saisie de séance et des écrans de détail (lot 5a.1, DESIGN.md « Textes »).

import { countOf, pluralWord } from './common';

export const SPORT = {
  loadLabel: 'Charge',
  loadCalibrating: (days: number, required: number) => `Calibration : ${days} / ${required} jours`,
  loadProfileMissing: 'Complète ton profil cardiaque dans Réglages.',
  loadNoSession: 'Aucune séance avec fréquence cardiaque ces 28 derniers jours.',
  loadUnreliableValue: 'Non fiable',
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
  title: 'Charge : activités des 28 derniers jours',
  help: 'Toutes les activités comptent dans la charge ; une séance dure au moins 45 min (musculation : toujours). La fréquence cardiaque doit couvrir au moins la moitié de la durée (une mesure compte au plus 2 min) ; sinon, la charge est estimée d’après au moins 3 activités du même type.',
  profileMissing: 'Indique ton sexe et ta fréquence cardiaque max (ou ton année de naissance) dans Réglages pour voir les points.',
  none: 'Aucune séance ces 28 derniers jours.',
  summary: (measured: number, estimated: number, noHr: number, noRest: number) => {
    const parts = [`${countOf(measured, 'activité mesurée', 'activités mesurées')}`];
    if (estimated) parts.push(`${countOf(estimated, 'activité estimée', 'activités estimées')}`);
    if (noHr) parts.push(`${countOf(noHr, 'activité')} sans assez de fréquence cardiaque ni d’estimation`);
    if (noRest) parts.push(`${countOf(noRest, 'activité')} sans fréquence cardiaque au repos de référence`);
    return `${parts.join(', ')}.`;
  },
  shortHidden: (n: number) =>
    `${countOf(n, 'activité')} de moins de 45 min ${pluralWord(n, 'n’est pas listée', 'ne sont pas listées')} (elles comptent dans la charge).`,
  estimatedPoints: (points: number) => `${countOf(points, 'point')} (estimés)`,
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
