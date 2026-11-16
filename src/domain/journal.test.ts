// Tests du journal du matin (lot 5a, F8) et des paires de comportements, sur données fictives.

import { coachInputs } from './__fixtures__/coach';
import { notificationText } from './notification';
import { buildRecap } from './recap';
import { series } from './__fixtures__/nights';
import { buildCoachContext } from './coachContext';
import { behaviorPairs, evaluatePair, findLinks, type CorrelationInputs, type Observation } from './correlations';
import { addDays } from './dates';
import {
  behaviorDayOf,
  behaviorFacts,
  behaviorFactText,
  behaviorStatus,
  editableJournalDates,
  journalRows,
  validateBehaviorName,
  type Behavior,
  type BehaviorLog,
} from './journal';

const TODAY = '2026-11-12';
const B = (id: string, name: string, visible = true, position = 1): Behavior => ({ id, name, visible, position });
const ALCOHOL = B('alcohol', 'Alcool');
const NAP = B('nap', 'Sieste');

/** Journal fictif : jour → { comportement: oui / non }. */
function log(entries: Record<string, Record<string, boolean>>): BehaviorLog {
  return new Map(Object.entries(entries).map(([day, v]) => [day, new Map(Object.entries(v))]));
}

describe('« non » contre « inconnu »', () => {
  it('journal enregistré, comportement non coché : « non »', () => {
    const rows = journalRows('2026-11-12', [ALCOHOL, NAP], new Set(['alcohol']));
    const l = log({ [rows[0].day]: Object.fromEntries(rows.map((r) => [r.behaviorId, r.done])) });
    expect(behaviorStatus(l, '2026-11-11', 'alcohol')).toBe('yes');
    expect(behaviorStatus(l, '2026-11-11', 'nap')).toBe('no');
  });
  it('jour sans journal : « inconnu »', () => {
    expect(behaviorStatus(log({}), '2026-11-11', 'alcohol')).toBe('unknown');
  });
  it('comportement ajouté après coup : « inconnu » sur les jours d’avant, pas « non »', () => {
    const l = log({ '2026-11-10': { alcohol: false } });
    expect(behaviorStatus(l, '2026-11-10', 'sauna')).toBe('unknown');
  });
  it('un comportement coché le matin est enregistré pour la veille', () => {
    expect(behaviorDayOf('2026-11-12')).toBe('2026-11-11');
    expect(journalRows('2026-11-12', [ALCOHOL], new Set(['alcohol']))).toEqual([{ day: '2026-11-11', behaviorId: 'alcohol', done: true }]);
  });
  it('les comportements masqués ne sont pas réécrits', () => {
    const rows = journalRows('2026-11-12', [ALCOHOL], new Set(['nap']));
    expect(rows.map((r) => r.behaviorId)).toEqual(['alcohol']);
  });
});

describe('corrections et liste', () => {
  it('aujourd’hui et les 7 jours précédents sont modifiables', () => {
    const dates = editableJournalDates(TODAY);
    expect(dates).toHaveLength(8);
    expect(dates[0]).toBe(TODAY);
    expect(dates[7]).toBe(addDays(TODAY, -7));
  });
  it('nom : obligatoire, 40 caractères au plus, pas de doublon', () => {
    expect(validateBehaviorName('  ', [])).not.toBeNull();
    expect(validateBehaviorName('x'.repeat(41), [])).toContain('40');
    expect(validateBehaviorName('x'.repeat(40), [])).toBeNull();
    expect(validateBehaviorName('alcool', [ALCOHOL])).toContain('déjà');
    expect(validateBehaviorName('Alcool', [ALCOHOL], 'alcohol')).toBeNull(); // renommer sans changer
  });
});

describe('faits pour le coach', () => {
  it('« Alcool : 2 jours sur 7 », jours inconnus signalés à part', () => {
    const entries: Record<string, Record<string, boolean>> = {};
    for (let i = 1; i <= 7; i++) entries[addDays(TODAY, -i)] = { alcohol: i <= 2, nap: false };
    delete entries[addDays(TODAY, -7)].nap;
    delete entries[addDays(TODAY, -6)].nap;
    const facts = behaviorFacts([ALCOHOL, NAP, B('hidden', 'Masqué', false)], log(entries), TODAY);
    expect(facts.map(behaviorFactText)).toEqual(['Alcool : 2 jours sur 7', 'Sieste : 0 jour sur 5 notés']);
  });
  it('sans journal : « non noté », et le coach dit « aucun journal rempli »', () => {
    const facts = behaviorFacts([ALCOHOL], log({}), TODAY);
    expect(behaviorFactText(facts[0])).toBe('Alcool : non noté');
    const line = buildCoachContext(coachInputs({ behaviors: facts })).sections.find((s) => s.key === 'behaviors')!.line;
    expect(line).toContain('aucun journal rempli');
  });
  it('le résumé du coach liste les comportements sous forme de faits', () => {
    const entries: Record<string, Record<string, boolean>> = {};
    for (let i = 1; i <= 7; i++) entries[addDays(TODAY, -i)] = { alcohol: i === 3 };
    const ctx = buildCoachContext(coachInputs({ today: TODAY, behaviors: behaviorFacts([ALCOHOL], log(entries), TODAY) }));
    expect(ctx.sections.find((s) => s.key === 'behaviors')!.line).toContain('Alcool : 1 jour sur 7');
  });
});

describe('paires de comportements (liens observés)', () => {
  const DAYS = 90;
  /** Jours J (90 derniers) ; comportement « oui » un jour sur trois ; la HRV de la nuit J+1 en dépend. */
  function inputs(opts: { known?: (i: number) => boolean; effect?: number; yes?: (i: number) => boolean } = {}): CorrelationInputs {
    const known = opts.known ?? (() => true);
    const yes = opts.yes ?? ((i: number) => i % 3 === 0);
    const effect = opts.effect ?? 12;
    const entries: Record<string, Record<string, boolean>> = {};
    const dayOf = (i: number) => addDays(TODAY, -(DAYS - 1 - i));
    for (let i = 0; i < DAYS; i++) if (known(i)) entries[dayOf(i)] = { alcohol: yes(i) };
    // Nuit i (date dayOf(i)) : HRV basse si le comportement a eu lieu la veille (jour i − 1).
    const nights = series(TODAY, DAYS, (i) => ({ hrvMs: 55 + ((i * 7) % 5) - (i > 0 && yes(i - 1) ? effect : 0) }));
    return {
      nights,
      sessions: [],
      dailyLoad: null,
      steps: new Map(),
      nutrition: new Map(),
      weights: new Map(),
      proteinGPerKg: 1.8,
      behaviors: [ALCOHOL],
      behaviorLog: log(entries),
      today: TODAY,
    };
  }

  it('chaque comportement affiché donne 3 paires : HRV, sommeil, score du lendemain', () => {
    expect(behaviorPairs([ALCOHOL, NAP]).map((p) => p.id)).toEqual([
      'behavior:alcohol:hrv',
      'behavior:alcohol:sleep',
      'behavior:alcohol:score',
      'behavior:nap:hrv',
      'behavior:nap:sleep',
      'behavior:nap:score',
    ]);
  });

  it('lien net et régulier : affiché, avec une phrase sans vocabulaire médical', () => {
    const report = findLinks(inputs());
    const link = report.links.find((l) => l.id === 'behavior:alcohol:hrv');
    expect(link).toBeDefined();
    expect(link!.favorable).toBe(false);
    expect(link!.sentence).toMatch(/^Les soirs où tu bois de l’alcool, ta HRV de la nuit suivante est \*\d+ % plus basse\* que les autres nuits\.$/);
    expect(link!.study.label).toBe('Avec alcool');
  });

  it('jours inconnus exclus : pas assez de jours comparables', () => {
    const report = findLinks(inputs({ known: (i) => i >= DAYS - 18 }));
    expect(report.statuses['behavior:alcohol:hrv']).toBe('not-enough-days');
  });

  it('moins de 5 jours « oui » : pas assez de jours', () => {
    const report = findLinks(inputs({ yes: (i) => i === 10 || i === 40 || i === 70 }));
    expect(report.statuses['behavior:alcohol:hrv']).toBe('not-enough-days');
  });

  it('seuil plus strict : un lien « faible » est affiché pour une paire du lot 3, pas pour un comportement', () => {
    // Observations fictives : écart modeste (d ≈ 0,4), régulier sur les deux moitiés.
    const observations: Observation[] = Array.from({ length: 60 }, (_, i) => ({
      date: addDays(TODAY, -60 + i),
      study: i % 2 === 0,
      value: (i % 2 === 0 ? 50.55 : 50) + ((i * 7) % 5) - 2,
    }));
    const result = { observations, studyLabel: 'a', refLabel: 'b' };
    const [pair] = behaviorPairs([ALCOHOL]);
    const loose = evaluatePair({ ...pair, strict: false }, result);
    const strict = evaluatePair(pair, result);
    expect(loose.status).toBe('shown');
    expect(loose.link!.strength).toBe('weak');
    expect(strict.status).toBe('too-weak');
  });

  it('seuil plus strict : au moins 3 jours « oui » et 3 « non » dans chaque moitié', () => {
    // Fort écart, mais seulement 2 jours « oui » dans la première moitié.
    const observations: Observation[] = Array.from({ length: 40 }, (_, i) => {
      const study = i < 20 ? i === 3 || i === 9 : i % 3 === 0;
      return { date: addDays(TODAY, -40 + i), study, value: (study ? 40 : 55) + (i % 3) };
    });
    const result = { observations, studyLabel: 'a', refLabel: 'b' };
    const [pair] = behaviorPairs([ALCOHOL]);
    expect(evaluatePair({ ...pair, strict: false }, result).status).toBe('shown');
    expect(evaluatePair(pair, result).status).toBe('irregular');
  });

  it('jours étiquetés exclus des paires de comportements', () => {
    const tagged = findLinks({ ...inputs(), periods: [{ id: 'p', type: 'travel', start: addDays(TODAY, -85), end: addDays(TODAY, -12) }] });
    expect(tagged.statuses['behavior:alcohol:hrv']).toBe('not-enough-days');
  });

  it('comportement masqué : aucune paire testée', () => {
    const report = findLinks({ ...inputs(), behaviors: [] });
    expect(Object.keys(report.statuses).some((k) => k.startsWith('behavior:'))).toBe(false);
  });
});

describe('rappel dans la notification du matin', () => {
  it('journal non rempli : une phrase en plus, pas de notification supplémentaire', () => {
    const recap = buildRecap(series(TODAY, 60), TODAY);
    expect(notificationText(recap, { journalMissing: true }).body).toContain('Pense à ton journal du matin.');
    expect(notificationText(recap, { journalMissing: false }).body).not.toContain('journal');
  });
});
