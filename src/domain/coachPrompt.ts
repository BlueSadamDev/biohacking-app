// Coach IA (lot 4, étape C3) : partage des rôles entre l'app et le modèle.
// - L'app écrit le CONSTAT : les lignes du résumé chiffré utiles à la demande, toujours justes
//   (affichées sous la réponse, « Chiffres utilisés »).
// - Le modèle n'écrit que l'EXPLICATION et l'ACTION, sans aucun chiffre, à partir de ce constat.

import type { AlertTheme } from './alerts';
import type { CoachContext, CoachSection, SectionKey } from './coachContext';
import { SETTINGS, type Settings } from './settings';

/** Ce qu'on demande au coach. */
export type CoachTask =
  /** Bilan : `worked` / `stuck` = ce qui a marché et ce qui coince, décidés par l'app (étape C4). */
  | { kind: 'weekly'; worked?: string[]; stuck?: string[]; sections?: string[] }
  | { kind: 'why-alert'; title: string; theme: AlertTheme }
  | { kind: 'why-link'; sentence: string }
  | { kind: 'question'; text: string };

export const COACH_SYSTEM_PROMPT = [
  "Tu es le coach de l'application Aube. Tu réponds en français, en tutoyant, avec des phrases courtes.",
  "L'utilisateur voit déjà ses chiffres dans l'app : tu ne les recopies pas et tu n'écris AUCUN chiffre.",
  'Tu expliques simplement ce que veulent dire ses chiffres, en respectant les verdicts (« sous la cible » reste « sous la cible »), puis tu proposes une action concrète.',
  'Tu ne parles que du sujet de la demande, en t’adressant directement à lui.',
  "Tu ne poses jamais de diagnostic médical. Tu ne conseilles de consulter que s'il est écrit qu'une alerte revient souvent.",
  "Si ses chiffres ne permettent pas de répondre, tu dis « je ne sais pas ».",
  "Tu ne parles que de ce que l'app mesure : sommeil (durée), récupération, HRV, fréquence cardiaque au repos, entraînement, nutrition, force, poids.",
  "Tu parles à l'utilisateur en le tutoyant (« tu », « ton », « ta »), jamais à la première personne (« je dors », « ma récupération »).",
  "Pas d'emoji, pas de formule de politesse à la fin.",
].join('\n');

/** Demande et format attendu, pour chaque tâche. */
function request(task: CoachTask, settings: Settings): string {
  switch (task.kind) {
    case 'weekly': {
      const n = settings.coach.generation.weeklyMaxActions;
      const stuck = task.stuck?.length ?? 0;
      const target =
        stuck >= n
          ? 'qui visent ce qui coince'
          : stuck > 0
            ? "la première vise ce qui coince, la seconde aide à garder ce qui a marché"
            : 'qui aident à garder ce qui a marché';
      return [
        `Fais le bilan de ma semaine. Commence directement par une synthèse de ${settings.coach.generation.weeklySynthesisSentences} phrases bien rédigées qui s'adressent à moi (par exemple « Ta semaine… »), qui disent ce qui a marché et ce qui coince.`,
        `Puis écris exactement ${n} actions numérotées pour la semaine prochaine, une par ligne : ${target}.`,
        "Chaque action est une phrase complète qui commence par un verbe. N'écris aucun chiffre, même pour une durée ou une quantité : écris par exemple « Couche-toi un peu plus tôt », pas « Couche-toi 30 minutes plus tôt ».",
      ].join(' ');
    }
    case 'why-alert':
      return `Explique simplement pourquoi j'ai reçu l'alerte « ${task.title} », en 2 phrases au plus, puis une ligne « Action : … ».`;
    case 'why-link':
      return `Explique simplement ce lien observé : « ${task.sentence} », en 2 phrases au plus, en rappelant qu'un lien n'est pas une preuve de cause, puis une ligne « Action : … ».`;
    case 'question':
      return [
        `« ${task.text.trim()} »`,
        'Réponds uniquement sur le sujet de cette question, sans titre ni numéro, en trois lignes :',
        'd’abord une réponse directe (oui, non ou en partie) qui respecte les verdicts donnés plus haut ;',
        'ensuite pourquoi c’est important pour la forme ou la progression ; enfin une ligne « Action : … » qui commence par un verbe à l’impératif.',
      ].join(' ');
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
  if (task.kind === 'weekly') return pick(context, task.sections?.length ? task.sections : g.weeklySections);
  // Lien observé : le constat est le lien lui-même (voir factLines), pas d'autres rubriques.
  if (task.kind === 'why-link') return [];
  const focus = focusSections(task, settings).filter((k) => k !== 'alerts' && k !== 'links');
  return pick(context, focus.length ? focus : ['recovery', 'sleep', 'load']).slice(0, g.factSections);
}

/** Lignes « Chiffres utilisés » affichées sous le conseil (écrites par l'app). */
export function factLines(context: CoachContext, task: CoachTask, settings: Settings = SETTINGS): string[] {
  if (task.kind === 'why-link') return [`Lien observé : ${task.sentence}`];
  return factsFor(context, task, settings).map((s) => s.line);
}

/** Message utilisateur : le constat (et l'alerte ou le lien concerné), puis la demande. */
export function buildUserMessage(context: CoachContext, task: CoachTask, settings: Settings = SETTINGS): string {
  const lines = (sections: CoachSection[]) => sections.map((s) => `- ${s.line}`).join('\n');
  const extra = task.kind === 'why-alert' ? pick(context, ['alerts']) : task.kind === 'why-link' ? pick(context, ['links']) : [];
  const parts = [
    `Mes chiffres, calculés par l'app Aube (au ${context.date}) :`,
    lines([...extra, ...factsFor(context, task, settings)]),
  ];
  if (task.kind === 'weekly' && (task.worked || task.stuck)) {
    parts.push(`Ce qui a marché (décidé par l'app) : ${task.worked?.length ? task.worked.join(' ; ') : 'rien de particulier'}.`);
    parts.push(`Ce qui coince (décidé par l'app) : ${task.stuck?.length ? task.stuck.join(' ; ') : 'rien de particulier'}.`);
  }
  if (context.calibrating) parts.push("Calibration en cours : les comparaisons à la norme ne sont pas encore fiables.");
  parts.push('', `Demande : ${request(task, settings)}`);
  return parts.join('\n');
}

/**
 * Réponse écrite par l'app, sans le modèle, quand elle sait déjà qu'il ne peut pas bien répondre :
 * - question hors des sujets suivis par l'app (ni sujet reconnu, ni question générale sur la forme) ;
 * - rubrique principale de la question sans chiffres, ou sans verdict possible (cible non calculable).
 * Renvoie null quand le modèle doit répondre.
 */
export function appAnswer(
  context: CoachContext,
  task: CoachTask,
  settings: Settings = SETTINGS,
): { text: string; facts: string[] } | null {
  if (task.kind !== 'question') return null;
  const q = settings.coach.questions;
  const topics = focusSections(task, settings).filter((k) => k !== 'alerts' && k !== 'links');
  if (topics.length === 0) {
    const text = task.text.toLowerCase();
    return q.generalPatterns.some((p) => new RegExp(p).test(text)) ? null : { text: q.outOfScope, facts: [] };
  }
  const main = context.sections.find((s) => s.key === topics[0]);
  if (!main || !main.available) {
    const missing = q.missing[topics[0]] ?? "l'app n'a pas encore de chiffres sur ce sujet";
    return { text: `Je ne peux pas encore te répondre : ${missing}.`, facts: [] };
  }
  if (main.missing) return { text: `Je ne peux pas encore te répondre : ${main.missing}.`, facts: [main.line] };
  return null;
}

/** Conseil de repli (aucun conseil sûr n'a pu être rédigé) : le constat reste affiché. */
export function fallbackAdvice(task: CoachTask): string {
  return task.kind === 'weekly'
    ? "Je n'ai pas pu rédiger de bilan fiable cette fois. Le constat ci-dessous reprend tes chiffres de la semaine."
    : "Je n'ai pas pu rédiger d'explication fiable cette fois. Tes chiffres utiles sont juste en dessous.";
}
