// Textes du journal du matin et des comportements (lot 5a.1, DESIGN.md « Textes »).

import { userText } from './markup';

export const JOURNAL = {
  title: 'Journal du matin',
  subtitle: '15 secondes pour comprendre ta nuit',
  eveToday: 'Hier, tu as…',
  eveOther: (day: string) => `Le ${day}, tu as…`,
  manageList: 'Gérer la liste',
  noBehavior: 'Aucun comportement affiché : ajoute-en depuis « Gérer la liste ».',
  nothingChecked: 'Si tu n’as rien fait de tout ça, laisse tout décoché.',
  lateMealPrefilled: '« Repas tardif » est rempli d’après Suivi macro : corrige-le si besoin.',
  weightLabel: 'Poids (kg)',
  weightA11y: 'Poids en kg',
  weightPlaceholder: 'ex. 78,4',
  weightHelp: 'Le matin à jeun. Ta saisie remplace la pesée Zepp du jour.',
  weightInvalid: (min: number, max: number) =>
    `Ce poids n’est pas reconnu. *Tape un nombre entre ${min} et ${max} kg*, par exemple 78,4.`,
  noteLabel: 'Autre chose à noter ?',
  notePlaceholder: 'Mal dormi, séance tardive…',
  noteA11y: 'Note libre',
  save: 'Enregistrer',
  saved: 'Enregistré ✓',
  /** Échelles 1 à 5 : le sens des valeurs enregistrées ne change pas. */
  feelings: {
    energy: { label: 'Énergie', hint: 'De 1 (très basse) à 5 (excellente).' },
    soreness: { label: 'Courbatures', hint: 'De 1 (aucune) à 5 (très fortes) : plus la note est haute, plus tu as mal.' },
    mood: { label: 'Humeur', hint: 'De 1 (mauvaise) à 5 (excellente).' },
  },
} as const;

/**
 * Forme « en phrase » des comportements par défaut (liens observés) : « les soirs où tu bois de
 * l’alcool, tu dors 12 % de moins… ». Utilisée seulement si le nom n'a pas été changé.
 */
export const DEFAULT_BEHAVIOR_PHRASES: Record<string, { name: string; phrase: string }> = {
  magnesium: { name: 'Magnésium le soir', phrase: 'les soirs où tu prends du magnésium' },
  alcohol: { name: 'Alcool', phrase: 'les soirs où tu bois de l’alcool' },
  caffeine: { name: 'Caféine après 14 h', phrase: 'les jours où tu prends de la caféine après 14 h' },
  screen: { name: 'Écran au lit', phrase: 'les soirs où tu regardes un écran au lit' },
  'late-meal': { name: 'Repas tardif', phrase: 'les soirs où tu dînes tard' },
  nap: { name: 'Sieste', phrase: 'les jours où tu fais une sieste' },
  sauna: { name: 'Sauna', phrase: 'les jours où tu vas au sauna' },
  meditation: { name: 'Méditation', phrase: 'les jours où tu médites' },
};

/**
 * La forme « en phrase » d'un comportement, en minuscules au début :
 * 1. celle que tu as saisie dans « Gérer la liste » ;
 * 2. sinon, celle d'un comportement par défaut dont le nom n'a pas changé ;
 * 3. sinon, une tournure générique : « les jours avec « Yoga » ».
 */
export function behaviorPhrase(b: { id: string; name: string; phrase?: string | null }): string {
  const own = b.phrase?.trim();
  if (own) return userText(own.charAt(0).toLowerCase() + own.slice(1));
  const known = DEFAULT_BEHAVIOR_PHRASES[b.id];
  if (known && known.name === b.name) return known.phrase;
  return `les jours avec « ${userText(b.name)} »`;
}

/** Première lettre en majuscule (début de phrase). */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Textes de « Gérer la liste ». */
export const BEHAVIOR_LIST = {
  phraseLabel: 'En phrase (facultatif)',
  phrasePlaceholder: 'les soirs où tu…',
  phraseHelp: 'Sert aux liens observés : « Les soirs où tu…, tu dors 12 % de moins ». Laisse vide si tu ne sais pas.',
  phraseA11y: (name: string) => `Forme en phrase de ${name}`,
} as const;
