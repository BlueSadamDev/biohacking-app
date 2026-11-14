import { meal, NUTRITION_ORIGIN } from './__fixtures__/meals';
import { at } from './__fixtures__/nights';
import { nutritionByDay, nutritionDayView, nutritionReminder, targetProgress } from './nutrition';

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

describe('nutrition par rapport aux cibles', () => {
  // Cible protéines 144 g (80 kg × 1,8), calories 2500 kcal.
  const days = (values: [number, number | null, number | null][]) =>
    nutritionByDay(values.map(([d, proteinG, energyKcal]) => meal(at(2026, 1, d, 12), { proteinG, energyKcal })));

  it('cible atteinte à partir de 90 %', () => {
    expect(targetProgress(130, 144).reached).toBe(true);
    expect(targetProgress(129, 144).reached).toBe(false);
  });
  it('cible « à définir » ou valeur inconnue : non calculable', () => {
    expect(targetProgress(2000, null)).toEqual({ value: 2000, target: null, fraction: null, reached: null });
    expect(targetProgress(null, 144).reached).toBeNull();
  });
  it('compte les jours sous la cible sur 7 jours (jours avec repas seulement)', () => {
    const view = nutritionDayView(days([[10, 100, 2500], [9, 100, 2500], [8, 150, 2500], [7, 90, null]]), '2026-01-10', 144, 2500);
    expect(view.protein).toMatchObject({ value: 100, reached: false });
    expect(view.calories).toMatchObject({ value: 2500, reached: true });
    expect(view.proteinDaysBelow).toBe(3);
  });
  it('jour sans repas : pas de totaux, rien d’inventé', () => {
    const view = nutritionDayView(new Map(), '2026-01-10', 144, 2500);
    expect(view.day).toBeNull();
    expect(view.protein.reached).toBeNull();
    expect(nutritionReminder(view)).toBeNull();
  });
  it('rappel du matin : protéines sous la cible', () => {
    const view = nutritionDayView(days([[10, 100, 2500]]), '2026-01-10', 144, 2500);
    expect(nutritionReminder(view)).toBe('Hier : protéines 100 g sur 144 g.');
  });
  it('rappel du matin : calories à plus de 10 % de la cible, au-dessus ou en dessous', () => {
    expect(nutritionReminder(nutritionDayView(days([[10, 150, 2900]]), '2026-01-10', 144, 2500))).toBe(
      'Hier : 2900 kcal pour une cible de 2500.',
    );
    expect(nutritionReminder(nutritionDayView(days([[10, 150, 2000]]), '2026-01-10', 144, 2500))).toContain('2000 kcal');
    expect(nutritionReminder(nutritionDayView(days([[10, 150, 2600]]), '2026-01-10', 144, 2500))).toBeNull();
  });
});
