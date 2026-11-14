import { night, series } from './__fixtures__/nights';
import { DEFAULT_TIME, formatTime, nextOccurrences, notificationText, shiftTime } from './notification';
import { buildRecap } from './recap';

describe('heure de la notification', () => {
  it('7 h 30 par défaut', () => {
    expect(formatTime(DEFAULT_TIME)).toBe('7 h 30');
  });
  it('se règle par pas et reste dans la journée', () => {
    expect(shiftTime({ hour: 7, minute: 30 }, 15)).toEqual({ hour: 7, minute: 45 });
    expect(shiftTime({ hour: 23, minute: 45 }, 15)).toEqual({ hour: 0, minute: 0 });
    expect(shiftTime({ hour: 0, minute: 0 }, -15)).toEqual({ hour: 23, minute: 45 });
  });
});

describe('prochains envois', () => {
  const time = { hour: 7, minute: 30 };
  it('avant l’heure : commence aujourd’hui', () => {
    const [first, second] = nextOccurrences(new Date(2026, 0, 10, 6, 0), time, 2);
    expect(first).toEqual(new Date(2026, 0, 10, 7, 30));
    expect(second).toEqual(new Date(2026, 0, 11, 7, 30));
  });
  it('après l’heure : commence demain', () => {
    expect(nextOccurrences(new Date(2026, 0, 10, 7, 30), time, 1)[0]).toEqual(new Date(2026, 0, 11, 7, 30));
  });
  it('passe d’un mois à l’autre', () => {
    const dates = nextOccurrences(new Date(2026, 0, 30, 9, 0), time, 3);
    expect(dates[2]).toEqual(new Date(2026, 1, 2, 7, 30));
  });
});

describe('texte de la notification', () => {
  const TODAY = '2026-03-01';
  const history = series('2026-02-28', 60, (i) => ({ hrvMs: i % 2 ? 60 : 40, restingHr: 50 }));

  it('avec un score : score, état et action', () => {
    const recap = buildRecap([...history, night(TODAY, { hrvMs: 49, restingHr: 50 })], TODAY);
    expect(notificationText(recap)).toEqual({
      title: 'Récap du matin',
      body: `Récupération ${recap.recovery.score} % · Bonne récupération. Séance lourde OK.`,
    });
  });
  it('pendant la calibration : pas de score', () => {
    const recap = buildRecap(series(TODAY, 10), TODAY);
    expect(notificationText(recap).body).toBe('Calibration : 10 / 28 jours. Écoute tes sensations aujourd’hui.');
  });
  it('nuit pas encore synchronisée : invite à ouvrir l’app', () => {
    expect(notificationText(buildRecap(history, TODAY)).body).toMatch(/^Ouvre l’app/);
    expect(notificationText(null).body).toMatch(/^Ouvre l’app/);
  });
  it('regroupe les alertes « À surveiller » et ajoute le rappel nutrition', () => {
    const recap = buildRecap(series(TODAY, 10), TODAY);
    expect(
      notificationText(recap, { watchAlerts: ['HRV basse', 'Sommeil court'], nutritionReminder: 'Hier : protéines 100 g sur 144 g.' }).body,
    ).toBe(
      'Calibration : 10 / 28 jours. Écoute tes sensations aujourd’hui. À surveiller : HRV basse, Sommeil court. Hier : protéines 100 g sur 144 g.',
    );
  });
  it('sans alerte ni rappel : texte inchangé', () => {
    const recap = buildRecap(series(TODAY, 10), TODAY);
    expect(notificationText(recap, { watchAlerts: [], nutritionReminder: null })).toEqual(notificationText(recap));
  });
});
