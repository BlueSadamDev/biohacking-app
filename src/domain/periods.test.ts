// Tests des étiquettes de période (lot 5a, F7), sur données fictives.

import { coachInputs, COACH_TODAY } from './__fixtures__/coach';
import { session, steadyHr } from './__fixtures__/exercises';
import { at, night, series, sleep } from './__fixtures__/nights';
import { evaluateAlerts, type AlertInputs } from './alerts';
import { calibrationStatus } from './calibration';
import { buildCoachContext } from './coachContext';
import { findLinks } from './correlations';
import { addDays } from './dates';
import { computeNights } from './nightly';
import { notificationText } from './notification';
import {
  isTaggedDay,
  openPeriod,
  periodOn,
  shouldRemindPeriod,
  sinceLabel,
  taggedDaysBetween,
  untaggedDaysBack,
  validatePeriod,
  withoutTaggedNights,
  type Period,
} from './periods';
import { buildRecap } from './recap';
import { weeklySuggestions } from './suggestions';
import { periodNote } from './weeklyReview';

const p = (start: string, end: string | null, type: Period['type'] = 'sick', id = `p-${start}`): Period => ({ id, type, start, end });

describe('jour étiqueté', () => {
  const periods = [p('2026-03-10', '2026-03-12')];
  it('début et fin compris, veille et lendemain non', () => {
    expect(isTaggedDay('2026-03-09', periods)).toBe(false);
    expect(isTaggedDay('2026-03-10', periods)).toBe(true);
    expect(isTaggedDay('2026-03-12', periods)).toBe(true);
    expect(isTaggedDay('2026-03-13', periods)).toBe(false);
  });
  it('une période en cours (sans fin) couvre tous les jours depuis son début', () => {
    const open = [p('2026-03-10', null)];
    expect(isTaggedDay('2026-04-30', open)).toBe(true);
    expect(isTaggedDay('2026-03-09', open)).toBe(false);
    expect(openPeriod(open)?.start).toBe('2026-03-10');
  });
  it('compte les jours étiquetés d’une fenêtre', () => {
    expect(taggedDaysBetween('2026-03-08', '2026-03-14', periods)).toBe(3);
  });
  it('libellé « depuis … » du bandeau', () => {
    expect(sinceLabel(p('2026-03-10', null), '2026-03-10')).toBe('depuis aujourd’hui');
    expect(sinceLabel(p('2026-03-10', null), '2026-03-11')).toBe('depuis hier');
    expect(sinceLabel(p('2026-03-10', null), '2026-03-15')).toBe('depuis 5 jours');
  });
});

describe('convention de date d’une nuit (date du réveil)', () => {
  // Période du 10 au 12 mars.
  const periods = [p('2026-03-10', '2026-03-12')];
  const nights = computeNights({
    sleeps: [
      sleep('veille', at(2026, 3, 8, 23), at(2026, 3, 9, 7)), // nuit du 8 au 9 → « nuit du 9 »
      sleep('debut', at(2026, 3, 9, 23), at(2026, 3, 10, 7)), // nuit du 9 au 10 → « nuit du 10 »
      sleep('fin', at(2026, 3, 11, 23), at(2026, 3, 12, 7)), // → « nuit du 12 »
      sleep('apres', at(2026, 3, 12, 23), at(2026, 3, 13, 7)), // nuit du 12 au 13 → « nuit du 13 »
    ],
    hrv: [],
    restingHr: [],
    heartRate: [],
  });

  it('une nuit à cheval sur le début est exclue (elle se termine le 10, jour étiqueté)', () => {
    const kept = withoutTaggedNights(nights, periods).map((n) => n.date);
    expect(kept).not.toContain('2026-03-10');
    expect(kept).toContain('2026-03-09');
  });
  it('une nuit à cheval sur la fin compte de nouveau (elle se termine le 13)', () => {
    const kept = withoutTaggedNights(nights, periods).map((n) => n.date);
    expect(kept).not.toContain('2026-03-12');
    expect(kept).toContain('2026-03-13');
  });
  it('la nuit du jour peut être gardée (score calculé pendant la période)', () => {
    expect(withoutTaggedNights(nights, periods, '2026-03-12').map((n) => n.date)).toContain('2026-03-12');
  });
});

describe('normes et calibration sans les jours étiquetés', () => {
  const TODAY = '2026-03-31';
  // 60 nuits normales (50 ms), sauf 10 nuits très basses (20 ms) pendant une maladie.
  const sick = p('2026-03-01', '2026-03-10');
  const nights = series(TODAY, 60, (i) => {
    const date = addDays(TODAY, i - 59);
    return { hrvMs: isTaggedDay(date, [sick]) ? 20 : 48 + (i % 5), restingHr: 55 };
  });

  it('la plage normale de HRV ignore les nuits de maladie', () => {
    const withTags = buildRecap(nights, TODAY, undefined, [sick]).hrv.baseline!;
    const without = buildRecap(nights, TODAY).hrv.baseline!;
    expect(Math.exp(withTags.mean)).toBeGreaterThan(Math.exp(without.mean));
    expect(withTags.nights).toBe(without.nights - 10);
  });

  it('les jours étiquetés ne comptent pas dans les 28 jours de calibration', () => {
    const recent = series(TODAY, 30); // 30 nuits complètes
    const tagged = [p(addDays(TODAY, -9), addDays(TODAY, -3))]; // 7 nuits étiquetées
    expect(calibrationStatus(recent, TODAY).done).toBe(true);
    const recap = buildRecap(recent, TODAY, undefined, tagged);
    expect(recap.calibration.nights).toBe(23);
    expect(recap.calibration.done).toBe(false);
  });

  it('pendant une période : score calculé, affiché en pause avec la phrase du type, sans couleur', () => {
    const recap = buildRecap(nights, TODAY, undefined, [p('2026-03-30', null, 'travel')]);
    expect(recap.recovery.score).not.toBeNull();
    expect(recap.period?.type).toBe('travel');
    expect(recap.recommendation).toMatchObject({ zone: 'paused', status: 'En pause' });
    expect(recap.recommendation.action).toContain('coucher');
  });

  it('notification du matin pendant une période : pas de score jugé', () => {
    const recap = buildRecap(nights, TODAY, undefined, [p('2026-03-30', null, 'holiday')]);
    const text = notificationText(recap).body;
    expect(text).toContain('en pause');
    expect(text).not.toContain('Récupération');
  });
});

describe('alertes en pause', () => {
  const TODAY = '2026-03-31';
  const loads = new Map<string, number>();
  for (let i = 0; i < 60; i++) loads.set(addDays(TODAY, -i), i < 7 ? 300 : 100); // pic de charge (ratio en moyennes exponentielles ≈ 1,53)
  const base = (periods: Period[]): AlertInputs => ({
    nights: series(TODAY, 60, (i) => ({ hrvMs: i % 2 ? 45 : 55, restingHr: i % 2 ? 54 : 56 })),
    dailyLoad: loads,
    loadHistoryDays: 60,
    weights: new Map(),
    nutrition: new Map(),
    proteinGPerKg: 1.8,
    periods,
    today: TODAY,
  });

  it('période en cours : aucune alerte (rien n’est envoyé ni enregistré)', () => {
    expect(evaluateAlerts(base([p('2026-03-25', null)]))).toEqual([]);
  });
  it('dernier jour de la période : toujours en pause', () => {
    expect(evaluateAlerts(base([p('2026-03-25', TODAY)]))).toEqual([]);
  });
  it('reprise le lendemain de la fin', () => {
    const alerts = evaluateAlerts(base([p('2026-03-25', '2026-03-30')]));
    expect(alerts.map((a) => a.rule)).toContain('load-high');
  });
  it('pas de « sous-charge » au retour de vacances (jours étiquetés hors de la série)', () => {
    const drop = new Map<string, number>();
    for (let i = 0; i < 60; i++) drop.set(addDays(TODAY, -i), i < 20 ? 20 : 100);
    const input = { ...base([]), dailyLoad: drop };
    expect(evaluateAlerts(input).map((a) => a.rule)).toContain('load-under');
    const holiday = [p(addDays(TODAY, -15), addDays(TODAY, -2), 'holiday')];
    expect(evaluateAlerts({ ...input, periods: holiday }).map((a) => a.rule)).not.toContain('load-under');
  });
  it('les nuits de la période ne déclenchent pas d’alerte HRV au retour', () => {
    // 3 nuits basses (il y a 3 jours, avant-hier, hier), nuit de ce matin normale.
    const nights = series(TODAY, 60, (i) => ({ hrvMs: i >= 56 && i <= 58 ? 30 : i % 2 ? 45 : 55, restingHr: 55 }));
    const input = { ...base([]), dailyLoad: null, nights };
    // Ces 3 nuits sont étiquetées (malade) : la moyenne 7 jours ne les voit plus.
    expect(evaluateAlerts({ ...input, periods: [p(addDays(TODAY, -3), addDays(TODAY, -1))] }).map((a) => a.rule)).not.toContain('hrv-low');
    expect(evaluateAlerts(input).map((a) => a.rule)).toContain('hrv-low');
  });
});

describe('liens observés sans les jours étiquetés', () => {
  const TODAY = '2026-11-12';
  it('les jours étiquetés et leurs nuits ne sont pas comparés', () => {
    const time = (date: string, hour: number) => {
      const [y, m, d] = date.split('-').map(Number);
      return new Date(y, m - 1, d, hour).getTime();
    };
    // Séance chaque jour, tard un jour sur deux ; HRV de la nuit suivante plus basse après une séance tardive.
    const sessions = Array.from({ length: 89 }, (_, i) => session(`s${i}`, time(addDays(TODAY, i - 89), i % 2 ? 21 : 18), 60));
    const nights = series(TODAY, 90, (i) => ({ hrvMs: i > 0 && (i - 1) % 2 === 1 ? 40 + (i % 3) : 55 + (i % 3) }));
    const input = { nights, sessions, dailyLoad: null, steps: new Map(), nutrition: new Map(), weights: new Map(), proteinGPerKg: 1.8, today: TODAY };
    const all = findLinks(input).links.find((l) => l.id === 'late-session-hrv')!;
    // 75 jours étiquetés : il ne reste pas assez de jours comparables.
    const tagged = findLinks({ ...input, periods: [p(addDays(TODAY, -85), addDays(TODAY, -11))] });
    expect(all.days).toBeGreaterThanOrEqual(80);
    expect(tagged.statuses['late-session-hrv']).toBe('not-enough-days');
  });
});

describe('suggestions de sports sans les jours étiquetés', () => {
  const TODAY = '2026-11-12';
  const atDay = (daysAgo: number) => {
    const [y, m, d] = addDays(TODAY, -daysAgo).split('-').map(Number);
    return new Date(y, m - 1, d, 18).getTime();
  };
  const z2 = (id: string, daysAgo: number, minutes: number) => ({
    session: { ...session(id, atDay(daysAgo), minutes), exerciseType: 56 },
    samples: steadyHr(atDay(daysAgo), minutes, 130),
  });
  const yoga = { ...session('yoga', atDay(1), 60), exerciseType: 83 };
  const parts = [z2('a', 9, 130)];
  const input = { sessions: [...parts.map((x) => x.session), yoga], samples: parts.flatMap((x) => x.samples), hrMax: 200, zone2Target: 120, today: TODAY };

  it('aucune suggestion pendant une période', () => {
    expect(weeklySuggestions({ ...input, periods: [p(addDays(TODAY, -2), null, 'injury')] })).toBeNull();
  });
  it('après une période, la fenêtre de 7 jours saute les jours étiquetés', () => {
    // Sans période : la séance d'il y a 9 jours est hors fenêtre → manque d'endurance.
    expect(weeklySuggestions(input)?.primary.gap).toBe('endurance');
    // 4 jours étiquetés (il y a 2 à 5 jours) : la fenêtre remonte jusqu'à 10 jours → plus de manque.
    expect(weeklySuggestions({ ...input, periods: [p(addDays(TODAY, -5), addDays(TODAY, -2))] })).toBeNull();
  });
  it('les jours non étiquetés sont comptés du plus récent au plus ancien', () => {
    expect(untaggedDaysBack(TODAY, 3, [p(addDays(TODAY, -1), addDays(TODAY, -1))])).toEqual([TODAY, addDays(TODAY, -2), addDays(TODAY, -3)]);
  });
});

describe('saisie d’une période', () => {
  const TODAY = '2026-03-31';
  it('début jusqu’à 14 jours en arrière, jamais dans le futur', () => {
    expect(validatePeriod(p(addDays(TODAY, -14), null), [], TODAY, { isNew: true })).toBeNull();
    expect(validatePeriod(p(addDays(TODAY, -15), null), [], TODAY, { isNew: true })).toContain('14 jours');
    expect(validatePeriod(p(addDays(TODAY, 1), null), [], TODAY, { isNew: true })).toContain('futur');
  });
  it('modification depuis Mes périodes : une date plus ancienne est permise', () => {
    expect(validatePeriod(p('2026-01-01', '2026-01-05'), [], TODAY, { isNew: false })).toBeNull();
  });
  it('fin avant le début : refusée', () => {
    expect(validatePeriod(p('2026-03-20', '2026-03-19'), [], TODAY, { isNew: false })).toContain('fin');
  });
  it('deux périodes ne se chevauchent pas', () => {
    const others = [p('2026-03-10', '2026-03-15', 'travel', 'autre')];
    expect(validatePeriod(p('2026-03-15', '2026-03-20'), others, TODAY, { isNew: false })).toContain('chevauchent');
    expect(validatePeriod(p('2026-03-16', '2026-03-20'), others, TODAY, { isNew: false })).toBeNull();
  });
  it('une période en cours s’étend sans fin : une seule à la fois', () => {
    const others = [p('2026-03-20', null, 'travel', 'autre')];
    expect(validatePeriod(p('2026-03-25', null), others, TODAY, { isNew: true })).toContain('déjà en cours');
    expect(validatePeriod(p('2026-03-25', '2026-03-26'), others, TODAY, { isNew: true })).toContain('chevauchent');
  });
  it('modifier une période ne la compare pas à elle-même', () => {
    const self = p('2026-03-20', null);
    expect(validatePeriod({ ...self, end: '2026-03-22' }, [self], TODAY, { isNew: false })).toBeNull();
  });
});

describe('rappel au bout de 14 jours', () => {
  const open = p('2026-03-01', null);
  it('envoyé une seule fois, à partir de 14 jours, hors plage silencieuse', () => {
    expect(shouldRemindPeriod(open, false, '2026-03-14', false)).toBe(false);
    expect(shouldRemindPeriod(open, false, '2026-03-15', false)).toBe(true);
    expect(shouldRemindPeriod(open, false, '2026-03-15', true)).toBe(false);
    expect(shouldRemindPeriod(open, true, '2026-03-20', false)).toBe(false);
    expect(shouldRemindPeriod(null, false, '2026-03-20', false)).toBe(false);
  });
  it('période qui couvre un jour', () => {
    expect(periodOn('2026-03-05', [open])?.id).toBe(open.id);
  });
});

describe('coach : période en cours et jours exclus', () => {
  it('le résumé signale la période et le nombre de jours exclus de la semaine', () => {
    const periods = [p(addDays(COACH_TODAY, -2), null, 'travel')];
    const ctx = buildCoachContext(coachInputs({ periods }));
    const line = ctx.sections.find((s) => s.key === 'period')!.line;
    expect(line).toContain('voyage en cours depuis 3 jours');
    expect(line).toContain('3 jours sur les 7 derniers mis à part');
    expect(periodNote(ctx)).toContain('sans compter comme un échec');
  });
  it('sans période : « aucune », et rien à part dans le bilan', () => {
    const ctx = buildCoachContext(coachInputs());
    expect(ctx.sections.find((s) => s.key === 'period')!.line).toBe('Période particulière : aucune.');
    expect(periodNote(ctx)).toBeNull();
  });
});

describe('recap sans période : inchangé', () => {
  it('même score avec ou sans liste de périodes vide', () => {
    const nights = [...series('2026-02-28', 60), night('2026-03-01')];
    expect(buildRecap(nights, '2026-03-01', undefined, []).recovery.score).toBe(buildRecap(nights, '2026-03-01').recovery.score);
  });
});
