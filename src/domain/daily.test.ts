import { at, ORIGIN } from './__fixtures__/nights';
import { parseWeight, stepsByDay, weightByDay, type WeightEntry } from './daily';

describe('lecture du poids saisi', () => {
  it('accepte la virgule ou le point, arrondit au dixième', () => {
    expect(parseWeight('78,4')).toBe(78.4);
    expect(parseWeight(' 78.46 ')).toBe(78.5);
    expect(parseWeight('80')).toBe(80);
  });
  it('champ vide : pas de poids', () => {
    expect(parseWeight('')).toBeNull();
  });
  it('refuse le texte et les valeurs non plausibles', () => {
    expect(parseWeight('abc')).toBe('invalid');
    expect(parseWeight('7,8,4')).toBe('invalid');
    expect(parseWeight('8')).toBe('invalid');
    expect(parseWeight('780')).toBe('invalid');
  });
});

const zepp = (time: number, kg: number): WeightEntry => ({ time, kg, source: 'health_connect', origin: ORIGIN });
const manual = (time: number, kg: number): WeightEntry => ({ time, kg, source: 'manual', origin: 'saisie' });

describe('poids du jour', () => {
  it('la saisie manuelle fait foi, même si Zepp a une pesée le même jour', () => {
    const day = weightByDay([zepp(at(2026, 1, 10, 7), 80), manual(at(2026, 1, 10, 8), 79)]);
    expect(day.get('2026-01-10')).toMatchObject({ kg: 79, source: 'manual' });
  });
  it('Zepp est retenu les jours sans saisie', () => {
    const day = weightByDay([zepp(at(2026, 1, 11, 7), 80), manual(at(2026, 1, 10, 8), 79)]);
    expect(day.get('2026-01-11')).toMatchObject({ kg: 80, source: 'health_connect' });
  });
  it('jamais de moyenne : une seule valeur retenue', () => {
    const day = weightByDay([zepp(at(2026, 1, 10, 7), 80), manual(at(2026, 1, 10, 8), 78)]);
    expect(day.get('2026-01-10')?.kg).toBe(78);
  });
  it('Zepp : la première pesée du jour ; saisie : la plus récente', () => {
    const day = weightByDay([
      zepp(at(2026, 1, 11, 19), 81),
      zepp(at(2026, 1, 11, 7), 80),
      manual(at(2026, 1, 12, 7), 79),
      manual(at(2026, 1, 12, 9), 79.5),
    ]);
    expect(day.get('2026-01-11')?.kg).toBe(80);
    expect(day.get('2026-01-12')?.kg).toBe(79.5);
  });
});

describe('pas du jour', () => {
  it('additionne les enregistrements d’un même jour', () => {
    const days = stepsByDay([
      { start: at(2026, 1, 10, 9), end: at(2026, 1, 10, 10), count: 1000, origin: ORIGIN },
      { start: at(2026, 1, 10, 18), end: at(2026, 1, 10, 19), count: 500, origin: ORIGIN },
      { start: at(2026, 1, 11, 9), end: at(2026, 1, 11, 10), count: 200, origin: ORIGIN },
    ]);
    expect(days.get('2026-01-10')).toBe(1500);
    expect(days.get('2026-01-11')).toBe(200);
  });
});
