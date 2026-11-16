// Textes des alertes (lot 5a.1, DESIGN.md « Textes ») : titre en phrase courte, constat avec le chiffre
// en relief, pourquoi qui parle du signal (jamais d'une cause médicale), action en dernier.
// Les nombres arrivent déjà calculés par alerts.ts : ici, seulement leur mise en mots.

import { countOf } from './common';

type AlertText = { title: string; finding: string; cause: string; action: string };

const fr = (n: number, digits: number) => n.toFixed(digits).replace('.', ',');

/** « Ta variabilité cardiaque (HRV) est sous ta norme et ta FC au repos est *6 battements au-dessus*… » */
function hrvAndRestingHr(bpm: number, days: number): string {
  return `Ta variabilité cardiaque (HRV) est sous ta norme et ta fréquence cardiaque au repos est *${countOf(bpm, 'battement')} au-dessus* de ta moyenne sur ${days} jours`;
}

export const ALERT_TEXT = {
  overload: (bpm: number, days: number, loadPct: number): AlertText => ({
    title: 'Ton corps encaisse mal la charge',
    finding: `${hrvAndRestingHr(bpm, days)}, alors que tu t’entraînes ${loadPct} % de plus que d’habitude.`,
    cause: 'Ton corps n’absorbe pas l’entraînement des derniers jours.',
    action: '*Remplace les deux prochaines séances* par du repos ou de la mobilité, et couche-toi tôt.',
  }),

  fatigueWithoutTraining: (bpm: number, days: number): AlertText => ({
    title: 'Signes de fatigue sans raison sportive',
    finding: `${hrvAndRestingHr(bpm, days)}, sans hausse de ton entraînement.`,
    cause: 'Ton corps montre des signes de fatigue que l’entraînement n’explique pas : manque de sommeil, stress ou coup de fatigue.',
    action: '*Prends une journée légère* : bois de l’eau et dors davantage. Si tu ne te sens pas bien, évite toute séance intense.',
  }),

  hrvLow: (nightsBelow: number | null): AlertText => ({
    title: 'HRV sous ta norme',
    finding:
      nightsBelow === null
        ? 'Ta variabilité cardiaque (HRV) moyenne sur 7 jours est sous ta norme.'
        : `Ta variabilité cardiaque (HRV) est sous ta norme depuis *${countOf(nightsBelow, 'nuit')}*.`,
    cause: 'Ton corps récupère moins bien : la charge, le sommeil, le stress ou l’alcool peuvent l’expliquer.',
    action: '*Fais une séance technique ou de mobilité* aujourd’hui, et couche-toi avant 23 h.',
  }),

  restingHrHigh: (bpm: number, averageDays: number, sinceDays: number): AlertText => ({
    title: 'FC au repos en hausse',
    finding: `Ta fréquence cardiaque au repos est *${countOf(bpm, 'battement')} au-dessus* de ta moyenne sur ${averageDays} jours depuis ${countOf(sinceDays, 'jour')}.`,
    cause: 'Ton corps récupère moins bien que d’habitude.',
    action: '*Évite l’intensité aujourd’hui* et note comment tu te sens.',
  }),

  loadHigh: (loadPct: number, targetPct: number): AlertText => ({
    title: 'Charge en forte hausse',
    finding: `Tu t’entraînes *${loadPct} % de plus* que d’habitude cette semaine.`,
    cause: 'Une hausse rapide du volume ou de l’intensité augmente le risque de blessure et de fatigue.',
    action: `*Allège tes prochaines séances* pour revenir à moins de ${targetPct} % au-dessus de ton rythme habituel.`,
  }),

  loadUnder: (underPct: number, days: number): AlertText => ({
    title: 'Entraînement en baisse',
    finding: `Tu t’entraînes *au moins ${underPct} % de moins* que d’habitude depuis ${countOf(days, 'jour')}.`,
    cause: 'Moins de séances, ou des séances plus légères : ta forme baisse.',
    action: '*Ajoute une séance cette semaine* pour reprendre progressivement.',
  }),

  sleepShort: (hours: number, short: number, window: number): AlertText => ({
    title: 'Nuits trop courtes',
    finding: `Tu as dormi moins de ${fr(hours, hours % 1 === 0 ? 0 : 1)} h *${short} nuits sur ${window}*.`,
    cause: 'Le manque de sommeil s’accumule : ta récupération et ta HRV vont en pâtir.',
    action: '*Avance ton coucher de 30 min* ce soir et lâche les écrans la dernière heure.',
  }),

  bedtimeIrregular: (spread: string): AlertText => ({
    title: 'Heure de coucher irrégulière',
    finding: `Ton heure de coucher a varié de *${spread}* cette semaine.`,
    cause: 'Des horaires irréguliers dérèglent ton rythme et la qualité de ton sommeil.',
    action: '*Choisis une heure de coucher fixe* pour les 7 prochains jours, à 30 min près.',
  }),

  proteinLow: (target: number, below: number, window: number): AlertText => ({
    title: 'Protéines sous ta cible',
    finding: `Tes protéines sont restées sous ta cible de ${target} g *${below} jours sur ${window}*.`,
    cause: 'C’est trop peu pour soutenir la prise de muscle.',
    action: '*Ajoute une source de protéines à chaque repas* : œufs, skyr, viande ou légumineuses.',
  }),

  weightTrend: (gain: boolean, kgPerWeek: number, weeks: number): AlertText => ({
    title: gain ? 'Poids en hausse rapide' : 'Poids en baisse rapide',
    finding: `Ton poids moyen ${gain ? 'augmente' : 'baisse'} de *${fr(kgPerWeek, 2)} kg par semaine* depuis ${countOf(weeks, 'semaine')}.`,
    cause: gain
      ? 'Le surplus de calories est trop important : une partie de la prise risque d’être du gras.'
      : 'Le déficit de calories est trop important : tu risques de perdre du muscle.',
    action: gain
      ? '*Réduis tes calories* d’environ 200 kcal par jour et garde tes protéines.'
      : '*Remonte tes calories* d’environ 200 kcal par jour et garde tes protéines.',
  }),

  strengthStagnation: (exercises: string, weeks: number): AlertText => ({
    title: 'Force qui stagne',
    finding: `Pas de nouveau record en ${exercises} depuis *${countOf(weeks, 'semaine')}*.`,
    cause: 'Ton corps s’est habitué au même programme.',
    action: '*Change de programme* pour 4 à 6 semaines : autre nombre de répétitions, variantes ou volume.',
  }),
} as const;

/** Libellés des cartes d'alerte. */
export const ALERT_UI = {
  persistent: 'Cette alerte revient souvent : si ça dure, parles-en à un professionnel de santé.',
} as const;
