// Textes des liens observés (onglet Tendances ; lot 5a.1, DESIGN.md « Textes ») : une phrase par lien,
// l'écart en relief, avec son repère (« que les autres nuits »). Les pourcentages arrivent déjà
// calculés par correlations.ts.

import { capitalize } from './journal';
import { userText } from './markup';

/** « *12 % plus haute* », « *8 % plus basse* ». */
const moreOrLess = (pct: number, higher: boolean, adjective: { up: string; down: string }) =>
  `*${pct} % plus ${higher ? adjective.up : adjective.down}*`;
const HIGH = { up: 'haute', down: 'basse' };
const HIGH_M = { up: 'haut', down: 'bas' };
const LONG = { up: 'longue', down: 'courte' };

export const LINK_TEXT = {
  lateSessionHrv: (hour: number, higher: boolean, pct: number) =>
    `Les soirs où tu t’entraînes après ${hour} h, ta HRV de la nuit est ${moreOrLess(pct, higher, HIGH)} que les autres soirs de séance.`,
  bedtimeSleep: (cut: string, higher: boolean, pct: number) =>
    `Quand tu te couches après ${cut}, ta nuit est ${moreOrLess(pct, higher, LONG)} que quand tu te couches plus tôt.`,
  proteinRecovery: (higher: boolean, pct: number) =>
    `Les lendemains où tu atteins ta cible de protéines, ton score de récupération est ${moreOrLess(pct, higher, HIGH_M)} que les autres jours.`,
  loadHrv: (higher: boolean, pct: number) =>
    `Après une journée chargée, ta HRV est ${moreOrLess(pct, higher, HIGH)} qu’après une journée légère.`,
  stepsSleep: (cut: string, higher: boolean, pct: number) =>
    `Les jours où tu fais plus de ${cut} pas, ta nuit suivante est ${moreOrLess(pct, higher, LONG)} que les autres.`,

  /** Comportement du journal : `phrase` = « les soirs où tu bois de l’alcool ». */
  behaviorHrv: (phrase: string, higher: boolean, pct: number) =>
    `${capitalize(phrase)}, ta HRV de la nuit suivante est ${moreOrLess(pct, higher, HIGH)} que les autres nuits.`,
  behaviorSleep: (phrase: string, higher: boolean, pct: number) =>
    `${capitalize(phrase)}, tu dors *${pct} % de ${higher ? 'plus' : 'moins'}* que les autres nuits.`,
  behaviorScore: (phrase: string, higher: boolean, pct: number) =>
    `${capitalize(phrase)}, ton score de récupération du lendemain est ${moreOrLess(pct, higher, HIGH_M)} que les autres jours.`,
  behaviorAction: (name: string, favorable: boolean) =>
    favorable
      ? `« ${userText(name)} » semble te réussir : garde cette habitude si elle te convient.`
      : 'Essaie de t’en passer quelques jours et regarde si tes nuits changent.',
} as const;

/** En-tête d'une carte : force du lien et sens, en mots. */
export const LINK_STRENGTH = { strong: 'Effet marqué', moderate: 'Effet net', weak: 'Effet léger' } as const;
export const LINK_SENSE = { favorable: 'qui t’aide', unfavorable: 'qui te dessert' } as const;

export function linkHeader(strength: keyof typeof LINK_STRENGTH, favorable: boolean): string {
  if (strength === 'weak') return LINK_STRENGTH.weak;
  return `${LINK_STRENGTH[strength]}, ${favorable ? LINK_SENSE.favorable : LINK_SENSE.unfavorable}`;
}
