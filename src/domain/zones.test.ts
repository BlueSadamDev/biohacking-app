// Tests des zones cardiaques, sur données fictives.

import { session, steadyHr } from './__fixtures__/exercises';
import { startOfWeek } from './dates';
import { sessionZones, weekActivity, zoneOf } from './zones';

const MINUTE = 60 * 1000;
const HR_MAX = 200;
/** Jeudi 12 novembre 2026, 18 h (heure locale). */
const THURSDAY = new Date(2026, 10, 12, 18).getTime();

describe('zoneOf', () => {
  it('range une FC dans la zone de sa part de la FC max', () => {
    expect(zoneOf(100, HR_MAX)).toBe(1); // 50 %
    expect(zoneOf(119, HR_MAX)).toBe(1); // 59,5 %
    expect(zoneOf(120, HR_MAX)).toBe(2); // 60 %
    expect(zoneOf(139, HR_MAX)).toBe(2);
    expect(zoneOf(140, HR_MAX)).toBe(3);
    expect(zoneOf(160, HR_MAX)).toBe(4);
    expect(zoneOf(180, HR_MAX)).toBe(5);
    expect(zoneOf(80, HR_MAX)).toBe(1); // sous 50 % : zone 1
  });
});

describe('sessionZones', () => {
  it('compte les minutes passées dans chaque zone', () => {
    const s = session('a', THURSDAY, 40);
    const samples = [...steadyHr(THURSDAY, 30, 130), ...steadyHr(THURSDAY + 30 * MINUTE, 10, 165)];
    const zones = sessionZones(s, samples, HR_MAX)!;
    expect(zones[1]).toBeCloseTo(30);
    expect(zones[3]).toBeCloseTo(10);
    expect(zones[0] + zones[2] + zones[4]).toBe(0);
  });

  it('ne compte pas plus de 2 minutes pour une mesure isolée (trou de mesure)', () => {
    const s = session('a', THURSDAY, 20);
    // Une mesure toutes les 2 min 30 (8 mesures) : chacune compte 2 minutes au plus.
    const zones = sessionZones(s, steadyHr(THURSDAY, 20, 130, 150), HR_MAX)!;
    expect(zones[1]).toBeCloseTo(16);
  });

  it('renvoie null si la FC est insuffisante', () => {
    const s = session('a', THURSDAY, 60);
    expect(sessionZones(s, steadyHr(THURSDAY, 3, 130), HR_MAX)).toBeNull(); // 3 mesures
    expect(sessionZones(s, steadyHr(THURSDAY, 20, 130), HR_MAX)).toBeNull(); // 1/3 de la séance couverte
  });
});

describe('weekActivity', () => {
  const today = '2026-11-12';
  const monday = new Date(2026, 10, 9, 18).getTime();
  const lastSunday = new Date(2026, 10, 8, 18).getTime();
  const sessions = [session('lundi', monday, 60), session('jeudi', THURSDAY, 45), session('avant', lastSunday, 60)];
  const samples = [...steadyHr(monday, 60, 130), ...steadyHr(lastSunday, 60, 130)]; // jeudi : pas de FC

  it('travaille du lundi au dimanche', () => {
    expect(startOfWeek(today)).toBe('2026-11-09');
    expect(startOfWeek('2026-11-15')).toBe('2026-11-09'); // dimanche
    expect(startOfWeek('2026-11-09')).toBe('2026-11-09'); // lundi
  });

  it('additionne les séances de la semaine et compare la zone 2 à la cible', () => {
    const week = weekActivity(sessions, samples, HR_MAX, 120, today);
    expect(week.weekStart).toBe('2026-11-09');
    expect(week.weekEnd).toBe('2026-11-15');
    expect(week.sessions).toBe(2);
    expect(week.activeMinutes).toBeCloseTo(105);
    expect(week.zone2Minutes).toBeCloseTo(60);
    expect(week.sessionsWithoutHr).toBe(1);
    expect(week.zone2Reached).toBe(false);
    expect(weekActivity(sessions, samples, HR_MAX, 60, today).zone2Reached).toBe(true);
  });

  it("n'invente pas de zones sans FC max", () => {
    const week = weekActivity(sessions, samples, null, 120, today);
    expect(week.zones).toBeNull();
    expect(week.zone2Reached).toBeNull();
    expect(week.sessions).toBe(2);
  });
});
