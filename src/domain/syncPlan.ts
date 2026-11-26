// Règles de la synchro (lot 5b, étape 1) : calculs purs, sans Health Connect ni base de données.
// - plages de lecture de la fréquence cardiaque (sommeils et séances, plages proches réunies) ;
// - réconciliation : lignes locales que Health Connect ne renvoie plus dans une période relue ;
// - découpage du rattrapage de l'historique en tranches.

export type TimeRange = { start: number; end: number };

/**
 * Réunit les plages qui se chevauchent ou sont séparées de moins de `gapMs`, pour limiter le nombre
 * d'appels à Health Connect (les nombreuses activités courtes d'une journée tiennent en une lecture).
 * Les plages vides ou inversées sont ignorées. Résultat trié.
 */
export function mergeRanges(ranges: readonly TimeRange[], gapMs: number): TimeRange[] {
  const sorted = ranges.filter((r) => r.end > r.start).sort((a, b) => a.start - b.start);
  const merged: TimeRange[] = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last && r.start - last.end <= gapMs) last.end = Math.max(last.end, r.end);
    else merged.push({ start: r.start, end: r.end });
  }
  return merged;
}

/** Vrai si `time` tombe dans l'une des plages (bornes comprises). Plages triées (mergeRanges). */
export function insideRanges(time: number, sorted: readonly TimeRange[]): boolean {
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (time < sorted[mid].start) hi = mid - 1;
    else if (time > sorted[mid].end) lo = mid + 1;
    else return true;
  }
  return false;
}

/** Ligne locale venue de Health Connect : identifiant et période couverte (début = fin pour une mesure). */
export type LocalRow = { id: string; start: number; end: number };

/**
 * Réconciliation d'une période relue : identifiants des lignes locales entièrement comprises dans
 * [since, until] que Health Connect ne renvoie plus (supprimées ou réécrites sous un autre identifiant
 * dans l'app d'origine). Une ligne qui déborde de la période n'est jamais supprimée : elle n'a peut-être
 * pas été relue en entier. Les saisies manuelles ne doivent pas figurer dans `local`.
 */
export function rowsToDelete(
  local: readonly LocalRow[],
  returnedIds: ReadonlySet<string>,
  since: number,
  until: number,
): string[] {
  return local.filter((r) => r.start >= since && r.end <= until && !returnedIds.has(r.id)).map((r) => r.id);
}

/**
 * Tranches de lecture du rattrapage de l'historique, de la plus récente à la plus ancienne :
 * de `oldest` (exclu, plus ancien enregistrement local) jusqu'à `limit` (365 jours en arrière).
 * Rien à lire si `oldest` est déjà au-delà de `limit`.
 */
export function historyChunks(oldest: number, limit: number, chunkMs: number): TimeRange[] {
  const chunks: TimeRange[] = [];
  for (let end = oldest; end > limit; end -= chunkMs) {
    chunks.push({ start: Math.max(limit, end - chunkMs), end });
  }
  return chunks;
}
