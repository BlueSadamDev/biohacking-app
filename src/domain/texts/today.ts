// Textes de l'accueil (lot 5a.1, DESIGN.md « Textes ») : recommandation du jour, raisons du score,
// tuiles, notification du matin, carte de charge, carte nutrition. Le relief est balisé par
// astérisques (voir markup.ts) ; la notification utilise le texte nu.

import { countOf, pluralWord } from './common';

// ---------------------------------------------------------------------------------------------
// Recommandation du jour : pastille (sous l'anneau, qui dit déjà « Récupération »), action en relief.

export const RECOMMENDATION = {
  good: { status: 'En forme', action: '*Feu vert* pour une séance lourde aujourd’hui.' },
  mid: { status: 'Forme moyenne', action: 'Garde une séance *modérée ou technique* aujourd’hui.' },
  low: { status: 'Corps fatigué', action: 'Prends une journée légère : *mobilité ou marche*.' },
  /** Nuit absente (la carte « Ouvrir Zepp » explique déjà pourquoi). */
  noNight: { status: 'Nuit manquante', action: '*Écoute tes sensations* en attendant ta nuit.' },
  /** Nuit présente mais une mesure manque. */
  incomplete: { status: 'Récap incomplet', action: '*Écoute tes sensations* aujourd’hui.' },
  /** Calibration : l'anneau affiche déjà « n / 28 ». */
  calibration: {
    status: 'Norme en construction',
    action: '*Écoute tes sensations* aujourd’hui.',
    reason: 'Ta norme se construit encore : tes valeurs s’affichent sans jugement.',
  },
  paused: { status: 'En pause', reason: 'Tes normes et tes alertes sont en pause.' },
  allInNorm: 'Toutes tes valeurs sont dans ta norme.',
} as const;

// ---------------------------------------------------------------------------------------------
// Raisons du score. `note` : court, pour les tuiles et l'écran détail ; `sentence` : phrase de la
// carte « Recommandation du jour ».

export type Reason = { note: string; sentence: string };

export const NIGHT_MISSING: Reason = { note: 'Nuit pas encore arrivée', sentence: 'Ta nuit n’est pas encore arrivée.' };

export const NORM_NOT_READY = (what: string): Reason => ({
  note: 'Pas encore assez de nuits pour ta norme',
  sentence: `Ta norme de ${what} n’est pas encore prête.`,
});

export const HRV_NO_MEASURE: Reason = {
  note: 'Aucune mesure de HRV pendant le sommeil',
  sentence: 'Aucune mesure de variabilité cardiaque (HRV) pendant ton sommeil.',
};

export function hrvReason(position: 'below' | 'within' | 'above'): Reason {
  const where = { below: 'sous ta norme', within: 'dans ta norme', above: 'au-dessus de ta norme' }[position];
  return { note: `HRV de la nuit ${where}`, sentence: `Ta variabilité cardiaque (HRV) est ${where}.` };
}

export const RESTING_HR_NO_MEASURE: Reason = {
  note: 'Aucune mesure de fréquence cardiaque pendant le sommeil',
  sentence: 'Aucune mesure de fréquence cardiaque pendant ton sommeil.',
};

/** Écart de FC au repos à la moyenne sur `days` jours, arrondi en bpm (signé). */
export function restingHrReason(bpm: number, days: number): Reason {
  const ref = `ta moyenne sur ${days} jours`;
  if (bpm === 0) {
    return { note: `FC au repos égale à ${ref}`, sentence: `Ta fréquence cardiaque au repos est égale à ${ref}.` };
  }
  const n = Math.abs(bpm);
  const side = bpm > 0 ? 'au-dessus' : 'en dessous';
  return {
    note: `FC au repos ${n} bpm ${side} de ${ref}`,
    sentence: `Ta fréquence cardiaque au repos est ${countOf(n, 'battement')} ${side} de ${ref}.`,
  };
}

export function sleepReason(duration: string): Reason {
  return { note: `${duration} de sommeil`, sentence: `Tu as dormi ${duration}.` };
}

// ---------------------------------------------------------------------------------------------
// Tuiles de l'accueil (écart à la norme, court).

export const TILE = {
  belowNorm: 'Sous ta norme',
  withinNorm: 'Dans ta norme',
  aboveNorm: 'Au-dessus',
  hrvContext: 'norme 60 j',
  restingHrContext: 'vs moyenne 30 j',
  equalAverage: '= moyenne',
  sleepReached: 'Objectif atteint',
  notComputable: 'Non calculable',
  calibration: 'Calibration en cours',
  normUnavailable: 'Norme indisponible',
} as const;

// ---------------------------------------------------------------------------------------------
// Notification du matin (texte nu, sans relief).

export const NOTIFICATION = {
  title: 'Récap du matin',
  period: (label: string, advice: string) => `Période « ${label} » en cours : tes normes et tes alertes sont en pause. ${advice}`,
  noNight: 'Ta nuit n’est pas encore arrivée. Ouvre Aube pour la synchroniser et voir ta recommandation du jour.',
  calibration: (label: string, action: string) => `${label}. ${action}`,
  /** « 72 % ce matin, en forme. Feu vert pour une séance lourde aujourd’hui. » */
  score: (score: number, status: string, action: string) => `${score} % ce matin, ${status.toLowerCase()}. ${action}`,
  watch: (titles: string[]) => `À surveiller : ${titles.join(', ')}.`,
} as const;

// ---------------------------------------------------------------------------------------------
// Charge de la semaine (charge des 7 derniers jours comparée au rythme habituel sur 28 jours).

export const LOAD = {
  title: 'Charge de la semaine',
  pill: { balanced: 'Équilibrée', rising: 'En hausse', under: 'En baisse', high: 'Trop haute' },
  profileMissing: (what: string) => `Pour calculer ta charge, indique ${what} dans Réglages.`,
  missingSex: 'ton sexe',
  missingHrMax: 'ta fréquence cardiaque max ou ton année de naissance',
  openSettings: 'Ouvrir les réglages',
  calibrating: (days: number, required: number) => `Calibration : ${days} / ${required} jours`,
  calibratingNote: (required: number) => `Ta charge s’affichera après ${required} jours de données.`,
  noLoad: 'Aucune séance avec fréquence cardiaque ces 28 derniers jours : pas encore de charge à comparer.',
  gaugeMin: '−100 %',
  gaugeMax: '+100 %',
} as const;

/** Écart en pour cent entre la semaine et le rythme habituel (rapport 1,45 → 45). */
export function loadPercent(ratio: number): number {
  return Math.round((ratio - 1) * 100);
}

/** « *45 % de plus* que d’habitude », « autant que d’habitude ». */
function comparedToUsual(pct: number): string {
  if (pct === 0) return 'autant que d’habitude';
  return `*${Math.abs(pct)} % de ${pct > 0 ? 'plus' : 'moins'}* que d’habitude`;
}

/** Le rapport de charge en mots (« *45 % de plus* que d’habitude »), pour toutes les cartes. */
export function loadComparison(ratio: number): string {
  return comparedToUsual(loadPercent(ratio));
}

export function loadSentence(status: 'balanced' | 'rising' | 'under' | 'high', ratio: number): string {
  const cmp = comparedToUsual(loadPercent(ratio));
  switch (status) {
    case 'balanced':
      return `Tu t’entraînes ${cmp} cette semaine, dans ton rythme habituel.`;
    case 'rising':
      return `Tu t’entraînes ${cmp} cette semaine.`;
    case 'under':
      return `Tu t’entraînes ${cmp} cette semaine.`;
    case 'high':
      return `Tu t’entraînes ${cmp} cette semaine. Allège tes prochaines séances.`;
  }
}

/** Détail en petit gris : séances et charge moyenne par jour. */
export function loadDetail(sessions7d: number, acute: number, chronic: number, withoutHr: number): string {
  let text = `${countOf(sessions7d, 'séance')} ces 7 derniers jours · charge de ${Math.round(acute)} par jour, contre ${Math.round(chronic)} d’habitude.`;
  if (withoutHr > 0) {
    text += `\n${countOf(withoutHr, 'séance')} sans fréquence cardiaque suffisante, non ${pluralWord(withoutHr, 'comptée')}.`;
  }
  return text;
}

/** Accessibilité de la jauge de charge. */
export function loadGaugeLabel(ratio: number): string {
  const pct = loadPercent(ratio);
  return pct === 0 ? 'Charge identique à ton rythme habituel' : `Charge ${Math.abs(pct)} % ${pct > 0 ? 'au-dessus' : 'en dessous'} de ton rythme habituel`;
}

// ---------------------------------------------------------------------------------------------
// Nutrition d'hier.

export const NUTRITION = {
  title: 'Nutrition d’hier',
  source: 'via Suivi macro',
  noMeal: 'Aucun repas enregistré hier. Vérifie que Suivi macro synchronise vers Health Connect.',
  protein: 'Protéines',
  calories: 'Calories',
  proteinNoTarget: 'Ajoute une pesée pour calculer ta cible de protéines.',
  caloriesNoTarget: 'Indique ta cible de calories dans Réglages.',
  noValue: 'Aucune valeur hier.',
  reached: 'Cible atteinte.',
  caloriesBelow: 'Sous ta cible.',
  proteinBelow: (days: number, weekDays: number) => `Sous ta cible *${days} ${pluralWord(days, 'jour')} sur ${weekDays}* cette semaine.`,
  setTargets: 'Indiquer mes cibles',
  others: (carbs: string, fat: string, meals: number) => `Glucides ${carbs} · Lipides ${fat} · ${countOf(meals, 'repas')}`,
  barLabel: (label: string, pct: number) => `${label} : ${pct} % de la cible`,
} as const;

// ---------------------------------------------------------------------------------------------
// Accueil : autres textes.

export const HOME = {
  title: 'Ton récap du matin',
  recommendationLabel: 'Recommandation du jour',
  noNights: 'Aucune nuit enregistrée pour l’instant',
  noNightsHelp:
    'Porte ton Helio Strap cette nuit et vérifie que l’app Zepp synchronise vers Health Connect. Tire l’écran vers le bas pour synchroniser.',
  loadError: 'Tes données n’ont pas pu être relues. *Tire l’écran vers le bas* pour réessayer.',
  journal: 'Journal du matin',
  journalFilled: 'Journal rempli ✓',
  zeppTitle: 'Ta nuit n’est pas encore arrivée.',
  zeppBody: 'Zepp ne l’a pas encore envoyée à Health Connect. *Ouvre Zepp* : Aube se met à jour à ton retour.',
  zeppButton: 'Ouvrir Zepp',
} as const;
