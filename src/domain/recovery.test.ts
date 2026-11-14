import { night, series } from './__fixtures__/nights';
import { computeRecovery, type Recovery } from './recovery';
import { SETTINGS } from './settings';

const TODAY = '2026-03-01';
// Historique fictif : HRV qui alterne 40 / 60 ms, FC au repos 50 bpm.
const history = series('2026-02-28', 60, (i) => ({ hrvMs: i % 2 ? 60 : 40, restingHr: 50 }));
const part = (r: Recovery, key: string) => r.components.find((c) => c.key === key)!;

describe('score de récupération', () => {
  it('pondérations de départ : HRV 50 / FC au repos 25 / sommeil 25', () => {
    expect(SETTINGS.recovery.weights).toEqual({ hrv: 0.5, restingHr: 0.25, sleep: 0.25 });
  });

  it('nuit dans la norme avec 7 h 30 de sommeil : 0,5×70 + 0,25×70 + 0,25×100 = 78', () => {
    const centre = Math.sqrt(40 * 60); // valeur au milieu de la plage (en logarithme)
    const r = computeRecovery([...history, night(TODAY, { hrvMs: centre, restingHr: 50, asleepMinutes: 450 })], TODAY);
    expect(part(r, 'hrv').subScore).toBeCloseTo(70, 5);
    expect(part(r, 'restingHr').subScore).toBe(70);
    expect(part(r, 'sleep').subScore).toBe(100);
    expect(r.score).toBe(78);
    expect(part(r, 'hrv').effect).toBe('neutral');
    expect(part(r, 'sleep').effect).toBe('up');
  });

  it('FC au repos 5 bpm au-dessus de la moyenne : 70 − 5×8 = 30, fait baisser le score', () => {
    const r = computeRecovery([...history, night(TODAY, { hrvMs: 49, restingHr: 55 })], TODAY);
    const rhr = part(r, 'restingHr');
    expect(rhr.subScore).toBe(30);
    expect(rhr.effect).toBe('down');
    expect(rhr.explanation).toBe('FC au repos 5 bpm au-dessus de ta moyenne');
  });

  it('HRV très basse, FC haute et nuit courte : score faible (≤ 33)', () => {
    const r = computeRecovery([...history, night(TODAY, { hrvMs: 20, restingHr: 58, asleepMinutes: 240 })], TODAY);
    expect(part(r, 'hrv').effect).toBe('down');
    expect(part(r, 'hrv').explanation).toBe('HRV de la nuit sous ta plage habituelle');
    expect(r.score!).toBeLessThanOrEqual(33);
  });

  it('les sous-scores restent entre 0 et 100', () => {
    const r = computeRecovery([...history, night(TODAY, { hrvMs: 500, restingHr: 20, asleepMinutes: 900 })], TODAY);
    for (const c of r.components) {
      expect(c.subScore).toBeGreaterThanOrEqual(0);
      expect(c.subScore).toBeLessThanOrEqual(100);
    }
  });

  it('nuit non synchronisée : pas de score, raison affichée', () => {
    const r = computeRecovery(history, TODAY);
    expect(r.score).toBeNull();
    expect(r.missing).toContain('HRV : Nuit non synchronisée');
  });

  it('HRV non calculable : pas de score', () => {
    const r = computeRecovery([...history, night(TODAY, { hrvMs: null })], TODAY);
    expect(r.score).toBeNull();
    expect(r.missing).toEqual(['HRV : Aucune mesure HRV pendant le sommeil']);
  });

  it('sans norme (premiers jours) : pas de score', () => {
    const r = computeRecovery([night(TODAY)], TODAY);
    expect(r.score).toBeNull();
    expect(r.missing).toHaveLength(2);
  });
});
