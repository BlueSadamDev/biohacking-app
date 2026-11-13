// Réglages de tous les calculs de l'app.
// Aucun seuil ni aucune pondération ne doit être écrit en dur ailleurs :
// pour changer une règle, on change une valeur ici.

export const SETTINGS = {
  /** Règle « une valeur par nuit » (cahier des charges, section 3). */
  night: {
    /**
     * Une séance de sommeil qui se termine à partir de cette heure (la veille)
     * compte pour la nuit du lendemain.
     */
    windowStartHour: 18,
    /**
     * Une séance de sommeil qui se termine avant cette heure compte pour la nuit
     * du jour même. Entre `windowEndHour` et `windowStartHour` : sieste, ignorée.
     */
    windowEndHour: 14,
    /** FC au repos de la nuit : moyenne des N valeurs les plus basses. */
    restingHrLowestCount: 5,
    /**
     * S'il n'y a aucun enregistrement « FC au repos » pendant le sommeil,
     * utiliser à la place les mesures de FC continue prises pendant le sommeil.
     */
    restingHrFallbackToHeartRate: true,
    /** Phases de sommeil (codes Health Connect) qui ne comptent pas comme du sommeil. */
    awakeStageCodes: [1, 3] as readonly number[],
  },

  /** Synchronisation Health Connect. */
  sync: {
    /** Profondeur de la toute première synchronisation (jours). */
    firstSyncDays: 90,
    /** Recouvrement à chaque synchro, pour rattraper les données arrivées en retard (jours). */
    overlapDays: 2,
  },
} as const;

export type Settings = typeof SETTINGS;
