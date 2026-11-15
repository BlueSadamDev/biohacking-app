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
  "L'app affiche déjà le constat chiffré à l'utilisateur : tu ne le recopies pas et tu n'écris AUCUN chiffre.",
  'Tu expliques simplement ce que veut dire ce constat, en respectant ses verdicts (« sous la cible » reste « sous la cible »), puis tu proposes une action concrète.',
  'Tu ne parles que du sujet de la demande.',
  "Tu ne poses jamais de diagnostic médical. Tu ne conseilles de consulter que si le constat dit qu'une alerte revient souvent.",
  "Si le constat ne permet pas de répondre, tu dis « je ne sais pas ».",
  "Tu ne parles jamais du « tableau », du « constat » ni des « données » : tu réponds directement. Tu ne parles pas de ce que l'app ne mesure pas (qualité du sommeil, stress, hydratation).",
  "Pas d'emoji, pas de formule de politesse à la fin.",
  '',
  'Exemple de bonne réponse.',
  'Constat : « Sommeil : 6,4 h par nuit en moyenne sur 7 jours, sous la durée visée de 7,5 h, en baisse par rapport à d’habitude. »',
  'Question : « Est-ce que je dors assez ? »',
  'Réponse :',
  'Non, tu dors moins que la durée visée cette semaine, et moins que d’habitude.',
  'Un sommeil plus court freine ta récupération après les séances.',
  'Action : couche-toi un peu plus tôt les soirs de semaine.',
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
        `Fais le bilan de ma semaine. Commence directement par une synthèse de ${settings.coach.generation.weeklySynthesisSentences} phrases bien rédigées qui s'adressent à moi (par exemple « Ta semaine… »), qui disent ce qui a marché et ce qui coince, sans parler du « constat ».`,
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
        'Réponds comme dans l’exemple : 1re phrase, une réponse directe (oui, non ou en partie) qui reprend le verdict du constat ;',
        '2e phrase, pourquoi c’est important pour ta forme ou ta progression ; puis une ligne « Action : … » qui commence par un verbe.',
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
    `Constat calculé par l'app Aube (au ${context.date}), déjà affiché à l'utilisateur :`,
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

/** Conseil de repli (aucun conseil sûr n'a pu être rédigé) : le constat reste affiché. */
export function fallbackAdvice(task: CoachTask): string {
  return task.kind === 'weekly'
    ? "Je n'ai pas pu rédiger de bilan fiable cette fois. Le constat ci-dessous reprend tes chiffres de la semaine."
    : "Je n'ai pas pu rédiger d'explication fiable cette fois. Le constat ci-dessous reprend les chiffres utiles.";
}
