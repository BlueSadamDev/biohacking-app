// Noms lisibles des types de séance Health Connect (codes de la bibliothèque react-native-health-connect).
// Un type absent de la liste s'affiche « Type n » : on peut le repérer dans le diagnostic puis l'ajouter.

export const EXERCISE_TYPE_LABEL: Record<number, string> = {
  0: 'Autre entraînement',
  8: 'Vélo',
  9: 'Vélo d’appartement',
  10: 'Bootcamp',
  13: 'Poids du corps',
  16: 'Danse',
  25: 'Elliptique',
  26: 'Cours collectif',
  33: 'Respiration guidée',
  36: 'Fractionné intense',
  37: 'Randonnée',
  44: 'Arts martiaux',
  48: 'Pilates',
  51: 'Escalade',
  54: 'Rameur',
  56: 'Course',
  57: 'Course sur tapis',
  68: 'Escaliers',
  70: 'Musculation',
  71: 'Étirements',
  73: 'Nage en eau libre',
  74: 'Natation en piscine',
  79: 'Marche',
  81: 'Haltérophilie',
  83: 'Yoga',
};

export function exerciseTypeLabel(type: number): string {
  return EXERCISE_TYPE_LABEL[type] ?? `Type ${type}`;
}
