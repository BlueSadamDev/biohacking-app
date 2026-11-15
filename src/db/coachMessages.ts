// Conversation avec le coach (table `coach_message`) : un enregistrement par échange.
// Seulement sur le téléphone ; effaçable depuis les Réglages, incluse dans l'export et l'effacement.

import type { CoachExchange } from '@/domain/coachQuestions';
import { SETTINGS } from '@/domain/settings';

import { getDb, writeSql } from './database';

type Row = { id: string; created_ms: number; question: string; answer: string; facts_json: string; kind: string };

function facts(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

const KINDS: CoachExchange['kind'][] = ['answer', 'fallback', 'stopped'];

export async function saveExchange(e: CoachExchange): Promise<void> {
  await writeSql(
    'INSERT OR REPLACE INTO coach_message (id, created_ms, question, answer, facts_json, kind) VALUES (?, ?, ?, ?, ?, ?)',
    e.id,
    e.createdMs,
    e.question,
    e.answer,
    JSON.stringify(e.facts),
    e.kind,
  );
}

/** Les échanges les plus récents (au plus `historyShown`), du plus ancien au plus récent. */
export async function loadExchanges(): Promise<CoachExchange[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM coach_message ORDER BY created_ms DESC LIMIT ?',
    SETTINGS.coach.questions.historyShown,
  );
  return rows.reverse().map((r) => ({
    id: r.id,
    createdMs: r.created_ms,
    question: r.question,
    answer: r.answer,
    facts: facts(r.facts_json),
    kind: KINDS.includes(r.kind as CoachExchange['kind']) ? (r.kind as CoachExchange['kind']) : 'answer',
  }));
}

/** Efface toute la conversation. */
export async function clearConversation(): Promise<void> {
  await writeSql('DELETE FROM coach_message');
}
