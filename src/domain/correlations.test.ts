// Tests des liens observés (onglet Tendances), sur données fictives.

import { session } from './__fixtures__/exercises';
import { series } from './__fixtures__/nights';
import { cohenD, evaluatePair, findLinks, PAIRS, strengthOf, type CorrelationInputs, type Observation } from './correlations';
import type { DailyWeight } from './daily';
import { addDays } from './dates';
import type { ExerciseSession } from './load';
import type { NightOptions } from './__fixtures__/nights';
import type { DayNutrition } from './nutrition';

const TODAY = '2026-11-12';
const DAYS = 90;
const dayAt = (i: number) => addDays(TODAY, -(DAYS - 1 - i)); // i = 0 : il y a 89 jours
const time = (date: string, hour: number) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, hour).getTime();
};
/** Petite variation déterministe, pour que les groupes ne soient pas constants. */
const wobble = (i: number) => (i % 3) - 1;

const base = (over: Partial<CorrelationInputs> = {}): CorrelationInputs => ({
  nights: series(TODAY, DAYS),
  sessions: [],
  dailyLoad: null,
  steps: new Map(),
  nutrition: new Map(),
  weights: new Map(),
  proteinGPerKg: 1.8,
  today: TODAY,
  ...over,
});

/** Séance chaque jour ; `late(i)` : à 21 h (sinon 18 h). La HRV de la nuit suivante vaut `hrv(i)`. */
function sessionsAndNights(late: (i: number) => boolean, hrv: (i: number, late: boolean) => number) {
  const sessions: ExerciseSession[] = [];
  const opts: NightOptions[] = Array.from({ length: DAYS }, () => ({ hrvMs: 50 }));
  for (let i = 0; i < DAYS - 1; i++) {
    const l = late(i);
    sessions.push(session(`s${i}`, time(dayAt(i), l ? 21 : 18), 60));
    opts[i + 1] = { hrvMs: hrv(i, l) };
  }
  return { sessions, nights: series(TODAY, DAYS, (i) => opts[i]) };
}

const latePair = PAIRS.find((p) => p.id === 'late-session-hrv')!;

describe('outils statistiques', () => {
  it('calcule le d de Cohen', () => {
    expect(cohenD([4, 6, 5, 5], [2, 4, 3, 3])).toBeCloseTo(2 / Math.sqrt(2 / 3), 5);
    expect(cohenD([1], [2, 3])).toBeNull(); // pas assez de valeurs
    expect(cohenD([5, 5], [5, 5])).toBeNull(); // aucune dispersion
  });

  it('étiquette la force du lien', () => {
    expect(strengthOf(0.9)).toBe('strong');
    expect(strengthOf(-0.6)).toBe('moderate');
    expect(strengthOf(0.35)).toBe('weak');
    expect(strengthOf(0.2)).toBeNull();
  });
});

describe('séance du soir → HRV de la nuit', () => {
  it('repère un lien fort et défavorable', () => {
    const data = sessionsAndNights((i) => i % 2 === 0, (i, late) => (late ? 42 : 55) + wobble(i));
    const { links } = findLinks(base(data));
    const link = links.find((l) => l.id === 'late-session-hrv')!;
    expect(link.strength).toBe('strong');
    expect(link.favorable).toBe(false);
    expect(link.days).toBe(89);
    expect(link.sentence).toMatch(/^Les soirs de séance après 20 h, ta HRV de la nuit est inférieure de \d+ % en moyenne\.$/);
    expect(link.study.label).toBe('Séance après 20 h');
    expect(link.reference.mean).toBeGreaterThan(link.study.mean);
  });

  it('ne garde pas un lien qui s’inverse entre les deux moitiés de la période', () => {
    // 1re moitié : forte baisse après une séance du soir ; 2e moitié : légère hausse.
    const data = sessionsAndNights((i) => i % 2 === 0, (i, late) => (i < 44 ? (late ? 38 : 58) : late ? 51 : 49) + wobble(i));
    const report = findLinks(base(data));
    expect(report.statuses['late-session-hrv']).toBe('irregular');
    expect(report.links.find((l) => l.id === 'late-session-hrv')).toBeUndefined();
  });

  it('ne garde pas un écart trop faible', () => {
    const data = sessionsAndNights((i) => i % 2 === 0, (i) => 50 + wobble(i) * 3);
    expect(findLinks(base(data)).statuses['late-session-hrv']).toBe('too-weak');
  });
});

describe('pas assez de données', () => {
  it('moins de 20 jours comparables : aucun lien', () => {
    const obs: Observation[] = Array.from({ length: 15 }, (_, i) => ({ date: dayAt(i), study: i % 2 === 0, value: i % 2 ? 40 : 60 }));
    expect(evaluatePair(latePair, { observations: obs, studyLabel: 'a', refLabel: 'b' }).status).toBe('not-enough-days');
  });

  it('moins de 5 jours dans un groupe : aucun lien', () => {
    const obs: Observation[] = Array.from({ length: 30 }, (_, i) => ({ date: dayAt(i), study: i < 4, value: i < 4 ? 40 : 60 + wobble(i) }));
    expect(evaluatePair(latePair, { observations: obs, studyLabel: 'a', refLabel: 'b' }).status).toBe('not-enough-days');
  });

  it('historique vide : aucun lien, toutes les paires « pas assez de jours »', () => {
    const report = findLinks(base({ nights: [] }));
    expect(report.links).toEqual([]);
    expect(Object.values(report.statuses).every((s) => s === 'not-enough-days')).toBe(true);
  });
});

describe('autres paires', () => {
  it('heure de coucher → durée du sommeil (coucher tardif = nuit plus courte)', () => {
    // Nuits fictives : réveil à 7 h, donc une nuit plus courte = un coucher plus tardif.
    const nights = series(TODAY, DAYS, (i) => ({ asleepMinutes: i % 2 ? 420 + wobble(i) * 5 : 480 + wobble(i) * 5 }));
    const link = findLinks(base({ nights })).links.find((l) => l.id === 'bedtime-sleep')!;
    expect(link.favorable).toBe(false);
    expect(link.sentence).toMatch(/^Quand tu te couches après \d+ h \d{2}, tu dors \d+ % de moins en moyenne\.$/);
  });

  it('protéines atteintes → meilleur score de récupération le lendemain', () => {
    const weights = new Map<string, DailyWeight>();
    const nutrition = new Map<string, DayNutrition>();
    const reached = (i: number) => i % 2 === 0;
    for (let i = 0; i < DAYS; i++) {
      const date = dayAt(i);
      weights.set(date, { date, kg: 80, source: 'manual', origin: 'saisie' });
      const protein = reached(i) ? 150 : 90; // cible : 1,8 × 80 = 144 g
      nutrition.set(date, { date, energyKcal: null, proteinG: protein, carbsG: null, fatG: null, meals: 3, origins: ['exemple'] });
    }
    // Nuit suivant un jour « atteint » : sommeil plus long (meilleur score).
    const nights = series(TODAY, DAYS, (i) => ({ asleepMinutes: i > 0 && reached(i - 1) ? 480 + wobble(i) * 5 : 380 + wobble(i) * 5 }));
    const link = findLinks(base({ nights, weights, nutrition })).links.find((l) => l.id === 'protein-recovery')!;
    expect(link.favorable).toBe(true);
    expect(link.sentence).toMatch(/supérieur de \d+ %/);
  });

  it('charge de la veille → HRV (sans profil cardiaque : rien à comparer)', () => {
    expect(findLinks(base()).statuses['load-hrv']).toBe('not-enough-days');
    const dailyLoad = new Map<string, number>();
    for (let i = 0; i < DAYS; i++) dailyLoad.set(dayAt(i), i % 2 ? 150 : 20);
    const nights = series(TODAY, DAYS, (i) => ({ hrvMs: i > 0 && (i - 1) % 2 ? 40 + wobble(i) : 55 + wobble(i) }));
    const link = findLinks(base({ nights, dailyLoad })).links.find((l) => l.id === 'load-hrv')!;
    expect(link.favorable).toBe(false);
    expect(link.study.label).toBe('Veille chargée');
  });

  it('pas → sommeil de la nuit suivante', () => {
    const steps = new Map<string, number>();
    for (let i = 0; i < DAYS; i++) steps.set(dayAt(i), i % 2 ? 14000 : 5000);
    const nights = series(TODAY, DAYS, (i) => ({ asleepMinutes: i > 0 && (i - 1) % 2 ? 470 + wobble(i) * 5 : 420 + wobble(i) * 5 }));
    const link = findLinks(base({ nights, steps })).links.find((l) => l.id === 'steps-sleep')!;
    expect(link.favorable).toBe(true);
    expect(link.sentence).toMatch(/^Les jours à plus de [\d ]+ pas, tu dors \d+ % de plus la nuit suivante\.$/);
  });
});

describe('affichage', () => {
  it('trie du plus fort au plus faible et garde 3 liens au plus', () => {
    const data = sessionsAndNights((i) => i % 2 === 0, (i, late) => (late ? 42 : 55) + wobble(i));
    const steps = new Map<string, number>();
    const dailyLoad = new Map<string, number>();
    for (let i = 0; i < DAYS; i++) {
      steps.set(dayAt(i), i % 2 ? 14000 : 5000);
      dailyLoad.set(dayAt(i), i % 2 ? 150 : 20);
    }
    const { links } = findLinks(base({ ...data, steps, dailyLoad }));
    expect(links.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < links.length; i++) expect(Math.abs(links[i - 1].effect)).toBeGreaterThanOrEqual(Math.abs(links[i].effect));
  });
});
