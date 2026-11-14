// Banc d'essai du coach (lot 4, étape C0) : TEMPORAIRE, retiré après le choix du modèle.
// Contient les 3 demandes types et un résumé chiffré FICTIF (aucune vraie donnée de santé),
// plus de petits calculs pour mesurer la vitesse et repérer les nombres inventés.

/** Résumé chiffré fictif, au format que produira le vrai contexte du coach (étape C2). */
export const BENCH_CONTEXT = {
  periode: { debut: '2026-11-02', fin: '2026-11-08' },
  recuperation: { score_moyen_7j: 58, score_moyen_30j: 66, jours_sous_40: 2 },
  sommeil: { duree_moyenne_7j_h: 6.4, duree_moyenne_30j_h: 7.1, nuits_sous_6h: 3, ecart_coucher_min: 95 },
  hrv: { moyenne_7j_ms: 41, plage_normale_ms: [44, 58], tendance: 'en baisse' },
  fc_repos: { moyenne_7j_bpm: 56, moyenne_30j_bpm: 53 },
  charge: { ratio_7j_28j: 1.42, seances_semaine: 5, cible_seances: 4 },
  zone2: { minutes_semaine: 45, cible_minutes: 120 },
  nutrition: {
    proteines_g_kg_moyenne_7j: 1.5,
    cible_proteines_g_kg: 1.8,
    jours_sous_cible: 4,
    calories_moyenne_7j: 2350,
    cible_calories: 2600,
  },
  force: {
    squat_1rm_kg: 112,
    developpe_couche_1rm_kg: 84,
    souleve_de_terre_1rm_kg: 138,
    developpe_couche_stagnation_semaines: 6,
  },
  alertes: [
    {
      theme: 'Charge',
      niveau: 'À surveiller',
      titre: 'Charge en hausse',
      constat: 'Ratio de charge 7 j / 28 j à 1.42, au-dessus de 1.3',
      cause_probable: '5 séances cette semaine pour 4 visées',
      action: 'Une séance légère ou de mobilité demain',
    },
  ],
  liens_observes: [
    {
      force: 'modéré',
      jours_compares: 34,
      phrase: 'Les soirs de séance après 20 h, ta HRV de la nuit est inférieure de 12 % en moyenne',
    },
  ],
};

/** Consignes système (version de départ, affinée à l'étape C3). */
export const BENCH_SYSTEM_PROMPT = [
  "Tu es le coach de l'application Aube. Tu réponds en français, en tutoyant, en 5 phrases au plus.",
  "Tu n'utilises QUE les chiffres du résumé fourni. Tu ne calcules rien et tu n'inventes aucun chiffre.",
  "Tu ne poses jamais de diagnostic médical et tu ne parles pas de maladie.",
  "Si l'information n'est pas dans le résumé, tu dis « je ne sais pas ».",
  'Termine par une action concrète.',
].join(' ');

export type BenchPrompt = { id: string; label: string; question: string };

/** Les 3 demandes types du test de faisabilité. */
export const BENCH_PROMPTS: BenchPrompt[] = [
  {
    id: 'bilan',
    label: 'Bilan de la semaine',
    question:
      'Fais le bilan de ma semaine : une phrase de synthèse, ce qui a marché, ce qui coince, puis 2 actions numérotées pour la semaine prochaine.',
  },
  {
    id: 'pourquoi',
    label: '« Pourquoi ? » d\'une alerte',
    question: "Pourquoi ai-je reçu l'alerte « Charge en hausse » ? Explique simplement.",
  },
  {
    id: 'libre',
    label: 'Question libre',
    question: 'Est-ce que je mange assez de protéines pour progresser en musculation ?',
  },
];

/** Message utilisateur envoyé au modèle : le résumé chiffré puis la demande. */
export function buildUserMessage(question: string, context: object = BENCH_CONTEXT): string {
  return `Résumé de mes données (JSON) :\n${JSON.stringify(context)}\n\nDemande : ${question}`;
}

/** Nombre de mots d'un texte (suite de caractères sans espace). */
export function countWords(text: string): number {
  const words = text.trim().split(/\s+/);
  return words[0] === '' ? 0 : words.length;
}

/** Mots par seconde, ou null si la durée est nulle. */
export function wordsPerSecond(text: string, durationMs: number): number | null {
  if (durationMs <= 0) return null;
  return countWords(text) / (durationMs / 1000);
}

/** Tous les nombres d'un texte, virgule décimale convertie en point (« 6,4 » → 6.4). */
export function extractNumbers(text: string): number[] {
  return (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => Number(n.replace(',', '.')));
}

/**
 * Nombres de la réponse absents du résumé (indice de chiffre inventé).
 * Les numéros de liste en début de ligne (« 1. », « 2) ») sont ignorés.
 */
export function unknownNumbers(answer: string, context: object = BENCH_CONTEXT): number[] {
  const known = new Set(extractNumbers(JSON.stringify(context)));
  const withoutListMarkers = answer.replace(/^\s*\d+[.)]\s/gm, ' ');
  return [...new Set(extractNumbers(withoutListMarkers))].filter((n) => !known.has(n));
}
