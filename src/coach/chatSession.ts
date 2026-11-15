// Coach IA (lot 4, étape C6) : questions libres de l'onglet Coach.
// Le modèle est chargé à la première question, gardé tant que l'onglet est affiché, puis libéré
// (release) quand on le quitte. Chaque question est traitée à part (pas de mémoire des précédentes).

import { saveExchange } from '@/db/coachMessages';
import { describeProblem } from '@/domain/coachGuard';
import type { CoachExchange } from '@/domain/coachQuestions';
import { runCoach } from '@/domain/coachRun';

import { loadCoachContext } from './contextLoader';
import { LlamaCoachModel } from './llamaModel';
import { getInstalledModel } from './modelStore';

/**
 * Raisons des refus de la dernière question (affichées seulement dans la version de développement),
 * sans les chiffres écrits par le modèle : ils pourraient reprendre une vraie valeur de santé.
 */
export let lastChatRejections: string[] = [];

export class ChatSession {
  private model: LlamaCoachModel | null = null;
  private loaded = false;
  private running = false;
  private closing = false;

  /** Pose une question au coach, enregistre l'échange et le renvoie (null sans modèle installé). */
  async ask(question: string, onText: (text: string) => void, now: Date = new Date()): Promise<CoachExchange | null> {
    const installed = getInstalledModel();
    if (!installed || this.running) return null;
    this.running = true;
    this.closing = false;
    try {
      if (!this.model) {
        // Référence gardée avant le chargement : « Arrêter » pendant le chargement est pris en compte.
        this.model = new LlamaCoachModel(installed.uri);
        this.loaded = false;
      }
      const model = this.model;
      if (!this.loaded) {
        await model.load();
        this.loaded = true;
      }
      const context = await loadCoachContext(now);
      const out = await runCoach(model, context, { kind: 'question', text: question }, onText);
      lastChatRejections = out.rejections.map(
        (r, i) => `essai ${i + 1} : ${r.map((p) => (p.kind === 'number' ? 'chiffre écrit par le modèle' : describeProblem(p))).join(' ; ')}`,
      );
      const exchange: CoachExchange = {
        id: `${now.getTime()}`,
        createdMs: now.getTime(),
        question,
        answer: out.text,
        facts: out.facts,
        kind: out.kind,
      };
      if (out.kind === 'stopped') {
        // Un modèle arrêté ne génère plus rien : on le libère, il sera rechargé à la prochaine question.
        await this.release();
      }
      await saveExchange(exchange);
      return exchange;
    } finally {
      this.running = false;
      // Onglet quitté pendant la réponse : on libère maintenant que la génération est terminée.
      if (this.closing) await this.release();
    }
  }

  /** Sortie de l'onglet : arrête la génération en cours, puis libère le modèle (après l'arrêt). */
  async close(): Promise<void> {
    if (this.running) {
      this.closing = true;
      await this.stop();
    } else {
      await this.release();
    }
  }

  async stop(): Promise<void> {
    await this.model?.stop();
  }

  /** Libère le modèle (à la sortie de l'onglet Coach). */
  async release(): Promise<void> {
    const model = this.model;
    this.model = null;
    this.loaded = false;
    await model?.release().catch(() => undefined);
  }
}
