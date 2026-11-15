// Coach IA (lot 4, étape C3) : partage des rôles entre l'app et le modèle.
// - L'app écrit le CONSTAT : les lignes du résumé chiffré utiles à la demande, toujours justes
//   (affichées sous la réponse, « Chiffres utilisés »).
// - Le modèle n'écrit que l'EXPLICATION et l'ACTION, sans aucun chiffre, à partir de ce constat.

import type { AlertTheme } from './alerts';
import type { CoachContext, CoachSection, SectionKey } from './coachContext';
import { SETTINGS, type Settings } from './settings';

/** Ce qu'on demande au coach. */
export type CoachTask =
  | { kind: 'weekly' }
  | { kind: 'why-alert'; title: string; theme: AlertTheme }
  | { kind: 'why-link'; sentence: string }
  | { kind: 'question'; text: string };

export const COACH_SYSTEM_PROMPT = [
  "Tu es le coach de l'application Aube. Tu réponds en français, en tutoyant, avec des phrases courtes.",
  "L'app affiche déjà le constat chiffré à l'utilisateur : tu ne le recopies pas et tu n'écris AUCUN chiffre.",
  'Tu expliques simplement ce que veut dire ce constat, en respectant ses verdicts (« sous la cible » reste « sous la cible »), puis tu proposes une action concrète.',
  'Tu ne parles que du sujet de la demande.',
  "Tu ne poses jamais de diagnostic médical. Tu ne conseilles de consulter que si le constat dit qu'une alerte revient souvent.",
  "Si le constat ne permet pas de répondre, tu dis « je ne sais pas ».",
  "Pas d'emoji, pas de formule de politesse à la fin.",
].join(' ');

/** Demande et format attendu, pour chaque tâche. */
function request(task: CoachTask, settings: Settings): string {
  switch (task.kind) {
    case 'weekly':
      return `Fais le bilan de ma semaine : une phrase de synthèse, puis exactement ${settings.coach.generation.weeklyMaxActions} actions numérotées pour la semaine prochaine.`;
    case 'why-alert':
      return `Explique simplement pourquoi j'ai reçu l'alerte « ${task.title} », en 2 phrases au plus, puis une ligne « Action : … ».`;
    case 'why-link':
      return `Explique simplement ce lien observé : « ${task.sentence} », en 2 phrases au plus, en rappelant qu'un lien n'est pas une preuve de cause, puis une ligne « Action : … ».`;
    case 'question':
      return `${task.text.trim()} Réponds en 2 phrases au plus, puis une ligne « Action : … ».`;
  }
}

/** Rubriques mises en avant pour une tâche (vide = aucune rubrique particulière). */
export function focusSections(task: CoachTask, settings: Settings = SETTINGS): SectionKey[] {
  const keys: string[] = [];
  if (task.kind === 'why-alert') keys.push('alerts', ...(settings.coach.alertFocus[task.theme] ?? []));
  if (task.kind === 'why-link') keys.push('links');
  if (task.kind === 'question') {
    const text = task.text.toLowerCase();
    for (const f of settings.coach.focus) if (new RegExp(f.pattern).test(text)) keys.push(...f.sections);
  }
  return [...new Set(keys)] as SectionKey[];
}

const pick = (context: CoachContext, keys: readonly string[]) =>
  keys.map((k) => context.sections.find((s) => s.key === k)).filter((s): s is CoachSection => !!s && s.available);

/**
 * Constat écrit par l'app : les rubriques chiffrées utiles à la demande.
 * Bilan : les rubriques principales disponibles. Autres demandes : les rubriques mises en avant
 * (hors alertes et liens, déjà affichés sur leur carte), au plus `factSections`.
 */
export function factsFor(context: CoachContext, task: CoachTask, settings: Settings = SETTINGS): CoachSection[] {
  const g = settings.coach.generation;
  if (task.kind === 'weekly') return pick(context, g.weeklySections);
  const focus = focusSections(task, settings).filter((k) => k !== 'alerts' && k !== 'links');
  return pick(context, focus.length ? focus : ['recovery', 'sleep', 'load']).slice(0, g.factSections);
}

/** Message utilisateur : le constat (et l'alerte ou le lien concerné), puis la demande. */
export function buildUserMessage(context: CoachContext, task: CoachTask, settings: Settings = SETTINGS): string {
  const lines = (sections: CoachSection[]) => sections.map((s) => `- ${s.line}`).join('\n');
  const extra = task.kind === 'why-alert' ? pick(context, ['alerts']) : task.kind === 'why-link' ? pick(context, ['links']) : [];
  const parts = [
    `Constat calculé par l'app Aube (au ${context.date}), déjà affiché à l'utilisateur :`,
    lines([...extra, ...factsFor(context, task, settings)]),
  ];
  if (context.calibrating) parts.push("Calibration en cours : les comparaisons à la norme ne sont pas encore fiables.");
  parts.push('', `Demande : ${request(task, settings)}`);
  return parts.join('\n');
}

/** Conseil de repli (aucun conseil sûr n'a pu être rédigé) : le constat reste affiché. */
export function fallbackAdvice(task: CoachTask): string {
  return task.kind === 'weekly'
    ? "Je n'ai pas pu rédiger de bilan fiable cette fois. Le constat ci-dessous reprend tes chiffres de la semaine."
    : "Je n'ai pas pu rédiger d'explication fiable cette fois. Le constat ci-dessous reprend les chiffres utiles.";
}
