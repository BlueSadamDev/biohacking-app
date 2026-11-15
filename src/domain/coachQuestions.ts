// Coach IA (lot 4, étape C6) : questions libres. Questions suggérées d'après les verdicts de l'app
// (ce qui coince d'abord), nettoyage de la question saisie, échanges de la conversation.

import type { CoachContext } from './coachContext';
import { focusSections } from './coachPrompt';
import { SETTINGS, type Settings } from './settings';
import { weekStatus } from './weeklyReview';

/** Un échange de la conversation : la question et la réponse du coach (avec le constat de l'app). */
export type CoachExchange = {
  id: string;
  createdMs: number;
  question: string;
  answer: string;
  facts: string[];
  /** 'answer' : conseil du modèle ; 'fallback' : conseil de repli ; 'stopped' : arrêté. */
  kind: 'answer' | 'fallback' | 'stopped';
};

const key = (q: string) => q.toLowerCase().replace(/[^a-zà-ÿ0-9]+/g, ' ').trim();

/**
 * Questions suggérées. Après un échange : d'abord des relances sur le sujet de la dernière question,
 * puis une question par point qui coince, puis des questions générales. Jamais une question déjà posée.
 */
export function suggestedQuestions(context: CoachContext, exchanges: CoachExchange[] = [], settings: Settings = SETTINGS): string[] {
  const q = settings.coach.questions;
  const asked = new Set(exchanges.map((e) => key(e.question)));
  const last = exchanges.length ? exchanges.reduce((a, b) => (b.createdMs > a.createdMs ? b : a)) : null;
  const followUps = last
    ? focusSections({ kind: 'question', text: last.question }, settings).flatMap((s) => q.followUps[s] ?? [])
    : [];
  const { stuck } = weekStatus(context, settings);
  const fromStuck = stuck.map((s) => q.bySection[s.section]).filter((x): x is string => !!x);
  const seen = new Set<string>();
  return [...followUps, ...fromStuck, ...q.general]
    .filter((x) => {
      const k = key(x);
      if (asked.has(k) || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, q.maxSuggestions);
}

/** Question nettoyée (espaces, longueur maximale), ou null si elle est vide. */
export function normalizeQuestion(text: string, settings: Settings = SETTINGS): string | null {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  return clean.slice(0, settings.coach.questions.maxLength);
}

/** Échanges à afficher : les plus récents, dans l'ordre chronologique. */
export function visibleExchanges(all: CoachExchange[], settings: Settings = SETTINGS): CoachExchange[] {
  return [...all].sort((a, b) => a.createdMs - b.createdMs).slice(-settings.coach.questions.historyShown);
}
