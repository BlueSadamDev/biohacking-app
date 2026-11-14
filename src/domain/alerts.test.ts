import { meal } from './__fixtures__/meals';
import { at, series } from './__fixtures__/nights';
import { set, weeklySets } from './__fixtures__/strength';
import {
  evaluateAlerts,
  isQuietTime,
  selectAlerts,
  type Alert,
  type AlertInputs,
  type PastAlert,
  type SelectionContext,
} from './alerts';
import type { DailyWeight } from './daily';
import { addDays } from './dates';
import type { NightValue } from './nightly';
import { nutritionByDay } from './nutrition';

const TODAY = '2026-03-31';

/**
 * 60 nuits fictives normales (HRV 45 / 55 ms en alternance, FC au repos 54 / 56, 7 h 30).
 * `last` remplace les valeurs des N dernières nuits.
 */
function nightsWith(last: { count: number; hrvMs?: number; restingHr?: number; asleepMinutes?: number } | null = null): NightValue[] {
  return series(TODAY, 60, (i) => {
    const base = { hrvMs: i % 2 ? 45 : 55, restingHr: i % 2 ? 54 : 56 };
    if (last && i >= 60 - last.count) return { ...base, ...last };
    return base;
  });
}

/** Charge par jour fictive : `value` du jour `fromOffset` au jour `toOffset` (0 = aujourd'hui, −1 = hier…). */
function loads(parts: { from: number; to: number; value: number }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of parts) for (let i = p.from; i <= p.to; i++) map.set(addDays(TODAY, i), p.value);
  return map;
}
const STEADY = loads([{ from: -59, to: 0, value: 100 }]);
// 7 derniers jours à 200 : ratio = 200 / ((7 × 200 + 21 × 100) / 28) = 1,6.
const SPIKE = loads([
  { from: -59, to: -7, value: 100 },
  { from: -6, to: 0, value: 200 },
]);

const base = (over: Partial<AlertInputs> = {}): AlertInputs => ({
  nights: nightsWith(),
  dailyLoad: STEADY,
  loadHistoryDays: 60,
  weights: new Map(),
  nutrition: new Map(),
  proteinGPerKg: 1.8,
  today: TODAY,
  ...over,
});

const rules = (alerts: Alert[]) => alerts.map((a) => a.rule);

describe('aucune alerte quand tout est normal', () => {
  it('nuits dans la norme, charge régulière, pas de poids ni de repas', () => {
    expect(evaluateAlerts(base())).toEqual([]);
  });
});

describe('HRV', () => {
  it('3 nuits d’affilée sous la plage normale : « HRV basse » (à surveiller)', () => {
    const [alert] = evaluateAlerts(base({ nights: nightsWith({ count: 3, hrvMs: 35 }) }));
    expect(alert).toMatchObject({ rule: 'hrv-low', level: 'watch', theme: 'recovery' });
    expect(alert.finding).toContain('3 nuits');
  });
  it('une seule nuit basse : pas d’alerte', () => {
    expect(evaluateAlerts(base({ nights: nightsWith({ count: 1, hrvMs: 35 }) }))).toEqual([]);
  });
  it('chaque alerte a un constat, une cause probable et une action', () => {
    const [alert] = evaluateAlerts(base({ nights: nightsWith({ count: 3, hrvMs: 35 }) }));
    expect(alert.finding.length).toBeGreaterThan(10);
    expect(alert.cause.length).toBeGreaterThan(10);
    expect(alert.action.length).toBeGreaterThan(10);
  });
});

describe('FC au repos', () => {
  it('plus de 5 bpm au-dessus de la moyenne pendant 2 jours : alerte', () => {
    const [alert] = evaluateAlerts(base({ nights: nightsWith({ count: 2, restingHr: 63 }) }));
    expect(alert).toMatchObject({ rule: 'resting-hr-high', level: 'watch' });
  });
  it('un seul jour, ou seulement +5 bpm : pas d’alerte', () => {
    expect(evaluateAlerts(base({ nights: nightsWith({ count: 1, restingHr: 63 }) }))).toEqual([]);
    expect(evaluateAlerts(base({ nights: nightsWith({ count: 2, restingHr: 60 }) }))).toEqual([]);
  });
});

describe('combinaisons', () => {
  const tired = nightsWith({ count: 3, hrvMs: 35, restingHr: 63 });

  it('HRV basse + FC au repos haute + charge élevée : « surcharge » seule (Important)', () => {
    const alerts = evaluateAlerts(base({ nights: tired, dailyLoad: SPIKE }));
    expect(rules(alerts)).toEqual(['overload']);
    expect(alerts[0]).toMatchObject({ level: 'important', theme: 'load' });
  });
  it('mêmes signaux avec une charge normale : « possible début de maladie ou stress »', () => {
    const alerts = evaluateAlerts(base({ nights: tired }));
    expect(rules(alerts)).toEqual(['illness-or-stress']);
    expect(alerts[0]).toMatchObject({ level: 'important', theme: 'recovery' });
  });
  it('charge inconnue (profil incomplet) : traitée comme normale', () => {
    expect(rules(evaluateAlerts(base({ nights: tired, dailyLoad: null })))).toEqual(['illness-or-stress']);
  });
  it('aucun mot de diagnostic médical', () => {
    const text = evaluateAlerts(base({ nights: tired }))
      .map((a) => `${a.title} ${a.finding} ${a.cause} ${a.action}`)
      .join(' ');
    expect(text).not.toMatch(/diagnostic|maladie (grave|cardiaque)|vous êtes malade/i);
  });
});

describe('charge', () => {
  it('ratio au-dessus de 1,5 : « pic de charge » (Important)', () => {
    const alerts = evaluateAlerts(base({ dailyLoad: SPIKE }));
    expect(alerts[0]).toMatchObject({ rule: 'load-high', level: 'important', theme: 'load' });
  });
  it('historique de charge trop court : pas d’alerte de charge', () => {
    expect(evaluateAlerts(base({ dailyLoad: SPIKE, loadHistoryDays: 20 }))).toEqual([]);
  });
  it('ratio sous 0,8 pendant 14 jours : « sous-charge »', () => {
    const drop = loads([
      { from: -59, to: -20, value: 100 },
      { from: -19, to: 0, value: 20 },
    ]);
    expect(rules(evaluateAlerts(base({ dailyLoad: drop })))).toEqual(['load-under']);
  });
  it('sous 0,8 depuis moins de 14 jours : pas encore d’alerte', () => {
    const drop = loads([
      { from: -59, to: -10, value: 100 },
      { from: -9, to: 0, value: 20 },
    ]);
    expect(evaluateAlerts(base({ dailyLoad: drop }))).toEqual([]);
  });
});

describe('sommeil', () => {
  it('moins de 6 h trois nuits sur quatre : alerte', () => {
    expect(rules(evaluateAlerts(base({ nights: nightsWith({ count: 3, asleepMinutes: 300 }) })))).toContain('sleep-short');
  });
  it('deux nuits courtes sur quatre : pas d’alerte', () => {
    expect(rules(evaluateAlerts(base({ nights: nightsWith({ count: 2, asleepMinutes: 300 }) })))).not.toContain('sleep-short');
  });

  /** 7 dernières nuits couchées aux heures données (heure locale, la veille du réveil). */
  function bedtimes(times: [number, number][]): NightValue[] {
    const nights = nightsWith();
    times.forEach(([h, m], i) => {
      const n = nights[nights.length - times.length + i];
      const [y, mo, d] = addDays(n.date, h < 12 ? 0 : -1).split('-').map(Number);
      n.sleep = { ...n.sleep, start: at(y, mo, d, h, m) };
    });
    return nights;
  }
  it('coucher qui varie de plus de 1 h 30 sur la semaine : alerte', () => {
    const nights = bedtimes([[22, 0], [23, 0], [0, 30], [22, 30], [23, 0], [22, 45], [23, 15]]);
    const alert = evaluateAlerts(base({ nights })).find((a) => a.rule === 'bedtime-irregular');
    expect(alert?.finding).toContain('2 h 30');
  });
  it('coucher régulier de part et d’autre de minuit : pas d’alerte', () => {
    const nights = bedtimes([[23, 30], [0, 15], [23, 45], [0, 0], [23, 30], [0, 20], [23, 50]]);
    expect(rules(evaluateAlerts(base({ nights })))).not.toContain('bedtime-irregular');
  });
});

const weightsFrom = (values: [number, number][]): Map<string, DailyWeight> =>
  new Map(values.map(([offset, kg]) => [addDays(TODAY, offset), { date: addDays(TODAY, offset), kg, source: 'manual', origin: 'saisie' }]));

describe('protéines', () => {
  // Poids 80 kg × 1,8 g/kg = cible 144 g ; « sous la cible » = moins de 90 % (129,6 g).
  const weights = weightsFrom([[0, 80]]);
  const days = (grams: (number | null)[]) =>
    nutritionByDay(grams.flatMap((g, i) => (g === null ? [] : [meal(at(2026, 3, 30 - i, 12), { proteinG: g })])));

  it('sous la cible plus de 3 jours sur les 7 derniers : alerte', () => {
    const alerts = evaluateAlerts(base({ weights, nutrition: days([100, 100, 100, 100, 150, 150, 150]) }));
    expect(alerts.find((a) => a.rule === 'protein-low')).toMatchObject({ theme: 'nutrition', level: 'watch' });
  });
  it('3 jours sur 7 : pas d’alerte', () => {
    expect(evaluateAlerts(base({ weights, nutrition: days([100, 100, 100, 150, 150, 150, 150]) }))).toEqual([]);
  });
  it('les jours sans repas ne comptent pas comme « sous la cible »', () => {
    expect(evaluateAlerts(base({ weights, nutrition: days([100, 100, 100, null, null, null, null]) }))).toEqual([]);
  });
  it('sans poids connu : pas de cible, pas d’alerte', () => {
    expect(evaluateAlerts(base({ nutrition: days([100, 100, 100, 100, 100, 100, 100]) }))).toEqual([]);
  });
});

describe('poids', () => {
  it('prise de plus de 0,35 kg par semaine sur 3 semaines : alerte', () => {
    const alert = evaluateAlerts(base({ weights: weightsFrom([[-21, 78], [0, 80]]) }))[0];
    expect(alert).toMatchObject({ rule: 'weight-trend', title: 'Prise de poids rapide', theme: 'nutrition' });
  });
  it('perte de plus de 0,75 kg par semaine : alerte', () => {
    expect(evaluateAlerts(base({ weights: weightsFrom([[-21, 80], [0, 77]]) }))[0].title).toBe('Perte de poids rapide');
  });
  it('variation lente : pas d’alerte', () => {
    expect(evaluateAlerts(base({ weights: weightsFrom([[-21, 79.5], [0, 80]]) }))).toEqual([]);
  });
});

describe('force (lot 3)', () => {
  it('stagnation sur 6 semaines : alerte « changer de programme »', () => {
    // Record fictif à 110 kg il y a 10 semaines, puis 105 kg chaque semaine.
    const strength = [set(addDays(TODAY, -70), 'bench', 110, 5), ...weeklySets(TODAY, 'bench', 8, () => 105)];
    const alert = evaluateAlerts(base({ strength }))[0];
    expect(alert).toMatchObject({ rule: 'strength-stagnation', theme: 'load', level: 'watch', title: 'Force qui stagne' });
    expect(alert.finding).toContain('développé couché');
  });
  it('force en hausse : pas d’alerte', () => {
    const strength = weeklySets(TODAY, 'squat', 10, (i) => 100 + 2.5 * i);
    expect(evaluateAlerts(base({ strength }))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

function alert(rule: Alert['rule'], level: Alert['level'] = 'watch'): Alert {
  return { id: `${rule}-${TODAY}`, rule, date: TODAY, level, theme: 'recovery', title: 't', finding: 'f', cause: 'c', action: 'a' };
}
const ctx = (over: Partial<SelectionContext> = {}): SelectionContext => ({
  calibrationDone: true,
  alertsEnabled: true,
  history: [],
  today: TODAY,
  now: { hour: 9, minute: 0 },
  quietStart: { hour: 22, minute: 0 },
  quietEnd: { hour: 7, minute: 0 },
  ...over,
});
const past = (rule: Alert['rule'], daysAgo: number, level: Alert['level'] = 'watch'): PastAlert => ({
  rule,
  level,
  date: addDays(TODAY, -daysAgo),
});

describe('sélection des alertes', () => {
  const three = [alert('sleep-short'), alert('load-high', 'important'), alert('hrv-low')];

  it('aucune alerte pendant la calibration', () => {
    expect(selectAlerts(three, ctx({ calibrationDone: false }))).toEqual([]);
  });
  it('aucune alerte si l’interrupteur « Alertes » est coupé', () => {
    expect(selectAlerts(three, ctx({ alertsEnabled: false }))).toEqual([]);
  });
  it('au plus 2 par jour, les plus importantes d’abord', () => {
    expect(selectAlerts(three, ctx()).map((a) => a.rule)).toEqual(['load-high', 'hrv-low']);
  });
  it('compte celles déjà enregistrées aujourd’hui', () => {
    expect(selectAlerts(three, ctx({ history: [past('protein-low', 0)] }))).toHaveLength(1);
    expect(selectAlerts(three, ctx({ history: [past('protein-low', 0), past('weight-trend', 0)] }))).toEqual([]);
  });
  it('pas de répétition de la même règle pendant 3 jours', () => {
    expect(selectAlerts([alert('hrv-low')], ctx({ history: [past('hrv-low', 2)] }))).toEqual([]);
    expect(selectAlerts([alert('hrv-low')], ctx({ history: [past('hrv-low', 3)] }))).toHaveLength(1);
  });
  it('sauf si elle s’aggrave (niveau supérieur)', () => {
    expect(selectAlerts([alert('hrv-low', 'important')], ctx({ history: [past('hrv-low', 1)] }))).toHaveLength(1);
  });

  it('la stagnation de la force n’est pas répétée pendant 14 jours', () => {
    expect(selectAlerts([alert('strength-stagnation')], ctx({ history: [past('strength-stagnation', 10)] }))).toEqual([]);
    expect(selectAlerts([alert('strength-stagnation')], ctx({ history: [past('strength-stagnation', 14)] }))).toHaveLength(1);
  });
  it('Important : notification immédiate ; À surveiller : dans le récap du matin', () => {
    const [a, b] = selectAlerts([alert('load-high', 'important'), alert('hrv-low')], ctx());
    expect(a.delivery).toBe('now');
    expect(b.delivery).toBe('recap');
  });
  it('pendant la plage silencieuse, même une alerte Important attend le récap', () => {
    const [a] = selectAlerts([alert('load-high', 'important')], ctx({ now: { hour: 23, minute: 0 } }));
    expect(a.delivery).toBe('recap');
  });
  it('alerte qui revient souvent (3 fois en 14 jours) : marquée « persistante »', () => {
    const history = [past('hrv-low', 4), past('hrv-low', 8)];
    expect(selectAlerts([alert('hrv-low')], ctx({ history }))[0].persistent).toBe(true);
    expect(selectAlerts([alert('hrv-low')], ctx({ history: [past('hrv-low', 4)] }))[0].persistent).toBe(false);
  });
});

describe('plage silencieuse', () => {
  const s = { hour: 22, minute: 0 };
  const e = { hour: 7, minute: 0 };
  it('22:00 – 7:00 passe minuit', () => {
    expect(isQuietTime({ hour: 22, minute: 0 }, s, e)).toBe(true);
    expect(isQuietTime({ hour: 3, minute: 0 }, s, e)).toBe(true);
    expect(isQuietTime({ hour: 7, minute: 0 }, s, e)).toBe(false);
    expect(isQuietTime({ hour: 12, minute: 0 }, s, e)).toBe(false);
  });
  it('plage dans la journée (13:00 – 14:00)', () => {
    expect(isQuietTime({ hour: 13, minute: 30 }, { hour: 13, minute: 0 }, { hour: 14, minute: 0 })).toBe(true);
    expect(isQuietTime({ hour: 15, minute: 0 }, { hour: 13, minute: 0 }, { hour: 14, minute: 0 })).toBe(false);
  });
});
