// Mesure de la synchro (lot 5b, étape 1) : durées et comptages de chaque synchro, jamais de valeurs.
// Calcul pur : l'horloge est fournie, ce qui rend le relevé testable sur des données fictives.
// Les relevés servent à comparer la synchro « avant / après » les optimisations (Contrôle des données).

/** Origine du lancement : ouverture de l'app (ou retour depuis Zepp), tâche de fond, ou bouton. */
export type SyncOrigin = 'launch' | 'background' | 'button';

/** Relevé d'un type de données pendant une synchro. */
export type SyncTypeMetric = {
  type: string;
  /** 'ok' : lu ; 'denied' : permission refusée ; 'error' : lecture impossible. */
  state: 'ok' | 'denied' | 'error';
  durationMs: number;
  /** Appels à Health Connect (une page lue = un appel). */
  calls: number;
  /** Enregistrements lus dans Health Connect. */
  read: number;
  /** Lignes écrites dans la base (y compris les lignes déjà connues, réécrites à l'identique). */
  written: number;
  /** Lignes nouvelles : écart du nombre de lignes de la table avant / après. */
  inserted: number;
};

/** Relevé d'une synchro complète. */
export type SyncRun = {
  startedMs: number;
  origin: SyncOrigin;
  /** Du début de la synchro à la fin de tout ce qu'elle déclenche (alertes, accueil, notification). */
  totalMs: number;
  /** Du début de la synchro à l'accueil à jour ; null sans accueil (tâche de fond, bouton du contrôle). */
  homeReadyMs: number | null;
  /** Appels d'accès à Health Connect (disponibilité, mise en route, lecture des autorisations). */
  accessCalls: number;
  /** Calcul des nuits : nombre de calculs, temps de lecture en base et temps de calcul (cumulés). */
  nightsRuns: number;
  nightsReadMs: number;
  nightsComputeMs: number;
  types: SyncTypeMetric[];
};

export type SyncRunTotals = {
  /** Appels à Health Connect, accès compris. */
  calls: number;
  read: number;
  written: number;
  inserted: number;
  /** Temps passé à lire et écrire les types (somme des durées par type). */
  typesMs: number;
  nightsMs: number;
};

export function runTotals(run: SyncRun): SyncRunTotals {
  const sum = (pick: (t: SyncTypeMetric) => number) => run.types.reduce((acc, t) => acc + pick(t), 0);
  return {
    calls: run.accessCalls + sum((t) => t.calls),
    read: sum((t) => t.read),
    written: sum((t) => t.written),
    inserted: sum((t) => t.inserted),
    typesMs: sum((t) => t.durationMs),
    nightsMs: run.nightsReadMs + run.nightsComputeMs,
  };
}

/** Les `kept` synchros les plus récentes, de la plus récente à la plus ancienne. */
export function latestRuns(runs: readonly SyncRun[], kept: number): SyncRun[] {
  return [...runs].sort((a, b) => b.startedMs - a.startedMs).slice(0, Math.max(0, kept));
}

/** Relevé en cours : chaque étape de la synchro y ajoute ses comptages. */
export type SyncRecorder = {
  readonly origin: SyncOrigin;
  readonly startedMs: number;
  /** Début de la lecture d'un type : les appels et lectures suivants lui sont comptés. */
  beginType(type: string): void;
  /** Un appel à Health Connect : compté au type en cours, sinon aux appels d'accès. */
  countCall(): void;
  countAccessCall(): void;
  addRead(n: number): void;
  addWritten(n: number): void;
  /** Fin de la lecture du type en cours. */
  endType(state: SyncTypeMetric['state'], inserted: number): void;
  addNights(readMs: number, computeMs: number): void;
  /** L'accueil affiche les données de cette synchro (seul le premier appel compte). */
  markHomeReady(): void;
  /** Clôt le relevé ; les appels suivants sont sans effet. */
  finish(): SyncRun;
  readonly finished: boolean;
};

export function createSyncRecorder(origin: SyncOrigin, clock: () => number = Date.now): SyncRecorder {
  const startedMs = clock();
  const types: SyncTypeMetric[] = [];
  let current: (SyncTypeMetric & { startMs: number }) | null = null;
  let accessCalls = 0;
  let nightsRuns = 0;
  let nightsReadMs = 0;
  let nightsComputeMs = 0;
  let homeReadyMs: number | null = null;
  let done: SyncRun | null = null;

  const closeCurrent = (state: SyncTypeMetric['state'], inserted: number) => {
    if (!current) return;
    const { startMs, ...metric } = current;
    types.push({ ...metric, state, inserted: Math.max(0, Math.round(inserted)), durationMs: Math.max(0, clock() - startMs) });
    current = null;
  };

  return {
    origin,
    startedMs,
    get finished() {
      return done !== null;
    },
    beginType(type) {
      if (done) return;
      closeCurrent('error', 0); // type précédent jamais terminé
      current = { type, state: 'ok', durationMs: 0, calls: 0, read: 0, written: 0, inserted: 0, startMs: clock() };
    },
    countCall() {
      if (done) return;
      if (current) current.calls += 1;
      else accessCalls += 1;
    },
    countAccessCall() {
      if (!done) accessCalls += 1;
    },
    addRead(n) {
      if (!done && current) current.read += n;
    },
    addWritten(n) {
      if (!done && current) current.written += n;
    },
    endType(state, inserted) {
      if (!done) closeCurrent(state, inserted);
    },
    addNights(readMs, computeMs) {
      if (done) return;
      nightsRuns += 1;
      nightsReadMs += Math.max(0, readMs);
      nightsComputeMs += Math.max(0, computeMs);
    },
    markHomeReady() {
      if (!done && homeReadyMs === null) homeReadyMs = Math.max(0, clock() - startedMs);
    },
    finish() {
      if (done) return done;
      closeCurrent('error', 0);
      done = {
        startedMs,
        origin,
        totalMs: Math.max(0, clock() - startedMs),
        homeReadyMs,
        accessCalls,
        nightsRuns,
        nightsReadMs,
        nightsComputeMs,
        types,
      };
      return done;
    },
  };
}
