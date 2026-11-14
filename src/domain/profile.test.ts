import type { DailyWeight } from './daily';
import {
  averageWeight,
  defaultUserSettings,
  effectiveHrMax,
  estimateHrMax,
  parseBirthYear,
  parseNumber,
  proteinTargetGrams,
  trimpCoefficient,
} from './profile';

const NOW = new Date(2026, 0, 15);

describe('valeurs par défaut des réglages', () => {
  it('protéines 1,8 g/kg, 4 séances, récap 7:30, silence 22:00 – 7:00, alertes activées', () => {
    expect(defaultUserSettings()).toMatchObject({
      targetWeightKg: null,
      proteinGPerKg: 1.8,
      caloriesKcal: null,
      sessionsPerWeek: 4,
      sex: null,
      hrMaxBpm: null,
      notificationTime: { hour: 7, minute: 30 },
      quietStart: { hour: 22, minute: 0 },
      quietEnd: { hour: 7, minute: 0 },
      alertsEnabled: true,
    });
  });
});

describe('lecture des champs numériques', () => {
  it('accepte la virgule ou le point et arrondit', () => {
    expect(parseNumber('1,8', 0.5, 4, 1)).toBe(1.8);
    expect(parseNumber('2.04', 0.5, 4, 1)).toBe(2);
    expect(parseNumber(' 2500 ', 800, 6000)).toBe(2500);
  });
  it('champ vide = pas de valeur', () => {
    expect(parseNumber('', 0, 10)).toBeNull();
  });
  it('refuse le texte et les valeurs hors limites', () => {
    expect(parseNumber('abc', 0, 10)).toBe('invalid');
    expect(parseNumber('11', 0, 10)).toBe('invalid');
    expect(parseNumber('-1', 0, 10)).toBe('invalid');
  });
  it('année de naissance : âge plausible seulement', () => {
    expect(parseBirthYear('1990', NOW)).toBe(1990);
    expect(parseBirthYear('2025', NOW)).toBe('invalid');
    expect(parseBirthYear('1900', NOW)).toBe('invalid');
  });
});

describe('FC max', () => {
  it('estimée par la formule 208 − 0,7 × âge', () => {
    // 36 ans en 2026 : 208 − 25,2 = 182,8 → 183
    expect(estimateHrMax(1990, NOW)).toBe(183);
  });
  it("sans année de naissance : pas d'estimation", () => {
    expect(estimateHrMax(null, NOW)).toBeNull();
    expect(effectiveHrMax({ hrMaxBpm: null, birthYear: null }, NOW)).toBeNull();
  });
  it("la valeur saisie fait foi sur l'estimation", () => {
    expect(effectiveHrMax({ hrMaxBpm: 190, birthYear: 1990 }, NOW)).toEqual({ bpm: 190, source: 'manual' });
    expect(effectiveHrMax({ hrMaxBpm: null, birthYear: 1990 }, NOW)).toEqual({ bpm: 183, source: 'estimated' });
  });
});

describe('coefficient du TRIMP', () => {
  it('1,92 (homme), 1,67 (femme), aucun tant que le sexe est à définir', () => {
    expect(trimpCoefficient('male')).toBe(1.92);
    expect(trimpCoefficient('female')).toBe(1.67);
    expect(trimpCoefficient(null)).toBeNull();
  });
});

const w = (date: string, kg: number): [string, DailyWeight] => [date, { date, kg, source: 'manual', origin: 'saisie' }];

describe('cible de protéines', () => {
  it('poids moyen sur les 7 derniers jours qui ont une pesée', () => {
    const weights = new Map([w('2026-01-15', 80), w('2026-01-12', 78), w('2026-01-08', 70)]);
    // Le 8 janvier est hors des 7 jours (9 → 15).
    expect(averageWeight(weights, '2026-01-15')).toBe(79);
  });
  it('sans pesée récente : pas de poids moyen', () => {
    expect(averageWeight(new Map([w('2026-01-01', 80)]), '2026-01-15')).toBeNull();
  });
  it('grammes par jour = g/kg × poids moyen, arrondi', () => {
    expect(proteinTargetGrams(1.8, 79)).toBe(142);
    expect(proteinTargetGrams(1.8, null)).toBeNull();
  });
});
