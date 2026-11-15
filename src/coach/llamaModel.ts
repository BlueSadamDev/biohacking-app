// Coach IA (lot 4) : moteur local llama.rn (modèle .gguf installé dans l'espace privé de l'app).
// Tout est local : le moteur reçoit le chemin d'un fichier déjà sur le téléphone, jamais une adresse
// Internet. Réponse affichée au fil de l'écriture, longueur limitée, arrêt possible à tout moment.

import { initLlama, type LlamaContext } from 'llama.rn';

import type { CoachModel } from '@/domain/coachRun';

export type GenResult = {
  text: string;
  tokens: number;
  /** Lecture de la demande par le modèle (ms). */
  promptMs: number;
  /** Écriture de la réponse (ms). */
  decodeMs: number;
  /** Délai avant le premier mot affiché (ms, mesuré côté app). */
  firstTokenMs: number | null;
  /** Durée totale vue par l'app (ms). */
  totalMs: number;
  stopped: boolean;
};

const TEMPERATURE = 0.3;
const CONTEXT_TOKENS = 4096;
const THREADS = 4;

export class LlamaCoachModel implements CoachModel {
  readonly label = 'llama.rn';
  private ctx: LlamaContext | null = null;
  /** Arrêt demandé par l'utilisateur : plus aucune génération sur ce modèle. */
  private cancelled = false;
  /** Mesures de la dernière génération (banc d'essai, vitesse mesurée). */
  lastResult: GenResult | null = null;

  constructor(private readonly modelUri: string) {}

  async load(): Promise<void> {
    this.ctx = await initLlama({
      model: this.modelUri,
      n_ctx: CONTEXT_TOKENS,
      n_threads: THREADS,
      n_gpu_layers: 0, // le S21 (Exynos, GPU Mali) n'a pas l'accélération OpenCL prise en charge
      use_mlock: false,
    });
  }

  async generate(system: string, user: string, maxTokens: number, onText: (text: string) => void): Promise<GenResult> {
    // Arrêt demandé avant le début (par exemple panneau fermé pendant le chargement) : rien à générer.
    if (this.cancelled) {
      return { text: '', tokens: 0, promptMs: 0, decodeMs: 0, firstTokenMs: null, totalMs: 0, stopped: true };
    }
    if (!this.ctx) throw new Error('Modèle non chargé');
    const start = Date.now();
    let firstTokenMs: number | null = null;
    let acc = '';
    const res = await this.ctx.completion(
      {
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        jinja: true,
        n_predict: maxTokens,
        temperature: TEMPERATURE,
      },
      (data) => {
        if (firstTokenMs === null) firstTokenMs = Date.now() - start;
        acc += data.token;
        onText(acc);
      },
    );
    this.lastResult = {
      text: (res.content || res.text).trim(),
      tokens: res.timings.predicted_n,
      promptMs: res.timings.prompt_ms,
      decodeMs: res.timings.predicted_ms,
      firstTokenMs,
      totalMs: Date.now() - start,
      stopped: res.interrupted,
    };
    return this.lastResult;
  }

  async stop(): Promise<void> {
    this.cancelled = true;
    await this.ctx?.stopCompletion();
  }

  async release(): Promise<void> {
    await this.ctx?.release();
    this.ctx = null;
  }
}
