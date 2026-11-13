# Cahier des charges – App de biohacking Android

Nov 12, 2026 · @Lolo

## 1. Contexte et objectifs

L'application transforme les données de mes capteurs en trois choses : un récap chaque matin, des alertes quand une métrique dérape, et un suivi de ma progression sportive. Elle est conçue pour un seul utilisateur, moi, et tourne entièrement sur mon téléphone Android.

**Profil**

- Environ 5 h de sport par semaine : musculation et entraînement composite, avec parfois de la course et de l'escalade.
- Objectif physique : être musclé sans être gras (prise de muscle et maîtrise du taux de gras).

**Objectifs de l'application**

1. **Récap du matin** : savoir avant la journée comment j'ai récupéré et quelle intensité viser.
2. **Alertes proactives** : être prévenu quand une métrique sort de ma norme personnelle (HRV, FC au repos, sommeil, charge).
3. **Insights sport** : répondre à « est-ce que je progresse ? » et « qu'est-ce que je pourrais ajouter comme autre sport ? ».
4. **Recommandations actionnables** : chaque constat débouche sur une action concrète, pas seulement sur un chiffre.

**Hors périmètre pour l'instant** : coach IA conversationnel (prévu dans un lot ultérieur), multi-utilisateurs, publication sur le Play Store, synchronisation cloud.

## 2. Sources de données

Le Helio Strap, lu via Health Connect, est la source principale et automatique. L'app Zepp écrit dans Health Connect depuis 2024 ([Notebookcheck](https://www.notebookcheck.net/Amazfit-smartwatches-get-new-Health-Connect-data-sync-feature.951489.0.html)). La Suunto, elle, n'écrit rien dans Health Connect (confirmé au lot 0) : ses séances sont importées une fois par mois à partir des fichiers FIT exportés depuis l'app Suunto. Le FIT est le format d'export le plus complet : position, horaires, FC, puissance, cadence ([Suunto](https://www.suunto.com/en-hr/Support/faq-articles/suunto-app/what-type-of-files-can-i-export-from-the-suunto-app/)).

| Source | Données | Voie d'accès | Point de vigilance |
| --- | --- | --- | --- |
| Amazfit Helio Strap (app Zepp), porté en permanence | FC continue, FC au repos, HRV, sommeil, séances, pas, poids (confirmés au lot 0) ; pas de VO2max | Health Connect, automatique | HRV et FC au repos arrivent en nombreuses mesures par jour (voir section 3) ; latence de 15 à 30 min |
| Suunto 9 Peak Pro (app Suunto) | Séances détaillées : GPS, distance, dénivelé, allure, FC, cadence | Import mensuel de fichiers FIT, exportés séance par séance (menu « … » d'une séance dans l'app Suunto) | Ni sommeil ni HRV. Données disponibles en différé (jusqu'à 30 jours). Import de plusieurs fichiers d'un coup |
| Poids | Poids, éventuellement % de masse grasse | Saisie manuelle dans l'app (prioritaire) ; Zepp via Health Connect en secours | Valeur Zepp retenue seulement les jours sans saisie manuelle. Pesée dans les mêmes conditions (le matin à jeun) |
| Suivi macro (app développée par un ami) | Calories et macros par jour (protéines, glucides, lipides) | Import du fichier d'export JSON | Récupérer un exemple d'export et fixer le format avec l'ami (champs, unités, dates) |
| Ressenti (optionnel) | Fatigue, courbatures, humeur, note de séance (1 à 5) | Saisie dans l'app, 10 secondes le matin | Facultatif, mais très utile pour les corrélations |

**Constat du lot 0** (voir [RAPPORT_LOT_0.md](RAPPORT_LOT_0.md)) : Zepp écrit dans Health Connect tous les types lus au lot 0 (dont la HRV et le poids), sauf la VO2max. La Suunto n'écrit rien : sa connexion à Health Connect échoue du côté de l'app Suunto. Le Helio Strap est donc la seule source automatique ; la Suunto passe par l'import mensuel de fichiers FIT.

**Principe d'ouverture** : chaque source passe par un « connecteur » interchangeable. On peut ainsi ajouter plus tard l'API Suunto, des imports FIT/GPX ou une autre app sans toucher au reste.

**Prérequis technique** : lire l'historique et lire en arrière-plan demandent des permissions Health Connect spécifiques ([doc Android](https://developer.android.com/health-and-fitness/health-connect/data-types)). En usage personnel, sans publication sur le Play Store, aucune déclaration n'est à faire auprès de Google.

## 3. Fusion des deux capteurs

La règle : pas de moyenne, une source prioritaire par métrique et une source de secours. Moyenner deux capteurs qui mesurent différemment brouille les tendances. Pour les insights, la constance d'une même source compte plus que la précision absolue.

| Métrique | Source prioritaire | Secours | Règle |
| --- | --- | --- | --- |
| FC pendant les séances | Helio Strap | Fichier FIT Suunto | Le capteur optique au poignet décroche en musculation et en escalade (flexion du poignet, prise en main). Le strap est plus stable. |
| GPS, distance, dénivelé, allure | Fichier FIT Suunto | — | Disponible après l'import mensuel |
| Séances | Helio Strap (immédiat) | — | À l'import FIT, une séance Suunto qui chevauche une séance Helio à plus de 50 % la complète (GPS, type précis) au lieu de créer un doublon |
| Sommeil | Helio Strap (porté en permanence) | — | Une seule source à vie, pour garder des tendances comparables |
| HRV nocturne | Helio Strap (Zepp transmet la HRV : confirmé au lot 0) | — | Ne jamais mélanger : chaque constructeur calcule la HRV différemment. Une valeur par nuit : moyenne des mesures prises pendant le sommeil principal, calculée sur le logarithme de la rMSSD (atténue les pics isolés) |
| FC au repos | Helio Strap | — | Une valeur par nuit : moyenne des 5 valeurs les plus basses mesurées pendant le sommeil principal (moins sensible qu'un minimum unique à une mesure erronée) |
| Poids | Saisie manuelle dans l'app | Zepp (Health Connect) | Jamais de moyenne des deux : la saisie fait foi ; la valeur Zepp ne sert que les jours sans saisie |
| Pas, calories dépensées | Helio Strap | — | Une seule source, pas de cumul (double comptage) |

Pour la HRV et la FC au repos, sans sommeil principal enregistré la nuit concernée, la valeur est affichée « non calculable ». Les paramètres (dont le nombre de valeurs basses retenues) sont dans `src/domain/settings.ts`.

**Contrôle de cohérence** : à l'import FIT, si la FC moyenne d'une séance Suunto diffère de plus de 10 % de celle du Helio Strap, la séance est signalée « donnée douteuse » et exclue des calculs de tendance.

**Paramétrable** : le tableau ci-dessus est un réglage de l'application, pas du code figé. On pourra le modifier après quelques semaines de comparaison réelle des deux capteurs.

## 4. Fonctionnalités

Quatre écrans et un moteur de règles couvrent le besoin : récap du matin, alertes, progression sportive, tendances.

### F1 – Récap du matin

- Notification à une heure réglable (par défaut 7 h 30), ou dès que la nuit est synchronisée.
- Contenu : score de récupération (0 à 100) avec un code couleur, sommeil de la nuit (durée, régularité), HRV et FC au repos comparées à ma norme sur 7 et 30 jours, charge d'entraînement de la semaine.
- **Une recommandation du jour**, par exemple : « Bonne récupération : séance lourde OK » ou « HRV basse depuis 3 jours : séance technique ou mobilité, couché avant 23 h ».
- Rappel nutrition si la veille est sous l'objectif de protéines ou si le bilan calorique s'écarte de la cible.

### F2 – Alertes proactives

- Déclenchées par des règles sur ma norme personnelle, pas sur des seuils génériques (exemples en section 5).
- Chaque alerte contient le constat, la cause probable et une action.
- Pas plus de 2 alertes par jour, regroupées dans le récap quand ce n'est pas urgent. Plage silencieuse la nuit.

### F3 – Progression sportive

- Volume et intensité par semaine et par type de sport.
- Musculation : la montre ne voit ni les charges ni les répétitions. Il faut donc une **saisie rapide des exercices clés** (squat, développé, traction…) pour suivre la force (1RM estimé).
- Course : allure à FC donnée, à partir des fichiers FIT importés. VO2max : aucune source à ce jour (point ouvert, section 8).
- Composition corporelle : courbe du poids lissée sur 7 jours, croisée avec les calories et les protéines. On verra ainsi si je prends du muscle ou du gras.
- **Suggestions d'autres sports** à partir de mes manques : par exemple peu d'endurance fondamentale (zone 2), peu de mobilité ou trop de charge sur le haut du corps.

### F4 – Tendances et corrélations

- Courbes sur 7, 30 et 90 jours pour chaque métrique.
- Corrélations personnelles calculées localement, affichées seulement quand elles sont assez solides, par exemple : « Les soirs de séance après 20 h, ta HRV de la nuit est inférieure de 12 % en moyenne ».

### F5 – Gestion des données

- Synchronisation Health Connect manuelle et automatique (toutes les heures).
- Import du fichier de nutrition, import mensuel des fichiers FIT Suunto (plusieurs fichiers d'un coup, avec rappel mensuel), saisie du poids et du ressenti.
- Export complet en CSV (sauvegarde) et effacement des données.
- Écran de diagnostic : dernière synchro par source, types de données reçus, trous dans les données.

## 5. Indicateurs et règles de calcul

Tous les indicateurs se comparent à ma propre norme : une valeur n'est « mauvaise » que si elle sort de ma plage habituelle. Il faut donc environ 3 à 4 semaines de données avant d'activer les alertes (phase de calibration). Les seuils ci-dessous sont des valeurs de départ, tous réglables.

| Indicateur | Calcul | Règle d'alerte (valeur de départ) |
| --- | --- | --- |
| HRV nocturne | Moyenne glissante 7 j de ln(rMSSD), comparée à la plage normale sur 60 j (moyenne ± 1 écart-type) | Moyenne 7 j sous la plage normale, ou 3 nuits d'affilée sous la plage |
| FC au repos | Valeur nocturne, comparée à la moyenne sur 30 j | Plus de 5 bpm au-dessus de la moyenne pendant 2 jours (fatigue ou maladie qui débute) |
| Sommeil | Durée, régularité de l'heure de coucher, efficacité | Moins de 6 h pendant 3 nuits sur 4, ou heure de coucher qui varie de plus d'1 h 30 sur la semaine |
| Charge d'entraînement | TRIMP par séance (durée × intensité cardiaque), charge aiguë (7 j) / chronique (28 j) | Ratio supérieur à 1,5 (pic de charge) ou inférieur à 0,8 pendant 2 semaines (désentraînement) |
| Score de récupération | Combinaison pondérée HRV, FC au repos, sommeil et charge de la veille, sur 0 à 100 | Moins de 40 : recommandation de séance légère |
| Poids | Moyenne glissante 7 j | Tendance hors de la fourchette cible fixée (prise ou perte trop rapide) sur 3 semaines |
| Protéines | g/kg/jour depuis l'export nutrition | Sous la cible plus de 3 jours sur 7 |
| Force (musculation) | 1RM estimé par exercice clé (formule d'Epley) | Stagnation sur 6 semaines : suggestion de changer de programme |

**Combinaisons** : les alertes les plus utiles croisent plusieurs signaux. Exemple : HRV basse + FC au repos haute + charge élevée = alerte « surcharge ». HRV basse + FC au repos haute avec une charge normale = alerte « possible début de maladie ou stress ».

**Transparence** : chaque score affiche les éléments qui l'ont fait monter ou baisser. Aucune « boîte noire ».

Ces règles servent au suivi personnel et ne remplacent pas un avis médical. L'app le rappelle quand une alerte persiste.

## 6. Exigences non fonctionnelles

Application Expo (React Native, TypeScript), 100 % locale, développée avec Claude Code selon les règles du CLAUDE.md du projet. Expo garde ma méthode habituelle (build de l'APK par GitHub Actions). Health Connect contenant du code natif, les tests passent par un build de développement et non par Expo Go.

**Confidentialité**

- Aucune donnée ne quitte le téléphone : l'APK de production n'a pas la permission Internet, ce qui le garantit techniquement (le build de développement en a besoin pour se recharger depuis l'ordinateur).
- Base de données locale chiffrée. Accès à l'app protégé par empreinte ou code (option).
- Sauvegarde uniquement par export manuel d'un fichier.

**Stack technique proposée**

| Brique | Choix | Rôle |
| --- | --- | --- |
| Langage et interface | Expo (React Native, TypeScript), Expo Router | Écrans, thème clair et sombre |
| Données de santé | react-native-health-connect (plugin Expo intégré) | Lecture des capteurs, historique compris |
| Stockage | expo-sqlite | Données fusionnées, normes, alertes |
| Tâches de fond | expo-background-task (WorkManager, 15 min minimum) | Synchro horaire, calculs de nuit, récap du matin |
| Notifications | expo-notifications | Récap du matin, alertes |
| Tests des calculs | Jest (jest-expo) sur données fictives | Vérifier les règles sans lire le code |
| Architecture | Dossiers séparés : sources, domain (calculs), db, écrans | Ajouter une source sans casser le reste |

**Appareil cible** : Android 14 ou plus récent (Health Connect y est intégré au système).

**Méthode de développement**

- Un fichier CLAUDE.md à la racine du projet (mes règles habituelles, adaptées aux données de santé), et ce cahier des charges copié dans docs/CAHIER\_DES\_CHARGES.md.
- Un lot = une branche git, livré sous forme d'APK que j'installe et teste sur mon téléphone.
- Les règles de calcul (section 5) sont couvertes par des tests automatiques sur des données fictives, pour vérifier les calculs sans avoir à lire le code.

**Performance et batterie** : synchro au plus une fois par heure, calculs lourds la nuit pendant la recharge, ouverture de l'app en moins de 2 secondes.

## 7. Découpage en lots

Le MVP correspond au lot 1 : un récap du matin fiable, basé sur des données fusionnées et ma norme personnelle. Les alertes viennent ensuite, parce qu'elles ont besoin de 3 à 4 semaines d'historique pour être justes.

1. **Lot 0 – Preuve de faisabilité des données** (terminé) : lecture Health Connect, inventaire des types reçus par source, écran de diagnostic. Résultat : [RAPPORT_LOT_0.md](RAPPORT_LOT_0.md).
2. **Lot 1 – MVP : récap du matin** : normes personnelles, score de récupération, notification du matin avec une recommandation, saisie du poids et du ressenti. *Condition de passage : 4 semaines d'usage quotidien, calibration des normes terminée.*
3. **Lot 2 – Alertes, charge et nutrition** : moteur de règles, alertes proactives, charge aiguë / chronique, import Suivi macro, suivi des protéines. *Condition de passage : alertes jugées pertinentes, moins de 2 fausses alertes par semaine.*
4. **Lot 3 – Progression et corrélations** : saisie des exercices clés, 1RM estimé, composition corporelle, import mensuel des FIT Suunto (GPS, allure), corrélations, suggestions d'autres sports. *Condition de passage : lots 1 à 3 stables et utilisés au quotidien.*
5. **Lot 4 – Coach IA (plus tard)** : questions en langage naturel sur mes données, modèle embarqué sur le téléphone de préférence.

Chaque lot est livré sous forme d'APK utilisable seul. On ne passe au suivant que si la condition de passage est remplie.

**Révision après le lot 0** : faite. Ce cahier intègre les constats du lot 0 (sections 2, 3 et 8). Les deux points bloquants pour le lot 1 (valeur par nuit, source du poids) sont tranchés.

## 8. Risques, points ouverts et prochaines étapes

Le risque HRV est levé : Zepp transmet la HRV. Les points d'attention sont désormais la Suunto hors de Health Connect et la façon de résumer les nombreuses mesures quotidiennes de HRV et de FC au repos.

| Risque | Impact | Parade |
| --- | --- | --- |
| HRV et FC au repos en nombreuses mesures par jour | Valeurs du matin instables, normes faussées | Une valeur par nuit (règle validée, section 3) |
| Suunto absente de Health Connect | GPS et allure des sorties disponibles en différé (jusqu'à 30 jours) | Import mensuel des FIT. Appli passerelle (Health Sync) en option si le temps réel devient utile |
| Oubli de l'import mensuel | Progression en course incomplète | Rappel mensuel dans l'app |
| Doublons ou trous de synchro | Charge et sommeil faux | Règles de fusion (section 3) et écran de diagnostic |
| Pas de charges ni de répétitions dans les données de musculation | Progression en force invisible | Saisie rapide des exercices clés (F3) |
| Seuils mal calibrés | Trop d'alertes, que je finis par ignorer | Calibration de 3 à 4 semaines, plafond de 2 alertes par jour, seuils réglables |
| Changement de format de l'export nutrition | Import cassé | Parseur isolé et message d'erreur clair |

**Points ouverts**

- [x] Quels types de données arrivent réellement dans Health Connect depuis Suunto et Zepp ? (lot 0 : tout depuis Zepp sauf VO2max, rien depuis la Suunto, voir [RAPPORT_LOT_0.md](RAPPORT_LOT_0.md))
- [x] Plan B pour la Suunto : import manuel mensuel des fichiers FIT (voir décisions)
- [x] HRV et FC au repos : règle « une valeur par nuit » validée (voir section 3 et décisions)
- [x] Poids : saisie manuelle prioritaire, Zepp en secours (voir section 3 et décisions)
- [ ] VO2max (aucune source) : retirer du cahier des charges, ou la lire plus tard dans les fichiers FIT Suunto si elle y figure
- [ ] Cibles personnelles : poids visé, protéines en g/kg, nombre de séances par semaine
- [ ] Exercices de musculation clés à suivre (lot 3)
- [ ] Exemple de fichier JSON exporté par Suivi macro (lot 2)

**Décisions prises**

- Le Helio Strap est porté en permanence : il devient la source de référence pour le sommeil, la HRV, la FC au repos, les pas et la FC des séances, lu via Health Connect.
- Suunto : pas de Health Connect. Import mensuel des fichiers FIT exportés depuis l'app Suunto (GPS, distance, allure), au lot 3.
- Nutrition : export JSON de l'app Suivi macro.
- Poids : la saisie manuelle dans l'app fait foi ; une valeur Zepp (Health Connect) n'est retenue que les jours sans saisie.
- HRV : une valeur par nuit, moyenne (sur le logarithme) des mesures du sommeil principal. FC au repos : moyenne des 5 valeurs les plus basses du sommeil principal. Sans sommeil enregistré : « non calculable ».
- Design : style sombre inspiré de Whoop, maquettes du lot 1 validées.

**Prochaines étapes**

1. ~~Rédiger DESIGN.md à partir des maquettes du lot 1.~~ Fait.
2. Lot 1 en cours (branche `lot-1-recap-matin`) : stockage local, normes, score de récupération, 4 écrans, notification du matin.
