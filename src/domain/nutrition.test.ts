import { meal, NUTRITION_ORIGIN } from './__fixtures__/meals';
import { at } from './__fixtures__/nights';
import { nutritionByDay } from './nutrition';

describe('nutrition : totaux par jour', () => {
  it('additionne les repas du même jour', () => {
    const days = nutritionByDay([
      meal(at(2026, 1, 10, 8), { energyKcal: 500, proteinG: 30, carbsG: 60, fatG: 15 }),
      meal(at(2026, 1, 10, 13), { energyKcal: 800, proteinG: 45, carbsG: 90, fatG: 25 }),
    ]);
    expect(days.get('2026-01-10')).toEqual({
      date: '2026-01-10',
      energyKcal: 1300,
      proteinG: 75,
      carbsG: 150,
      fatG: 40,
      meals: 2,
      origins: [NUTRITION_ORIGIN],
    });
  });

  it('un repas compte pour le jour de son début (heure locale)', () => {
    const days = nutritionByDay([
      meal(at(2026, 1, 10, 23, 30), { proteinG: 20 }),
      meal(at(2026, 1, 11, 0, 30), { proteinG: 10 }),
    ]);
    expect(days.get('2026-01-10')?.proteinG).toBe(20);
    expect(days.get('2026-01-11')?.proteinG).toBe(10);
  });

  it('un jour sans repas est absent (« aucune donnée », jamais 0)', () => {
    const days = nutritionByDay([meal(at(2026, 1, 10, 12), { proteinG: 20 })]);
    expect(days.has('2026-01-11')).toBe(false);
  });

  it('une valeur absente de tous les repas reste inconnue (null), pas 0', () => {
    const days = nutritionByDay([meal(at(2026, 1, 10, 12), { energyKcal: 600 })]);
    expect(days.get('2026-01-10')).toMatchObject({ energyKcal: 600, proteinG: null, carbsG: null, fatG: null });
  });

  it('ignore les valeurs négatives ou invalides', () => {
    const days = nutritionByDay([
      meal(at(2026, 1, 10, 8), { proteinG: -5 }),
      meal(at(2026, 1, 10, 12), { proteinG: Number.NaN }),
      meal(at(2026, 1, 10, 19), { proteinG: 40 }),
    ]);
    expect(days.get('2026-01-10')).toMatchObject({ proteinG: 40, meals: 3 });
  });

  it("garde la liste des apps d'origine", () => {
    const days = nutritionByDay([
      meal(at(2026, 1, 10, 8), { proteinG: 20 }),
      meal(at(2026, 1, 10, 12), { proteinG: 20 }, 'autre.app'),
    ]);
    expect(days.get('2026-01-10')?.origins).toEqual([NUTRITION_ORIGIN, 'autre.app']);
  });
});
