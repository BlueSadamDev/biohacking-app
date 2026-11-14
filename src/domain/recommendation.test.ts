import type { Calibration } from './calibration';
import type { Recovery, RecoveryComponent } from './recovery';
import { recommend, zoneOf } from './recommendation';

const calibrated: Calibration = { nights: 30, required: 28, done: true, label: 'Calibration : 28 / 28 jours' };
const calibrating: Calibration = { nights: 12, required: 28, done: false, label: 'Calibration : 12 / 28 jours' };

function part(key: RecoveryComponent['key'], effect: RecoveryComponent['effect'], explanation: string): RecoveryComponent {
  return { key, label: key, weight: 1 / 3, subScore: 70, effect, explanation };
}
function recovery(score: number | null, components: RecoveryComponent[] = [], missing: string[] = []): Recovery {
  return { score, components, missing };
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
  it('vert : séance lourde OK, justifiée par ce qui fait monter le score', () => {
    const r = recommend(recovery(80, [part('sleep', 'up', '7 h 45 de sommeil'), part('hrv', 'neutral', 'x')]), calibrated);
    expect(r).toEqual({
      zone: 'good',
      status: 'Bonne récupération',
      action: 'Séance lourde OK',
      reason: '7 h 45 de sommeil.',
    });
  });

  it('ambre : séance modérée, justifiée par ce qui fait baisser le score', () => {
    const r = recommend(
      recovery(50, [part('hrv', 'down', 'HRV de la nuit sous ta plage habituelle'), part('sleep', 'up', 'y')]),
      calibrated,
    );
    expect(r.zone).toBe('mid');
    expect(r.action).toBe('Séance modérée ou technique');
    expect(r.reason).toBe('HRV de la nuit sous ta plage habituelle.');
  });

  it('corail : journée légère, toutes les raisons qui font baisser le score', () => {
    const r = recommend(
      recovery(20, [part('hrv', 'down', 'HRV basse'), part('restingHr', 'down', 'FC au repos haute')]),
      calibrated,
    );
    expect(r.zone).toBe('low');
    expect(r.action).toBe('Journée légère : mobilité ou marche');
    expect(r.reason).toBe('HRV basse. FC au repos haute.');
  });

  it('rien ne s’écarte de la norme : message neutre', () => {
    expect(recommend(recovery(70, [part('hrv', 'neutral', 'x')]), calibrated).reason).toBe(
      'Toutes tes valeurs sont dans ta norme.',
    );
  });

  it('calibration en cours : pas de couleur, « n / 28 jours » affiché', () => {
    const r = recommend(recovery(20), calibrating);
    expect(r.zone).toBe('neutral');
    expect(r.status).toBe('Calibration : 12 / 28 jours');
  });

  it('score non calculable : pas de couleur, invite à synchroniser', () => {
    const r = recommend(recovery(null, [], ['HRV : Nuit non synchronisée']), calibrated);
    expect(r.zone).toBe('neutral');
    expect(r.reason).toBe('HRV : Nuit non synchronisée.');
  });
});
