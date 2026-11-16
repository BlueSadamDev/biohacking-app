import type { Calibration } from './calibration';
import type { Recovery, RecoveryComponent } from './recovery';
import { recommend, zoneOf } from './recommendation';
import { textProblems } from './texts/guard';
import { plainText } from './texts/markup';

const calibrated: Calibration = { nights: 30, required: 28, done: true, label: 'Calibration : 28 / 28 jours' };
const calibrating: Calibration = { nights: 12, required: 28, done: false, label: 'Calibration : 12 / 28 jours' };

function part(key: RecoveryComponent['key'], effect: RecoveryComponent['effect'], sentence: string): RecoveryComponent {
  return { key, label: key, weight: 1 / 3, subScore: 70, effect, explanation: sentence, sentence };
}
function recovery(score: number | null, components: RecoveryComponent[] = [], missing: string[] = [], noNight = false): Recovery {
  return { score, components, missing, noNight };
}

describe('couleur d’état (seuils de DESIGN.md)', () => {
  it.each([
    [100, 'good'],
    [67, 'good'],
    [66, 'mid'],
    [34, 'mid'],
    [33, 'low'],
    [0, 'low'],
  ])('score %i : %s', (score, zone) => {
    expect(zoneOf(score)).toBe(zone);
  });
});

describe('recommandation du jour', () => {
  it('vert : feu vert pour une séance lourde, justifié par ce qui fait monter le score', () => {
    const r = recommend(recovery(80, [part('sleep', 'up', 'Tu as dormi 7 h 45.'), part('hrv', 'neutral', 'x')]), calibrated);
    expect(r).toEqual({
      zone: 'good',
      status: 'En forme',
      action: '*Feu vert* pour une séance lourde aujourd’hui.',
      reason: 'Tu as dormi 7 h 45.',
    });
  });

  it('ambre : séance modérée, justifiée par ce qui fait baisser le score', () => {
    const r = recommend(
      recovery(50, [part('hrv', 'down', 'Ta variabilité cardiaque (HRV) est sous ta norme.'), part('sleep', 'up', 'y')]),
      calibrated,
    );
    expect(r.zone).toBe('mid');
    expect(plainText(r.action)).toBe('Garde une séance modérée ou technique aujourd’hui.');
    expect(r.reason).toBe('Ta variabilité cardiaque (HRV) est sous ta norme.');
  });

  it('corail : journée légère, toutes les raisons qui font baisser le score', () => {
    const r = recommend(
      recovery(20, [part('hrv', 'down', 'HRV basse.'), part('restingHr', 'down', 'FC au repos haute.')]),
      calibrated,
    );
    expect(r.zone).toBe('low');
    expect(plainText(r.action)).toBe('Prends une journée légère : mobilité ou marche.');
    expect(r.reason).toBe('HRV basse. FC au repos haute.');
  });

  it('rien ne s’écarte de la norme : message neutre', () => {
    expect(recommend(recovery(70, [part('hrv', 'neutral', 'x')]), calibrated).reason).toBe(
      'Toutes tes valeurs sont dans ta norme.',
    );
  });

  it('calibration en cours : pas de couleur, et la pastille ne répète pas le « n / 28 » de l’anneau', () => {
    const r = recommend(recovery(20), calibrating);
    expect(r.zone).toBe('neutral');
    expect(r.status).toBe('Norme en construction');
  });

  it('nuit absente : pas de couleur, et rien qui répète la carte « Ouvrir Zepp »', () => {
    const r = recommend(recovery(null, [], ['Ta nuit n’est pas encore arrivée.'], true), calibrated);
    expect(r.zone).toBe('neutral');
    expect(r.status).toBe('Nuit manquante');
    expect(r.reason).toBe('');
  });

  it('nuit présente mais mesure manquante : la raison est dite', () => {
    const r = recommend(recovery(null, [], ['Aucune mesure de fréquence cardiaque pendant ton sommeil.']), calibrated);
    expect(r.status).toBe('Récap incomplet');
    expect(r.reason).toBe('Aucune mesure de fréquence cardiaque pendant ton sommeil.');
  });

  it('tous les textes respectent la charte (DESIGN.md, « Textes »)', () => {
    const all = [
      recommend(recovery(80), calibrated),
      recommend(recovery(50), calibrated),
      recommend(recovery(20), calibrated),
      recommend(recovery(20), calibrating),
      recommend(recovery(null, [], [], true), calibrated),
    ];
    for (const r of all) expect(textProblems(`${r.status} ${r.action} ${r.reason}`)).toEqual([]);
  });
});
