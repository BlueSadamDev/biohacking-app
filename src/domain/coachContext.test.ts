import { COACH_NIGHTS, COACH_TODAY, coachInputs } from './__fixtures__/coach';
import { series } from './__fixtures__/nights';
import { buildCoachContext, fr, type SectionKey } from './coachContext';
import { buildRecap } from './recap';
import { targetProgress } from './nutrition';

const lineOf = (key: SectionKey, ctx = buildCoachContext(coachInputs())) => ctx.sections.find((s) => s.key === key)!.line;

describe('résumé chiffré du coach', () => {
  it('contient toutes les rubriques, dans l’ordre', () => {
    const ctx = buildCoachContext(coachInputs());
    expect(ctx.sections.map((s) => s.key)).toEqual([
      'calibration',
      'recovery',
      'sleep',
      'hrv',
      'restingHr',
      'load',
      'zone2',
      'nutrition',
      'strength',
      'weight',
      'alerts',
      'links',
      'period',
      'behaviors',
    ]);
    expect(ctx.text.startsWith(`Résumé de mes données calculé par l’app Aube (au ${COACH_TODAY})`)).toBe(true);
  });

  it('écrit les nombres à la française', () => {
    expect(fr(6.4)).toBe('6,4');
    expect(fr(7)).toBe('7');
    expect(fr(1.4249, 2)).toBe('1,42');
  });

  it('donne les verdicts du sommeil déjà calculés', () => {
    const line = lineOf('sleep');
    expect(line).toContain('6,4 h par nuit en moyenne sur 7 jours, 7,2 h sur 30 jours');
    expect(line).toContain('3 nuits sous 6 h sur les 7 dernières');
    expect(line).toContain('sous la durée visée de 7,5 h');
    expect(line).toContain('en baisse par rapport à d’habitude');
  });

  it('situe la HRV par rapport à la norme', () => {
    const line = lineOf('hrv');
    expect(line).toMatch(/\d+ ms en moyenne sur 7 jours/);
    expect(line).toContain('norme de 46 à 52 ms');
    expect(line).toContain('sous ta norme');
  });

  it('compare la FC au repos à la moyenne 30 jours', () => {
    expect(lineOf('restingHr')).toMatch(/56 bpm cette nuit, moyenne 5\d bpm sur 30 jours, \d bpm au-dessus de ta moyenne/);
  });

  it('donne la charge de la semaine en pourcentage, son verdict et les seuils', () => {
    expect(lineOf('load')).toContain(
      'tu t’entraînes 42 % de plus que d’habitude, charge en hausse (équilibrée entre −20 % et +30 % par rapport à ton rythme habituel, trop élevée au-delà de +50 %)',
    );
  });

  it('dit que les protéines sont sous la cible, avec le compte sur 7 jours', () => {
    const line = lineOf('nutrition');
    expect(line).toContain('protéines hier : 118 g pour une cible de 140 g (sous la cible)');
    expect(line).toContain('protéines dans la cible 3 jours sur 7 jours avec repas (7 derniers jours), sous la cible 4 jours');
  });

  it('reprend la zone 2, la force, le poids, les alertes et les liens', () => {
    expect(lineOf('zone2')).toContain('45 min en zone 2 pour 120 min visées (sous la cible)');
    expect(lineOf('strength')).toContain('développé couché 84 kg (stagnation, pas de record depuis 6 semaines)');
    expect(lineOf('weight')).toContain('78,4 kg en moyenne sur 7 jours, en hausse lente (0,18 kg par semaine)');
    expect(lineOf('alerts')).toContain('« Charge en hausse » (À surveiller');
    expect(lineOf('links')).toContain('lien modéré (34 jours comparés)');
  });

  it('écrit « non disponible » au lieu d’inventer une valeur', () => {
    const ctx = buildCoachContext(
      coachInputs({
        load: null,
        nutrition: null,
        week: null,
        strength: [],
        body: null,
        alerts: [],
        links: [],
      }),
    );
    for (const key of ['load', 'zone2', 'nutrition', 'strength', 'weight'] as SectionKey[]) {
      const s = ctx.sections.find((x) => x.key === key)!;
      expect(s.available).toBe(false);
      expect(s.line).toContain('non disponible');
    }
    expect(lineOf('alerts', ctx)).toContain('aucune');
    expect(lineOf('links', ctx)).toContain('aucun lien');
  });

  it('signale un jour sans repas sans écrire 0', () => {
    const ctx = buildCoachContext(
      coachInputs({
        nutrition: {
          date: '2026-11-07',
          day: null,
          protein: targetProgress(null, 140),
          calories: targetProgress(null, 2600),
          proteinDaysBelow: 0,
          proteinDaysKnown: 0,
        },
      }),
    );
    expect(lineOf('nutrition', ctx)).toContain('aucun repas enregistré sur les 7 derniers jours');
    expect(ctx.sections.find((s) => s.key === 'nutrition')!.available).toBe(false);
  });

  it('explique une cible de protéines ou de calories manquante au lieu de compter 0 jour', () => {
    const ctx = buildCoachContext(
      coachInputs({
        nutrition: {
          ...coachInputs().nutrition!,
          protein: targetProgress(108, null),
          calories: targetProgress(2500, null),
          proteinDaysBelow: 0,
          proteinDaysKnown: 0,
        },
      }),
    );
    const n = ctx.sections.find((s) => s.key === 'nutrition')!;
    expect(n.line).toContain('protéines hier : 108 g, cible de protéines non calculable : il faut une pesée récente');
    expect(n.line).toContain('cible de calories pas encore indiquée dans les Réglages');
    expect(n.line).not.toContain('0 jour');
    expect(n.values.proteinDaysBelow7d).toBeNull();
  });

  it('ne donne pas de verdict protéines sur la semaine avec trop peu de jours de repas', () => {
    const ctx = buildCoachContext(coachInputs({ nutrition: { ...coachInputs().nutrition!, proteinDaysBelow: 0, proteinDaysKnown: 2 } }));
    const n = ctx.sections.find((s) => s.key === 'nutrition')!;
    expect(n.line).toContain('repas enregistrés seulement 2 jours sur 7 : pas de verdict sur la semaine');
    expect(n.values.proteinDaysBelow7d).toBeNull();
  });

  it('signale la calibration en cours et ne juge pas la HRV', () => {
    const nights = series(COACH_TODAY, 10);
    const ctx = buildCoachContext(coachInputs({ nights, recap: buildRecap(nights, COACH_TODAY) }));
    expect(ctx.calibrating).toBe(true);
    expect(lineOf('calibration', ctx)).toContain('en cours');
    expect(lineOf('hrv', ctx)).not.toContain('norme de');
  });

  it('ne reprend que les alertes des 7 derniers jours', () => {
    const old = { ...coachInputs().alerts[0], date: '2026-10-20', title: 'Ancienne alerte' };
    expect(lineOf('alerts', buildCoachContext(coachInputs({ alerts: [old] })))).toContain('aucune');
  });

  it('liste tous les nombres du texte comme nombres autorisés', () => {
    const ctx = buildCoachContext(coachInputs());
    for (const n of [1.42, 118, 140, 4, 45, 120, 84, 78.4, 34]) expect(ctx.numbers).toContain(n);
    expect(new Set(ctx.numbers).size).toBe(ctx.numbers.length);
  });

  it('garde les valeurs brutes dans l’objet JSON', () => {
    const ctx = buildCoachContext(coachInputs());
    const nutrition = ctx.sections.find((s) => s.key === 'nutrition')!;
    expect(nutrition.values).toMatchObject({ proteinG: 118, proteinTargetG: 140, proteinReached: false, proteinDaysBelow7d: 4 });
    expect(JSON.parse(JSON.stringify(ctx)).sections).toHaveLength(14);
    expect(COACH_NIGHTS).toHaveLength(60);
  });
});
