// Banc d'essai du coach (lot 4, étape C0) : TEMPORAIRE, retiré après le choix du moteur.
// Une même interface pour les deux moteurs comparés : llama.rn (fichier .gguf) et
// react-native-executorch (fichier .pte + tokenizer.json + tokenizer_config.json).
// Tout est local : les moteurs reçoivent des chemins de fichiers, jamais d'adresse Internet.

import { initLlama, type LlamaContext } from 'llama.rn';
import { createLLMChatSession, setTelemetryEnabled, type LLMChatSession } from 'react-native-executorch';

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

export interface BenchEngine {
  readonly label: string;
  /** Charge le modèle en mémoire (les consignes système servent à ExecuTorch). */
  load(system: string): Promise<void>;
  generate(system: string, user: string, maxTokens: number, onText: (text: string) => void): Promise<GenResult>;
  stop(): Promise<void>;
  release(): Promise<void>;
}

const TEMPERATURE = 0.3;
const CONTEXT_TOKENS = 4096;
const THREADS = 4;

/** Retire le préfixe « file:// » (ExecuTorch attend un chemin absolu). */
function toPath(uri: string): string {
  return uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
}

export class LlamaRnEngine implements BenchEngine {
  readonly label = 'llama.rn';
  private ctx: LlamaContext | null = null;

  constructor(private readonly modelUri: string) {}

  async load(_system: string): Promise<void> {
    this.ctx = await initLlama({
      model: this.modelUri,
      n_ctx: CONTEXT_TOKENS,
      n_threads: THREADS,
      n_gpu_layers: 0, // le S21 (Exynos, GPU Mali) n'a pas l'accélération OpenCL prise en charge
      use_mlock: false,
    });
  }

  async generate(system: string, user: string, maxTokens: number, onText: (text: string) => void) {
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

export class ExecutorchEngine implements BenchEngine {
  readonly label = 'ExecuTorch';
  private session: LLMChatSession | null = null;
  private system = '';

  constructor(
    private readonly modelUri: string,
    private readonly tokenizerUri: string,
    private readonly tokenizerConfigUri: string,
  ) {
    // La télémétrie de la bibliothèque ne part qu'au téléchargement d'un modèle (jamais ici) :
    // on la coupe quand même, par principe.
    setTelemetryEnabled(false);
  }

  private async open(system: string): Promise<void> {
    this.session?.dispose();
    this.system = system;
    this.session = await createLLMChatSession(
      {
        modelPath: toPath(this.modelUri),
        tokenizerPath: toPath(this.tokenizerUri),
        tokenizerConfigPath: toPath(this.tokenizerConfigUri),
      },
      {
        initialMessages: [{ role: 'system', content: system }],
        generationConfig: { temperature: TEMPERATURE },
        resetOnTurn: true,
      },
    );
  }

  async load(system: string): Promise<void> {
    await this.open(system);
  }

  async generate(system: string, user: string, maxTokens: number, onText: (text: string) => void) {
    // Chaque demande repart d'une conversation vide (comme avec llama.rn) : la session est
    // rouverte, hors chronométrage, si elle contient déjà un échange ou d'autres consignes.
    if (!this.session || this.system !== system || this.session.getHistory().length > 1) {
      await this.open(system);
    }
    const session = this.session!;
    const start = Date.now();
    let firstTokenMs: number | null = null;
    let acc = '';
    const res = await session.sendMessage(
      user,
      (token) => {
        if (firstTokenMs === null) firstTokenMs = Date.now() - start;
        acc += token;
        onText(acc);
      },
      { maxNewTokens: maxTokens, temperature: TEMPERATURE },
    );
    const last = [...res.messages].reverse().find((m) => m.role === 'assistant');
    const content = last?.content;
    return {
      text: (typeof content === 'string' ? content : acc).trim(),
      tokens: res.stats.reduce((s, x) => s + x.numTokens, 0),
      promptMs: res.stats.reduce((s, x) => s + x.prefill.durationMs, 0),
      decodeMs: res.stats.reduce((s, x) => s + x.durationMs, 0),
      firstTokenMs,
      totalMs: Date.now() - start,
      stopped: res.finishReason === 'cancelled',
    };
  }

  async stop(): Promise<void> {
    this.session?.stop();
  }

  async release(): Promise<void> {
    this.session?.dispose();
    this.session = null;
  }
}
