// Réglages de tous les calculs de l'app.
// Aucun seuil ni aucune pondération ne doit être écrit en dur ailleurs :
// pour changer une règle, on change une valeur ici.

/** Règle d'interprétation de la composition corporelle (voir `bodyComposition.rules`). */
export type BodyRule = {
  weight?: readonly ('loss' | 'stable' | 'slow-gain' | 'fast-gain')[];
  strength?: readonly ('up' | 'flat' | 'down')[];
  protein?: readonly ('reached' | 'below')[];
  tone: 'good' | 'mid' | 'neutral';
  text: string;
};

/** Règle du bilan de la semaine (voir `coach.weekly.rules`). */
export type WeeklyRule = {
  section: string;
  field: string;
  op: 'eq' | 'in' | 'gt' | 'lte';
  value: string | number | boolean | readonly (string | number | boolean)[];
  kind: 'worked' | 'stuck';
  text: string;
  /** Action proposée par l'app si le conseil du modèle est refusé (vide pour « ce qui a marché »). */
  action: string;
};

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

  /** Cibles personnelles (écran Réglages) : valeurs par défaut et valeurs acceptées. */
  targets: {
    /** Protéines par kg de poids et par jour. */
    proteinGPerKgDefault: 1.8,
    proteinGPerKgMin: 0.5,
    proteinGPerKgMax: 4,
    /** Calories par jour : pas de valeur par défaut (« à définir »). */
    caloriesMin: 800,
    caloriesMax: 6000,
    sessionsPerWeekDefault: 4,
    sessionsPerWeekMax: 14,
    /** Minutes de zone 2 visées par semaine (lot 3). */
    zone2MinutesDefault: 120,
    zone2MinutesMax: 1500,
    /** Poids moyen utilisé pour la cible de protéines : moyenne sur N jours. */
    weightAverageDays: 7,
  },

  /** Profil cardiaque (calcul de la charge). */
  profile: {
    /** FC max estimée = intercept − slope × âge (formule de Tanaka). */
    hrMaxIntercept: 208,
    hrMaxSlope: 0.7,
    hrMaxMin: 120,
    hrMaxMax: 230,
    /** Âge accepté pour l'année de naissance. */
    ageMin: 10,
    ageMax: 100,
    /** Coefficient du TRIMP de Banister selon le sexe. */
    trimpCoefficient: { male: 1.92, female: 1.67 },
  },

  /** Charge d'entraînement (cahier des charges, section 5) : TRIMP de Banister et ratio aigu / chronique. */
  load: {
    /** TRIMP = minutes × FCr × a × e^(k × FCr), FCr = (FC − FC repos) / (FC max − FC repos). */
    trimpA: 0.64,
    /** Une mesure de FC compte au plus pour N secondes (trous de mesure). */
    maxSampleGapSeconds: 120,
    /** Séance sans assez de FC : moins de N mesures ou moins de cette part de la durée couverte. */
    minSamples: 5,
    minCoverage: 0.5,
    /** Charge aiguë et chronique : moyennes par jour sur N jours (aujourd'hui compris). */
    acuteDays: 7,
    chronicDays: 28,
    /** Jours d'historique nécessaires avant d'afficher le ratio. */
    calibrationDays: 28,
    /** Seuils du ratio aigu / chronique. */
    underMax: 0.8,
    balancedMax: 1.3,
    highMin: 1.5,
  },

  /** Zones cardiaques (lot 3) : temps passé dans chaque zone pendant les séances, FC du Helio Strap. */
  heartZones: {
    /**
     * Bas des zones 2 à 5, en part de la FC max : Z2 dès 60 %, Z3 dès 70 %, Z4 dès 80 %, Z5 dès 90 %.
     * Sous 60 % : zone 1 (échauffement et repos entre les séries compris).
     */
    lowerBounds: [0.6, 0.7, 0.8, 0.9] as readonly number[],
    /** Une mesure de FC compte au plus pour N secondes (trous de mesure). */
    maxSampleGapSeconds: 120,
    /** Séance sans assez de FC : moins de N mesures ou moins de cette part de la durée couverte. */
    minSamples: 5,
    minCoverage: 0.5,
  },

  /** Musculation (lot 3) : saisie de la meilleure série des 3 exercices clés, 1RM estimé (Epley). */
  strength: {
    /**
     * Types de séance Health Connect qui déclenchent la saisie : musculation (70),
     * haltérophilie (81), poids du corps (13), fractionné intense (36).
     */
    sessionTypes: [70, 81, 13, 36] as readonly number[],
    /** Sélecteurs de la saisie : charge (kg) et répétitions. */
    loadStepKg: 2.5,
    loadMinKg: 2.5,
    loadMaxKg: 400,
    /** Charge proposée la première fois (barre olympique vide). */
    loadDefaultKg: 20,
    repsMin: 1,
    repsMax: 12,
    repsDefault: 5,
    /** Historique affiché (mini-barres) : N semaines. */
    historyWeeks: 12,
    /** « En hausse » : meilleur 1RM des N derniers jours ≥ celui des N jours d'avant × (1 + fraction). */
    recentDays: 21,
    risingFraction: 0.01,
    /** « En baisse » : meilleur 1RM récent < celui d'avant × (1 − fraction). */
    fallingFraction: 0.03,
    /**
     * Stagnation (cahier des charges, section 5) : pas de nouveau record (à `risingFraction` près)
     * depuis N jours, avec au moins M saisies sur cette période et un historique plus ancien.
     */
    stagnationDays: 42,
    stagnationMinEntries: 3,
    /** Saisies nécessaires avant d'afficher une tendance. */
    trendMinEntries: 3,
    /** L'alerte de stagnation n'est pas répétée pendant N jours. */
    alertRepeatDays: 14,
  },

  /**
   * Composition corporelle (lot 3) : poids lissé 7 j, tendance sur 28 jours,
   * phrase d'interprétation croisant poids, force et protéines.
   */
  bodyComposition: {
    /** Tendance : pente (droite des moindres carrés) du poids lissé sur N jours, en kg par semaine. */
    trendDays: 28,
    /** Pesées nécessaires sur ces N jours pour calculer la tendance. */
    trendMinWeighings: 14,
    /** Poids « stable » : pente entre −N et +N kg par semaine. */
    stableKgPerWeek: 0.1,
    /** Prise « rapide » au-delà de N kg par semaine (même seuil que l'alerte poids du lot 2). */
    fastGainKgPerWeek: 0.35,
    /** Protéines : moyenne sur N jours avec repas, « atteintes » à 90 % de la cible (nutrition.reachedFraction). */
    proteinDays: 28,
    proteinMinDays: 10,
    /** Cible de poids « atteinte » à ± N kg. */
    targetToleranceKg: 0.5,
    /** Courbe du poids lissé sur la carte : N jours. */
    chartDays: 56,
    /**
     * Règles d'interprétation, dans l'ordre : la première qui correspond donne la phrase.
     * weight : tendance du poids ; strength : tendance de la force (null = inconnue) ;
     * protein : 'reached' | 'below' | null (inconnu). Un critère absent accepte tout.
     * tone : 'good' (vert), 'mid' (ambre) ou 'neutral' (gris).
     */
    rules: [
      { weight: ['slow-gain'], strength: ['up'], protein: ['reached'], tone: 'good', text: 'Profil de prise de muscle : poids en hausse lente, force en hausse et protéines au rendez-vous.' },
      { weight: ['slow-gain'], strength: ['up'], tone: 'mid', text: 'Prise lente et force en hausse : monte tes protéines pour que la prise soit surtout du muscle.' },
      { weight: ['fast-gain'], strength: ['flat', 'down'], tone: 'mid', text: 'Prise plus rapide que ta force : surveille les calories.' },
      { weight: ['fast-gain'], strength: ['up'], tone: 'mid', text: 'Ta force suit, mais la prise est rapide : retire environ 200 kcal par jour pour limiter le gras.' },
      { weight: ['fast-gain'], tone: 'mid', text: 'Prise rapide : surveille les calories et saisis tes séances pour suivre ta force.' },
      { weight: ['slow-gain'], strength: ['flat', 'down'], tone: 'mid', text: 'Poids en hausse sans progrès de force : vérifie ton programme et tes calories.' },
      { weight: ['stable'], strength: ['up'], tone: 'good', text: 'Poids stable et force en hausse : tu gagnes en force sans prendre de gras.' },
      { weight: ['stable'], strength: ['flat', 'down'], tone: 'neutral', text: 'Poids et force stables : pour prendre du muscle, ajoute environ 200 kcal par jour et vise la progression des charges.' },
      { weight: ['loss'], strength: ['up', 'flat'], protein: ['reached'], tone: 'good', text: 'Poids en baisse en gardant ta force : tu perds surtout du gras.' },
      { weight: ['loss'], strength: ['down'], tone: 'mid', text: 'Poids et force en baisse : remonte un peu les calories et garde tes protéines.' },
      { weight: ['loss'], tone: 'neutral', text: 'Poids en baisse : garde tes protéines à la cible pour préserver ton muscle.' },
      { weight: ['slow-gain'], tone: 'neutral', text: 'Prise lente : saisis tes séances de musculation pour savoir si ta force suit.' },
      { weight: ['stable'], tone: 'neutral', text: 'Poids stable : saisis tes séances de musculation pour suivre ta force.' },
    ] as readonly BodyRule[],
  },

  /** Suggestions d'autres sports (lot 3) : combler les manques, avec des activités faciles à Paris. */
  suggestions: {
    /** Endurance douce : minutes de zone 2 sur les N derniers jours (aujourd'hui compris), comparées à la cible hebdomadaire. */
    zone2WindowDays: 7,
    /** Mobilité : aucune séance de ces types (yoga 83, étirements 71, pilates 48) depuis N jours. */
    mobilityTypes: [83, 71, 48] as readonly number[],
    mobilityWindowDays: 21,
    /** Quand plusieurs manques : ordre de priorité (le premier donne la suggestion principale). */
    gapPriority: ['endurance', 'mobility'] as readonly ('endurance' | 'mobility')[],
  },

  /**
   * Liens observés (lot 3, onglet Tendances) : pour chaque paire, on compare deux groupes de jours
   * (situation étudiée / situation de référence) sur le résultat qui suit.
   * Force du lien = écart des moyennes ÷ écart-type commun (« d de Cohen »).
   */
  correlations: {
    windowDays: 90,
    /** Jours comparables nécessaires (tous groupes confondus), et minimum par groupe. */
    minDays: 20,
    minPerGroup: 5,
    /** Régularité : même sens dans la 1re et la 2e moitié de la période, avec au moins N jours par groupe dans chaque moitié. */
    minPerGroupPerHalf: 2,
    /** Seuils de force (valeur absolue du d de Cohen). Sous `weak`, le lien n'est pas affiché. */
    weak: 0.3,
    moderate: 0.5,
    strong: 0.8,
    /** Au plus N liens affichés, du plus fort au plus faible. */
    maxShown: 3,
    /** Séance « du soir » : commencée à partir de cette heure. */
    lateSessionHour: 20,
  },

  /** Nutrition : une cible est « atteinte » à partir de cette part (DESIGN.md : 90 %). */
  nutrition: {
    reachedFraction: 0.9,
    /** Rappel du matin : calories de la veille à plus de ±N (part de la cible) de la cible. */
    caloriesToleranceFraction: 0.1,
    /** Fenêtre du compteur « Sous la cible · n jours sur 7 ». */
    weekDays: 7,
  },

  /** Alertes (cahier des charges, sections 4 F2 et 5). */
  alerts: {
    /** Au plus N alertes par jour. */
    maxPerDay: 2,
    /** Une même alerte n'est pas répétée pendant N jours, sauf si elle s'aggrave (niveau supérieur). */
    repeatDays: 3,
    /** Alerte « qui persiste » : N fois sur les M derniers jours → rappel « avis médical ». */
    persistentCount: 3,
    persistentWindowDays: 14,
    /** HRV : N nuits d'affilée sous la plage normale. */
    hrvConsecutiveNights: 3,
    /** FC au repos : plus de N bpm au-dessus de la moyenne 30 j, pendant M jours d'affilée. */
    restingHrDeltaBpm: 5,
    restingHrDays: 2,
    /** Sommeil court : moins de N minutes, au moins `shortNights` nuits sur les `windowNights` dernières. */
    sleepShortMinutes: 6 * 60,
    sleepShortNights: 3,
    sleepWindowNights: 4,
    /** Heure de coucher : écart entre le plus tôt et le plus tard sur N nuits (au moins `bedtimeMinNights`). */
    bedtimeWindowNights: 7,
    bedtimeMinNights: 5,
    bedtimeSpreadMinutes: 90,
    /** Charge : sous-charge pendant N jours d'affilée. Combinaison « surcharge » au-dessus de `overloadRatio`. */
    underloadDays: 14,
    overloadRatio: 1.3,
    /** Poids : tendance de la moyenne 7 j sur N semaines, en kg par semaine. */
    weightWeeks: 3,
    weightGainMaxKgPerWeek: 0.35,
    weightLossMaxKgPerWeek: 0.75,
    /** Protéines : sous la cible plus de N jours sur les M derniers jours complets (avec repas). */
    proteinWindowDays: 7,
    proteinMaxDaysBelow: 3,
  },

  /** Plage silencieuse par défaut : aucune notification d'alerte entre ces heures. */
  quietHours: {
    defaultStart: { hour: 22, minute: 0 },
    defaultEnd: { hour: 7, minute: 0 },
    /** Pas de réglage des heures de la plage (minutes). */
    stepMinutes: 30,
  },

  /** Export CSV : séparateur adapté à Excel en français. */
  csv: { separator: ';', decimalComma: true },

  /** Notification du récap du matin. */
  notification: {
    /** Heure par défaut (modifiable dans Réglages). */
    defaultHour: 7,
    defaultMinute: 30,
    /** Pas de réglage de l'heure (minutes). */
    stepMinutes: 15,
    /**
     * Notifications programmées à l'avance (jours). Si la tâche de fond ne tourne pas
     * pendant quelques jours, le rappel arrive quand même (avec un texte générique).
     */
    daysAhead: 7,
  },

  /** Coach IA local (lot 4) : modèle attendu, choisi au test de faisabilité (docs/RAPPORT_LOT_4_MODELE.md). */
  coach: {
    model: {
      label: 'LFM2.5 1.2B Instruct (Q4_K_M)',
      fileName: 'LFM2.5-1.2B-Instruct-Q4_K_M.gguf',
      /** Taille exacte du fichier (octets) : premier contrôle, instantané. */
      sizeBytes: 730_895_168,
      /** Empreinte SHA-256 du fichier : second contrôle (fichier exact et intact). */
      sha256: 'b1b3de114215d9507409a662a501a631095a479a419584e8a2ded6304b19b4f5',
      /** Adresse figée (version précise), affichée pour le téléchargement depuis l'ordinateur. */
      downloadUrl:
        'https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF/resolve/8ed288026e23958ad9dfa92d53ed773a8eee7125/LFM2.5-1.2B-Instruct-Q4_K_M.gguf',
    },
    /**
     * Espace libre demandé avant l'import : le sélecteur copie d'abord le fichier,
     * puis il est déplacé dans l'espace privé de l'app. Marge en plus de la taille du fichier (octets).
     */
    freeSpaceMarginBytes: 300 * 1024 * 1024,
    /**
     * Résumé chiffré donné au coach (étape C2) : seule source de chiffres du coach.
     * Fenêtres courte et longue (jours, aujourd'hui compris) et nuits minimum pour une moyenne.
     */
    context: {
      shortDays: 7,
      longDays: 30,
      minNights: 3,
      /** Alertes reprises dans le résumé : celles des N derniers jours. */
      alertDays: 7,
      /** Tendance 7 j / 30 j : « en hausse » ou « en baisse » au-delà de cet écart, sinon « stable ». */
      recoveryTrendPoints: 3,
      sleepTrendMinutes: 20,
      /** FC au repos « comme d'habitude » si l'écart à la moyenne 30 j est sous N bpm. */
      restingHrUsualBpm: 1,
      /** Protéines : verdict sur 7 jours seulement avec au moins N jours de repas enregistrés. */
      minNutritionDays: 4,
    },
    /**
     * Génération (étape C3). Partage des rôles : l'app écrit le constat chiffré (« Chiffres utilisés »),
     * le modèle n'écrit que l'explication et l'action, SANS aucun chiffre. Longueur limitée,
     * une seconde chance, puis un conseil de repli.
     */
    generation: {
      maxTokens: 200,
      maxAttempts: 2,
      /** Rubriques du constat pour une question ou un « Pourquoi ? » (au plus N). */
      factSections: 3,
      /** Rubriques du constat du bilan de la semaine (celles qui sont disponibles). */
      weeklySections: ['recovery', 'sleep', 'hrv', 'restingHr', 'load', 'zone2', 'nutrition', 'strength', 'weight'] as readonly string[],
      /** Actions numérotées dans le bilan de la semaine (exactement). */
      weeklyMaxActions: 2,
      /** Bilan : essais du modèle avant le repli de l'app, et phrases gardées pour la synthèse. */
      weeklyMaxAttempts: 3,
      weeklySynthesisSentences: 2,
    },
    /**
     * Sujets d'une question libre : mots-clés (expressions régulières, sans majuscules) → rubriques
     * du résumé mises en tête. Sans mot-clé reconnu : tout le résumé, dans l'ordre habituel.
     */
    focus: [
      { pattern: 'prot[ée]ine|manger|mange|nutrition|calorie|repas|alimentation', sections: ['nutrition', 'weight'] },
      { pattern: 'sommeil|dormi|dormir|nuit|coucher', sections: ['sleep', 'recovery'] },
      { pattern: 'hrv|variabilit', sections: ['hrv', 'recovery'] },
      { pattern: 'fc au repos|fréquence cardiaque|pouls|bpm', sections: ['restingHr', 'recovery'] },
      { pattern: 'charge|entra[iî]nement|séance|seance|surcharge', sections: ['load', 'zone2'] },
      { pattern: 'zone 2|endurance|cardio|course|courir', sections: ['zone2', 'load'] },
      { pattern: 'force|squat|développé|developpe|soulevé|souleve|1rm|muscu', sections: ['strength', 'nutrition'] },
      { pattern: 'poids|gras|muscle|maigrir|grossir|kilo', sections: ['weight', 'nutrition', 'strength'] },
      { pattern: 'récup|recup|forme|fatigu|énergie', sections: ['recovery', 'hrv', 'restingHr', 'sleep'] },
    ] as readonly { pattern: string; sections: readonly string[] }[],
    /**
     * Bilan de la semaine (étape C4) : l'app décide elle-même ce qui a marché et ce qui coince,
     * d'après les verdicts du résumé. Une règle s'applique si la valeur `field` de la rubrique
     * `section` vérifie `op` / `value`. `action` : action proposée par l'app si le conseil du modèle est
     * refusé (pour « ce qui coince » : corriger ; pour « ce qui a marché » : garder).
     * Les règles d'une même rubrique sont testées dans l'ordre ; la première qui s'applique compte.
     */
    weekly: {
      // Ordre = priorité d'affichage (au plus `maxItems`) : d'abord ce sur quoi on agit directement
      // (charge, sommeil, protéines), puis leurs conséquences (HRV, récupération).
      rules: [
        { section: 'load', field: 'status', op: 'in', value: ['rising', 'high'], kind: 'stuck', text: 'Charge d’entraînement en hausse', action: 'Remplace une séance intense par une séance légère ou de mobilité.' },
        { section: 'load', field: 'status', op: 'eq', value: 'under', kind: 'stuck', text: 'Charge d’entraînement en baisse (sous-charge)', action: 'Ajoute une séance modérée cette semaine.' },
        { section: 'load', field: 'status', op: 'eq', value: 'balanced', kind: 'worked', text: 'Charge d’entraînement équilibrée', action: 'Garde le même volume d’entraînement la semaine prochaine.' },
        { section: 'sleep', field: 'belowTarget', op: 'eq', value: true, kind: 'stuck', text: 'Sommeil sous la durée visée', action: 'Couche-toi 30 minutes plus tôt les soirs de semaine.' },
        { section: 'sleep', field: 'belowTarget', op: 'eq', value: false, kind: 'worked', text: 'Sommeil à la durée visée', action: 'Garde tes horaires de coucher actuels.' },
        // Seuil identique à l'alerte protéines (alerts.proteinMaxDaysBelow).
        { section: 'nutrition', field: 'proteinDaysBelow7d', op: 'gt', value: 3, kind: 'stuck', text: 'Protéines souvent sous la cible', action: 'Ajoute une portion de protéines à un repas chaque jour.' },
        { section: 'nutrition', field: 'proteinDaysBelow7d', op: 'lte', value: 3, kind: 'worked', text: 'Protéines le plus souvent dans la cible', action: 'Garde tes apports en protéines au même niveau.' },
        { section: 'zone2', field: 'zone2Reached', op: 'eq', value: false, kind: 'stuck', text: 'Zone 2 sous la cible', action: 'Ajoute une sortie d’endurance douce en zone 2.' },
        { section: 'zone2', field: 'zone2Reached', op: 'eq', value: true, kind: 'worked', text: 'Cible de zone 2 atteinte', action: 'Garde ta séance d’endurance douce en zone 2.' },
        { section: 'hrv', field: 'position', op: 'eq', value: 'below', kind: 'stuck', text: 'HRV sous ta plage normale', action: 'Garde une journée légère ou de mobilité après chaque grosse séance.' },
        { section: 'hrv', field: 'position', op: 'in', value: ['within', 'above'], kind: 'worked', text: 'HRV dans ta plage normale', action: 'Garde l’alternance entre séances intenses et journées plus légères.' },
        { section: 'recovery', field: 'trend', op: 'eq', value: 'en baisse', kind: 'stuck', text: 'Récupération en baisse', action: 'Allège une séance cette semaine.' },
        { section: 'recovery', field: 'trend', op: 'eq', value: 'en hausse', kind: 'worked', text: 'Récupération en hausse', action: 'Garde le même rythme de séances et de repos.' },
        { section: 'strength', field: 'squatTrend', op: 'eq', value: 'rising', kind: 'worked', text: 'Squat en hausse', action: 'Continue ton programme de squat tel quel.' },
        { section: 'strength', field: 'benchTrend', op: 'eq', value: 'rising', kind: 'worked', text: 'Développé couché en hausse', action: 'Continue ton programme de développé couché tel quel.' },
        { section: 'strength', field: 'deadliftTrend', op: 'eq', value: 'rising', kind: 'worked', text: 'Soulevé de terre en hausse', action: 'Continue ton programme de soulevé de terre tel quel.' },
        { section: 'strength', field: 'squatTrend', op: 'eq', value: 'stagnant', kind: 'stuck', text: 'Squat qui stagne', action: 'Change de programme de squat (séries, répétitions ou variante).' },
        { section: 'strength', field: 'benchTrend', op: 'eq', value: 'stagnant', kind: 'stuck', text: 'Développé couché qui stagne', action: 'Change de programme de développé couché (séries, répétitions ou variante).' },
        { section: 'strength', field: 'deadliftTrend', op: 'eq', value: 'stagnant', kind: 'stuck', text: 'Soulevé de terre qui stagne', action: 'Change de programme de soulevé de terre (séries, répétitions ou variante).' },
      ] as readonly WeeklyRule[],
      /** Points affichés au plus dans « Ce qui a marché » et « Ce qui coince ». */
      maxItems: 3,
    },
    /**
     * Questions libres (étape C6). Questions suggérées : une par rubrique qui coince (même règles que
     * le bilan de la semaine), complétées par des questions générales, au plus `maxSuggestions`.
     */
    questions: {
      maxLength: 200,
      /** Échanges affichés dans la conversation (les plus récents). */
      historyShown: 20,
      maxSuggestions: 3,
      bySection: {
        load: 'Ma charge d’entraînement est-elle trop élevée ?',
        sleep: 'Comment améliorer mon sommeil ?',
        nutrition: 'Est-ce que je mange assez de protéines ?',
        zone2: 'Comment ajouter de la zone 2 dans ma semaine ?',
        hrv: 'Pourquoi ma HRV est-elle basse ?',
        recovery: 'Pourquoi ma récupération baisse-t-elle ?',
        strength: 'Comment relancer ma progression en force ?',
      } as Readonly<Record<string, string>>,
      general: [
        'Est-ce que je récupère bien ?',
        'Comment progresser en force ?',
        'Est-ce que je dors assez ?',
      ] as readonly string[],
    },
    /** Rubriques liées au thème d'une alerte (« Pourquoi ? »). */
    alertFocus: {
      recovery: ['recovery', 'hrv', 'restingHr', 'sleep'],
      load: ['load', 'zone2', 'recovery'],
      nutrition: ['nutrition', 'weight'],
    } as Readonly<Record<string, readonly string[]>>,
    /** Contrôle des réponses (expressions régulières, sans majuscules). */
    guard: {
      /**
       * Mots de diagnostic médical : réponse refusée, sauf si le mot figure déjà dans le résumé
       * (le coach reprend alors un texte de l'app, par exemple une alerte « maladie ou stress »).
       */
      diagnosis: [
        'maladi',
        'malade',
        'patholog',
        'diagnosti',
        'syndrome',
        'infection',
        'd[ée]pression',
        'burn-?out',
        'insomnie',
        'apn[ée]e',
        'trouble[s]? du sommeil',
      ] as readonly string[],
      /** Renvoi vers un professionnel : accepté seulement si une alerte revient souvent. */
      referral: [
        'consult\\w* (un|une|ton|ta|le) (professionnel|médecin|medecin|docteur|spécialiste|specialiste)',
        'avis médical',
        'voir un médecin',
      ] as readonly string[],
      /** Vouvoiement : refusé (l'app tutoie). */
      formalYou: ['\\bvous\\b', '\\bvotre\\b', '\\bvos\\b'] as readonly string[],
      /** Noms qui contiennent un chiffre sans en être un (« zone 2 », « 1RM ») : acceptés dans le conseil. */
      numberNames: ['zone\\s*[1-5]', '\\b1\\s?rm\\b', 'n°\\s*\\d'] as readonly string[],
      /** Négation juste avant une expression (« pas assez de protéines ») : ne contredit pas le verdict. */
      negation: "\\b(pas|plus|jamais|manque|manques|ne|n')\\b[^.!?]{0,20}$",
      /**
       * Verdicts du résumé à ne pas contredire : si la valeur `field` de la rubrique `section`
       * vaut l'une des valeurs `when`, aucune expression `forbidden` ne doit apparaître.
       */
      contradictions: [
        {
          section: 'nutrition',
          field: 'proteinReached',
          when: [false],
          forbidden: [
            '(assez|suffisamment) de prot[ée]ines',
            'prot[ée]ines (sont |est )?(suffisante|bonne|solide)',
            'bonne (base )?nutrition',
            'apport (en prot[ée]ines )?(est )?(solide|suffisant|bon)',
            "(cible|objectif) (de prot[ée]ines )?(est )?atteint",
            'tu manges assez',
            'proche de (ta |la )?cible',
            'dans (ta |la )?cible',
            'bonne base',
          ],
        },
        {
          section: 'sleep',
          field: 'belowTarget',
          when: [true],
          forbidden: [
            '(bien|assez) dormi',
            'sommeil (est |a été |reste )?(bon|suffisant|correct|excellent)',
            'bonne gestion du sommeil',
            'bon sommeil',
          ],
        },
        {
          section: 'hrv',
          field: 'position',
          when: ['below'],
          forbidden: ['hrv (est |reste )?(bonne|normale|stable|en hausse)', 'hrv dans (ta|la) (plage|norme)'],
        },
        {
          section: 'load',
          field: 'status',
          when: ['rising', 'high'],
          forbidden: [
            'charge (est |reste )?(normale|équilibrée|equilibree|faible|légère|legere)',
            'charge[^.!?]{0,60}(positi|bonne nouvelle|encourageant)',
          ],
        },
        {
          section: 'zone2',
          field: 'zone2Reached',
          when: [false],
          forbidden: ['(cible de )?zone 2 (est )?(atteinte|suffisante)'],
        },
        {
          section: 'recovery',
          field: 'trend',
          when: ['en baisse'],
          forbidden: ['récupération (est |reste )?(bonne|excellente|en hausse|stable)', 'progression en récupération'],
        },
      ] as readonly { section: string; field: string; when: readonly (string | number | boolean)[]; forbidden: readonly string[] }[],
    },
  },

  /** Synchronisation Health Connect. */
  sync: {
    /** Synchro en arrière-plan : au plus une fois par N minutes (Android impose 15 minimum). */
    backgroundIntervalMinutes: 60,
    /** Profondeur de la toute première synchronisation (jours). */
    firstSyncDays: 90,
    /** Recouvrement à chaque synchro, pour rattraper les données arrivées en retard (jours). */
    overlapDays: 2,
    /** Écran Aube du lancement : affiché au plus N secondes, même si la synchro continue. */
    launchScreenMaxSeconds: 10,
  },
} as const;

export type Settings = typeof SETTINGS;
