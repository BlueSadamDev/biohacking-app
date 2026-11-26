// Règles de la synchro (lot 5b) : plages de fréquence cardiaque, réconciliation, tranches d'historique.

import { historyChunks, insideRanges, mergeRanges, rowsToDelete } from './syncPlan';

const MIN = 60_000;

describe('plages de lecture de la fréquence cardiaque', () => {
  it('réunit les plages qui se chevauchent ou sont proches, garde les autres séparées', () => {
    const ranges = [
      { start: 100 * MIN, end: 160 * MIN }, // séance
      { start: 0, end: 60 * MIN }, // sommeil (dans le désordre)
      { start: 70 * MIN, end: 80 * MIN }, // activité courte 10 min après le réveil (écart 10 min < 15)
      { start: 150 * MIN, end: 170 * MIN }, // chevauche la séance
      { start: 500 * MIN, end: 500 * MIN }, // vide : ignorée
    ];
    expect(mergeRanges(ranges, 15 * MIN)).toEqual([
      { start: 0, end: 80 * MIN },
      { start: 100 * MIN, end: 170 * MIN },
    ]);
    expect(mergeRanges(ranges, 0)).toHaveLength(3);
  });

  it('dit si une mesure tombe dans une plage, bornes comprises', () => {
    const merged = mergeRanges([{ start: 10, end: 20 }, { start: 40, end: 50 }], 0);
    expect([9, 10, 15, 20, 30, 40, 50, 51].map((t) => insideRanges(t, merged))).toEqual([
      false, true, true, true, false, true, true, false,
    ]);
    expect(insideRanges(5, [])).toBe(false);
  });
});

describe('réconciliation d’une période relue', () => {
  const local = [
    { id: 'gardée', start: 100, end: 200 },
    { id: 'disparue', start: 300, end: 400 },
    { id: 'déborde', start: 50, end: 150 }, // commence avant la période : jamais supprimée
    { id: 'mesure-disparue', start: 500, end: 500 },
    { id: 'hors-période', start: 2000, end: 2000 },
  ];

  it('supprime seulement les lignes entièrement dans la période que Health Connect ne renvoie plus', () => {
    expect(rowsToDelete(local, new Set(['gardée']), 100, 1000)).toEqual(['disparue', 'mesure-disparue']);
  });

  it('ne supprime rien quand tout est encore renvoyé', () => {
    expect(rowsToDelete(local, new Set(local.map((r) => r.id)), 0, 5000)).toEqual([]);
  });
});

describe('tranches du rattrapage de l’historique', () => {
  it('découpe de la plus récente à la plus ancienne, la dernière tranche s’arrête à la limite', () => {
    expect(historyChunks(100, 15, 30)).toEqual([
      { start: 70, end: 100 },
      { start: 40, end: 70 },
      { start: 15, end: 40 },
    ]);
  });

  it('rien à lire quand l’historique local remonte déjà assez loin', () => {
    expect(historyChunks(10, 15, 30)).toEqual([]);
  });
});
