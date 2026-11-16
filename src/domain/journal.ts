// Journal du matin (lot 5a, F8 ; cahier des charges, section 5). Calculs purs.
//
// - Un comportement coché dans le journal du matin J+1 est enregistré pour la veille, le jour J
//   (le jour où il a eu lieu).
// - « non » : le journal de ce jour est enregistré et le comportement n'est pas coché
//   (une ligne « non » est écrite pour chaque comportement affiché au moment de l'enregistrement).
// - « inconnu » : aucun journal enregistré pour ce jour (ou comportement ajouté plus tard) :
//   jour exclu des analyses, jamais compté comme « non ».

import { addDays } from './dates';
import { SETTINGS, type Settings } from './settings';

export type Behavior = { id: string; name: string; visible: boolean; position: number };

/** Comportements notés : jour (où le comportement a eu lieu) → comportement → oui (true) / non (false). */
export type BehaviorLog = Map<string, Map<string, boolean>>;

export type BehaviorStatus = 'yes' | 'no' | 'unknown';

export function behaviorStatus(log: BehaviorLog, day: string, behaviorId: string): BehaviorStatus {
  const value = log.get(day)?.get(behaviorId);
  if (value === undefined) return 'unknown';
  return value ? 'yes' : 'no';
}

/** Jour concerné par le journal du matin `entryDate` : la veille. */
export function behaviorDayOf(entryDate: string): string {
  return addDays(entryDate, -1);
}

/** Journaux modifiables : aujourd'hui et les N jours précédents (du plus récent au plus ancien). */
export function editableJournalDates(today: string, settings: Settings = SETTINGS): string[] {
  return Array.from({ length: settings.journal.editableDays + 1 }, (_, i) => addDays(today, -i));
}

/**
 * Lignes à enregistrer pour un journal : une par comportement affiché (oui ou non).
 * Les comportements masqués ne sont pas touchés (leur historique reste tel quel).
 */
export function journalRows(entryDate: string, visible: readonly Behavior[], checked: ReadonlySet<string>): { day: string; behaviorId: string; done: boolean }[] {
  const day = behaviorDayOf(entryDate);
  return visible.map((b) => ({ day, behaviorId: b.id, done: checked.has(b.id) }));
}

/** Contrôle du nom d'un comportement ; renvoie un message d'erreur ou null. */
export function validateBehaviorName(
  name: string,
  others: readonly Pick<Behavior, 'id' | 'name'>[],
  selfId: string | null = null,
  settings: Settings = SETTINGS,
): string | null {
  const clean = name.trim();
  if (!clean) return 'Donne un nom au comportement.';
  if (clean.length > settings.journal.maxNameLength) return `${settings.journal.maxNameLength} caractères au plus.`;
  const same = others.some((b) => b.id !== selfId && b.name.trim().toLocaleLowerCase('fr') === clean.toLocaleLowerCase('fr'));
  return same ? 'Ce comportement est déjà dans la liste.' : null;
}

/** Identifiant d'un comportement ajouté par l'utilisateur. */
export function newBehaviorId(now = Date.now()): string {
  return `custom-${now}`;
}

export type BehaviorFact = { id: string; name: string; yes: number; known: number; days: number };

/**
 * Faits des N derniers jours (hier et avant), pour le coach : « Alcool : 2 jours sur 7 ».
 * Seuls les jours notés comptent ; les jours inconnus sont signalés à part (« sur 5 notés »).
 */
export function behaviorFacts(
  behaviors: readonly Behavior[],
  log: BehaviorLog,
  today: string,
  settings: Settings = SETTINGS,
): BehaviorFact[] {
  const days = settings.journal.coachDays;
  const window = Array.from({ length: days }, (_, i) => addDays(today, -(i + 1)));
  return behaviors
    .filter((b) => b.visible)
    .map((b) => {
      const statuses = window.map((d) => behaviorStatus(log, d, b.id));
      return {
        id: b.id,
        name: b.name,
        yes: statuses.filter((s) => s === 'yes').length,
        known: statuses.filter((s) => s !== 'unknown').length,
        days,
      };
    });
}

/** « Alcool : 2 jours sur 7 » ; « … sur 5 notés » s'il manque des journaux ; « non noté » sans journal. */
export function behaviorFactText(f: BehaviorFact): string {
  if (f.known === 0) return `${f.name} : non noté`;
  const of = f.known === f.days ? `sur ${f.days}` : `sur ${f.known} notés`;
  return `${f.name} : ${f.yes} jour${f.yes > 1 ? 's' : ''} ${of}`;
}
