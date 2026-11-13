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

  /** Normes personnelles (cahier des charges, section 5). La nuit du jour n'entre jamais dans sa propre norme. */
  norms: {
    /** HRV : moyenne glissante sur N nuits (nuit du jour comprise). */
    hrvShortWindowDays: 7,
    /** Nombre minimum de nuits pour calculer la moyenne courte. */
    hrvShortWindowMinNights: 3,
    /** HRV : plage normale calculée sur les N nuits précédentes. */
    hrvBaselineDays: 60,
    /** Largeur de la plage normale : moyenne ± k écarts-types. */
    hrvRangeSd: 1,
    /** FC au repos : moyenne des N nuits précédentes. */
    restingHrBaselineDays: 30,
    /** Nombre minimum de nuits pour qu'une norme existe. */
    baselineMinNights: 3,
  },

  /** Calibration : pas de score coloré tant qu'il n'y a pas assez de nuits. */
  calibration: {
    /** Nuits complètes (HRV et FC au repos calculables) nécessaires. */
    requiredNights: 28,
    /** Période sur laquelle on compte ces nuits (jours). */
    windowDays: 60,
  },

  /** Score de récupération 0-100 : somme pondérée de 3 sous-scores. */
  recovery: {
    weights: { hrv: 0.5, restingHr: 0.25, sleep: 0.25 },
    /** Sous-score d'une nuit exactement dans la norme. */
    neutral: 70,
    /** HRV : points gagnés (ou perdus) par écart-type au-dessus (ou au-dessous) de la norme. */
    hrvPointsPerSd: 20,
    /** FC au repos : points perdus par bpm au-dessus de la norme (gagnés en dessous). */
    restingHrPointsPerBpm: 8,
    /** Sommeil : durée dormie qui donne 100 (minutes). */
    sleepTargetMinutes: 7.5 * 60,
    /** Contribution « + » ou « − » si le sous-score s'écarte du neutre de plus de N points. */
    contributionMargin: 5,
  },

  /** Couleurs d'état (DESIGN.md) : vert ≥ goodMin, corail ≤ lowMax, ambre entre les deux. */
  zones: { goodMin: 67, lowMax: 33 },

  /** Affichage des graphiques de tendance (barres en ambre = valeur défavorable). */
  display: {
    /** FC au repos : barre en ambre si elle dépasse la moyenne 30 j de plus de N bpm. */
    restingHrHighBpm: 3,
    /** Sommeil : barre en ambre en dessous de N minutes. */
    sleepShortMinutes: 6 * 60,
  },

  /** Saisie du matin : poids accepté (kg). */
  entry: { weightMinKg: 30, weightMaxKg: 250 },

  /** Synchronisation Health Connect. */
  sync: {
    /** Profondeur de la toute première synchronisation (jours). */
    firstSyncDays: 90,
    /** Recouvrement à chaque synchro, pour rattraper les données arrivées en retard (jours). */
    overlapDays: 2,
  },
} as const;

export type Settings = typeof SETTINGS;
