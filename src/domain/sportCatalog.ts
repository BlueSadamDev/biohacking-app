// Catalogue local d'activités à suggérer (lot 3) : chacune comble un manque et se pratique
// facilement à Paris. Aucune donnée en ligne : modifier la liste ici pour l'adapter.

export type Gap = 'endurance' | 'mobility';

export type Activity = {
  id: string;
  gap: Gap;
  /** Proposition (16/600 sur la carte). */
  title: string;
  /** Le manque comblé. */
  benefit: string;
  /** Où la pratiquer facilement à Paris. */
  where: string;
};

/** Manque, dit simplement (ligne secondaire de la carte). */
export const GAP_LABEL: Record<Gap, string> = {
  endurance: 'Endurance douce (zone 2)',
  mobility: 'Mobilité',
};

export const CATALOG: readonly Activity[] = [
  {
    id: 'velib',
    gap: 'endurance',
    title: '45 min de vélo tranquille en Vélib’',
    benefit: 'Endurance douce en zone 2, sans impact pour les jambes.',
    where: 'Le long du canal de l’Ourcq jusqu’au parc de la Villette, ou sur les quais de Seine piétons.',
  },
  {
    id: 'course-lente',
    gap: 'endurance',
    title: '40 min de course lente',
    benefit: 'Endurance douce : tu dois pouvoir parler en courant.',
    where: 'Berges de Seine, canal Saint-Martin ou tour du lac Daumesnil au bois de Vincennes.',
  },
  {
    id: 'natation',
    gap: 'endurance',
    title: '30 à 45 min de natation',
    benefit: 'Endurance douce qui soulage les articulations après la musculation.',
    where: 'Une piscine municipale de la Ville de Paris, près de chez toi ou du travail.',
  },
  {
    id: 'marche-rapide',
    gap: 'endurance',
    title: '1 h de marche rapide',
    benefit: 'Endurance douce, possible même un jour de fatigue.',
    where: 'Coulée verte René-Dumont (12e) ou parc des Buttes-Chaumont.',
  },
  {
    id: 'yoga',
    gap: 'mobility',
    title: 'Un cours de yoga',
    benefit: 'Mobilité des hanches et des épaules, utile au squat et au développé couché.',
    where: 'Cours collectifs dans un studio de quartier ou un centre Paris Anim’.',
  },
  {
    id: 'mobilite-parc',
    gap: 'mobility',
    title: '20 min de mobilité et d’étirements',
    benefit: 'Hanches, dos et épaules plus libres pour le squat et le soulevé de terre.',
    where: 'Au calme dans un parc (Luxembourg, Monceau, Montsouris) ou chez toi après une séance.',
  },
  {
    id: 'pilates',
    gap: 'mobility',
    title: 'Un cours de pilates',
    benefit: 'Mobilité et gainage du dos.',
    where: 'Cours collectifs en studio ou dans ta salle de sport.',
  },
];
