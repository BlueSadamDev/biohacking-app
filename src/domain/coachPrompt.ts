// Coach IA (lot 4, étape C3) : consignes système et message envoyé au modèle.
// Le modèle reçoit le résumé chiffré (seule source de chiffres), les rubriques utiles en tête.

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
  "Tu es le coach de l'application Aube. Tu réponds en français, en tutoyant, en 4 phrases au plus.",
  "Tu t'appuies UNIQUEMENT sur le résumé fourni, calculé par l'app. Tu ne calcules rien et tu n'inventes aucun chiffre.",
  'Tu reprends mot pour mot le verdict du résumé (par exemple « sous la cible », « en hausse ») et tu cites au moins un chiffre du résumé.',
  'Tu ne réponds que sur le sujet de la demande, sans parler des autres rubriques.',
  "Tu ne poses jamais de diagnostic médical. Tu ne conseilles de consulter que si le résumé dit qu'une alerte revient souvent.",
  "Si l'information n'est pas dans le résumé, tu dis « je ne sais pas ».",
  "Pas d'emoji. Termine par une action concrète.",
].join(' ');

/** Demande écrite au modèle pour chaque tâche. */
function request(task: CoachTask): string {
  switch (task.kind) {
    case 'weekly':
      return 'Fais le bilan de ma semaine : une phrase de synthèse, ce qui a marché, ce qui coince, puis 2 actions numérotées pour la semaine prochaine.';
    case 'why-alert':
      return `Pourquoi ai-je reçu l'alerte « ${task.title} » ? Explique simplement à partir des rubriques utiles.`;
    case 'why-link':
      return `Explique simplement ce lien observé : « ${task.sentence} ». Rappelle qu'un lien n'est pas une preuve de cause.`;
    case 'question':
      return task.text.trim();
  }
}

/** Rubriques mises en tête pour une tâche (vide = tout le résumé, dans l'ordre habituel). */
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

/** Message utilisateur : rubriques utiles d'abord, puis le reste du résumé, puis la demande. */
export function buildUserMessage(context: CoachContext, task: CoachTask, settings: Settings = SETTINGS): string {
  const focus = focusSections(task, settings);
  const lines = (sections: CoachSection[]) => sections.map((s) => `- ${s.line}`).join('\n');
  const header = `Résumé de mes données calculé par l'app Aube (au ${context.date}) :`;
  if (focus.length === 0) return `${header}\n${lines(context.sections)}\n\nDemande : ${request(task)}`;
  const first = focus.map((k) => context.sections.find((s) => s.key === k)).filter((s): s is CoachSection => !!s);
  const rest = context.sections.filter((s) => !focus.includes(s.key));
  return `${header}\nRubriques utiles pour la demande :\n${lines(first)}\nAutres données :\n${lines(rest)}\n\nDemande : ${request(task)}`;
}

/** Message de repli : les verdicts du résumé, sans passer par le modèle. */
export function fallbackAnswer(context: CoachContext, task: CoachTask, settings: Settings = SETTINGS): string {
  const focus = focusSections(task, settings);
  const keys = focus.length ? focus : (['recovery', 'sleep', 'load'] as SectionKey[]);
  const picked = keys
    .map((k) => context.sections.find((s) => s.key === k))
    .filter((s): s is CoachSection => !!s && s.available)
    .slice(0, settings.coach.generation.fallbackSections);
  if (picked.length === 0) return "Je ne sais pas répondre de façon sûre avec les données disponibles.";
  return ['Je préfère ne pas improviser. Voici ce que disent tes données :', ...picked.map((s) => s.line)].join('\n');
}
