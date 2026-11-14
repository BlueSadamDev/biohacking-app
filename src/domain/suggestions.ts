// Suggestions d'autres sports (lot 3, cahier des charges section 4 F3). Calcul pur, aucun appel réseau.
// Règles (seuils dans settings.ts) :
// - endurance douce : minutes de zone 2 des 7 derniers jours sous la cible hebdomadaire ;
// - mobilité : aucune séance de yoga, d'étirements ou de pilates depuis 3 semaines.
// Une suggestion principale (premier manque selon `gapPriority`) et au plus une secondaire.
// L'activité proposée pour un manque change chaque semaine (rotation dans le catalogue).

import { addDays, dayKey, daysBetween, startOfWeek } from './dates';
import type { ExerciseSession } from './load';
import type { Sample } from './nightly';
import { SETTINGS, type Settings } from './settings';
import { CATALOG, type Activity, type Gap } from './sportCatalog';
import { sessionZones } from './zones';

export type Suggestion = { gap: Gap; activity: Activity; reason: string };
export type WeeklySuggestions = { primary: Suggestion; secondary: Suggestion | null } | null;

export type SuggestionInputs = {
  /** Séances des 3 dernières semaines au moins. */
  sessions: ExerciseSession[];
  samples: Sample[];
  /** null : zones non calculables, pas de règle d'endurance. */
  hrMax: number | null;
  zone2Target: number;
  today: string;
  /** Catalogue (par défaut celui de sportCatalog.ts). */
  catalog?: readonly Activity[];
};

const inWindow = (session: ExerciseSession, from: string, to: string) => {
  const day = dayKey(session.start);
  return day >= from && day <= to;
};

/** Minutes de zone 2 sur les N derniers jours ; null si la FC max est inconnue. */
export function recentZone2Minutes(input: SuggestionInputs, settings: Settings = SETTINGS): number | null {
  if (input.hrMax === null) return null;
  const from = addDays(input.today, -(settings.suggestions.zone2WindowDays - 1));
  let total = 0;
  for (const s of input.sessions.filter((x) => inWindow(x, from, input.today))) {
    const zones = sessionZones(s, input.samples, input.hrMax, settings);
    if (zones) total += zones[1];
  }
  return total;
}

/** Manques repérés, avec leur explication. */
export function findGaps(input: SuggestionInputs, settings: Settings = SETTINGS): { gap: Gap; reason: string }[] {
  const s = settings.suggestions;
  const gaps: { gap: Gap; reason: string }[] = [];

  const zone2 = recentZone2Minutes(input, settings);
  if (zone2 !== null && zone2 < input.zone2Target) {
    gaps.push({
      gap: 'endurance',
      reason: `${Math.round(zone2)} min de zone 2 sur ${s.zone2WindowDays} jours, pour ${input.zone2Target} min visées.`,
    });
  }

  const from = addDays(input.today, -(s.mobilityWindowDays - 1));
  const mobility = input.sessions.some((x) => s.mobilityTypes.includes(x.exerciseType) && inWindow(x, from, input.today));
  if (!mobility) {
    gaps.push({ gap: 'mobility', reason: `Aucune séance de mobilité, yoga ou étirements depuis ${Math.round(s.mobilityWindowDays / 7)} semaines.` });
  }

  return gaps.sort((a, b) => s.gapPriority.indexOf(a.gap) - s.gapPriority.indexOf(b.gap));
}

/** Activité de la semaine pour un manque : rotation dans le catalogue selon le numéro de semaine. */
export function activityFor(gap: Gap, today: string, catalog: readonly Activity[] = CATALOG): Activity | null {
  const options = catalog.filter((a) => a.gap === gap);
  if (options.length === 0) return null;
  const week = Math.floor(daysBetween('2024-01-01', startOfWeek(today)) / 7); // 2024-01-01 est un lundi
  return options[((week % options.length) + options.length) % options.length];
}

/** Suggestion principale et secondaire de la semaine ; null s'il n'y a aucun manque. */
export function weeklySuggestions(input: SuggestionInputs, settings: Settings = SETTINGS): WeeklySuggestions {
  const suggestions = findGaps(input, settings)
    .map(({ gap, reason }) => {
      const activity = activityFor(gap, input.today, input.catalog);
      return activity ? { gap, activity, reason } : null;
    })
    .filter((x): x is Suggestion => x !== null);
  if (suggestions.length === 0) return null;
  return { primary: suggestions[0], secondary: suggestions[1] ?? null };
}
