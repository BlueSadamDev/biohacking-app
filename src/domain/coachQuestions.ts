// Coach IA (lot 4, étape C6) : questions libres. Questions suggérées d'après les verdicts de l'app
// (ce qui coince d'abord), nettoyage de la question saisie, échanges de la conversation.

import type { CoachContext } from './coachContext';
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

/** Questions suggérées : une par point qui coince, complétées par des questions générales. */
export function suggestedQuestions(context: CoachContext, settings: Settings = SETTINGS): string[] {
  const q = settings.coach.questions;
  const { stuck } = weekStatus(context, settings);
  const fromStuck = stuck.map((s) => q.bySection[s.section]).filter((x): x is string => !!x);
  return [...new Set([...fromStuck, ...q.general])].slice(0, q.maxSuggestions);
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
