// Banc d'essai du coach (lot 4) : TEMPORAIRE, retiré à la fin du lot.
// Moteur retenu au test de faisabilité : llama.rn (fichier .gguf). Tout est local :
// le moteur reçoit le chemin d'un fichier déjà sur le téléphone, jamais une adresse Internet.

import { initLlama, type LlamaContext } from 'llama.rn';

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

export class LlamaRnEngine {
  readonly label = 'llama.rn';
  private ctx: LlamaContext | null = null;

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
    return {
      text: (res.content || res.text).trim(),
      tokens: res.timings.predicted_n,
      promptMs: res.timings.prompt_ms,
      decodeMs: res.timings.predicted_ms,
      firstTokenMs,
      totalMs: Date.now() - start,
      stopped: res.interrupted,
    };
  }

  async stop(): Promise<void> {
    await this.ctx?.stopCompletion();
  }

  async release(): Promise<void> {
    await this.ctx?.release();
    this.ctx = null;
  }
}
