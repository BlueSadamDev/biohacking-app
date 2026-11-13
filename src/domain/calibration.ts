// État de calibration des normes : tant qu'il y a moins de 28 nuits complètes
// (HRV et FC au repos calculables), l'app n'affiche pas de score coloré.

import { addDays } from './dates';
import type { NightValue } from './nightly';
import { nightsBetween } from './norms';
import { SETTINGS, type Settings } from './settings';

export type Calibration = {
  /** Nuits complètes sur la période. */
  nights: number;
  required: number;
  done: boolean;
  /** Texte prêt à afficher, ex. « Calibration : 12 / 28 jours ». */
  label: string;
};

export function calibrationStatus(nights: NightValue[], date: string, settings: Settings = SETTINGS): Calibration {
  const { requiredNights, windowDays } = settings.calibration;
  const complete = nightsBetween(nights, addDays(date, -(windowDays - 1)), date).filter(
    (n) => n.lnRmssd !== null && n.restingHr !== null,
  ).length;
  const shown = Math.min(complete, requiredNights);
  return {
    nights: complete,
    required: requiredNights,
    done: complete >= requiredNights,
    label: `Calibration : ${shown} / ${requiredNights} jours`,
  };
}
