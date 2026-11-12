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

Health Connect sera la voie principale, mais la HRV de la Suunto n'y arrive probablement pas : c'est le premier point à valider. D'après plusieurs intégrateurs, l'app Suunto écrit dans Health Connect les séances, les pas, la distance et la fréquence cardiaque, mais ni la HRV ni (selon certains) le sommeil ([Vora](https://askvora.com/blog/does-suunto-sync-with-apple-health), [FitMesh](https://www.fitmesh.fit/da/sync/suunto)). L'app Zepp (Helio Strap) écrit dans Health Connect depuis 2024, en sens unique ([Notebookcheck](https://www.notebookcheck.net/Amazfit-smartwatches-get-new-Health-Connect-data-sync-feature.951489.0.html)).

| Source | Données attendues | Voie d'accès | Point de vigilance |
| --- | --- | --- | --- |
| Suunto 9 Peak Pro (app Suunto) | Séances (type, durée, FC, calories, GPS), pas, FC | Health Connect | HRV et sommeil peu ou pas transmis. Plan B : API Suunto (« 247 data » : sommeil, HRV, FC repos), qui exige un programme partenaire ([Tredict](https://www.tredict.com/blog/suunto_hrv_and_sleep_data/)) |
| Amazfit Helio Strap (app Zepp), porté en permanence | FC continue, sommeil, séances, pas, peut-être HRV et SpO2 | Health Connect | Liste exacte des types écrits à vérifier sur mon téléphone, latence de 15 à 30 min |
| Poids | Poids, éventuellement % de masse grasse | Saisie manuelle dans l'app pour démarrer ; balance connectée via Health Connect possible plus tard | Pesée dans les mêmes conditions (le matin à jeun) pour lisser le bruit |
| Suivi macro (app développée par un ami) | Calories et macros par jour (protéines, glucides, lipides) | Import du fichier d'export JSON | Récupérer un exemple d'export et fixer le format avec l'ami (champs, unités, dates) |
| Ressenti (optionnel) | Fatigue, courbatures, humeur, note de séance (1 à 5) | Saisie dans l'app, 10 secondes le matin | Facultatif, mais très utile pour les corrélations |

**Principe d'ouverture** : chaque source passe par un « connecteur » interchangeable. On peut ainsi ajouter plus tard l'API Suunto, des imports FIT/GPX ou une autre app sans toucher au reste.

**Prérequis technique** : lire l'historique et lire en arrière-plan demandent des permissions Health Connect spécifiques ([doc Android](https://developer.android.com/health-and-fitness/health-connect/data-types)). En usage personnel, sans publication sur le Play Store, aucune déclaration n'est à faire auprès de Google.

## 3. Fusion des deux capteurs

La règle : pas de moyenne, une source prioritaire par métrique et une source de secours. Moyenner deux capteurs qui mesurent différemment brouille les tendances. Pour les insights, la constance d'une même source compte plus que la précision absolue.

| Métrique | Source prioritaire | Secours | Règle |
| --- | --- | --- | --- |
| FC pendant les séances | Helio Strap | Suunto | Le capteur optique au poignet décroche en musculation et en escalade (flexion du poignet, prise en main). Le strap est plus stable. |
| GPS, distance, dénivelé | Suunto | — | Seule la montre a un GPS |
| Séances | Fusion | — | Deux séances qui se chevauchent à plus de 50 % = une seule séance. Le type et le GPS viennent de la Suunto, la FC du strap. |
| Sommeil | Helio Strap (porté en permanence) | Suunto | Une seule source à vie, pour garder des tendances comparables |
| HRV nocturne | Helio Strap, si Zepp transmet la HRV (à confirmer au lot 0) | — | Ne jamais mélanger : chaque constructeur calcule la HRV différemment |
| FC au repos | Même source que la HRV | L'autre capteur | Mesurée pendant le sommeil |
| Pas, calories dépensées | Suunto | Helio Strap | Pas de cumul des deux sources (double comptage) |

**Contrôle de cohérence** : si les deux capteurs donnent une FC moyenne de séance qui diffère de plus de 10 %, la séance est signalée « donnée douteuse » et exclue des calculs de tendance.

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
- Course : allure à FC donnée, VO2max si elle est disponible.
- Composition corporelle : courbe du poids lissée sur 7 jours, croisée avec les calories et les protéines. On verra ainsi si je prends du muscle ou du gras.
- **Suggestions d'autres sports** à partir de mes manques : par exemple peu d'endurance fondamentale (zone 2), peu de mobilité ou trop de charge sur le haut du corps.

### F4 – Tendances et corrélations

- Courbes sur 7, 30 et 90 jours pour chaque métrique.
- Corrélations personnelles calculées localement, affichées seulement quand elles sont assez solides, par exemple : « Les soirs de séance après 20 h, ta HRV de la nuit est inférieure de 12 % en moyenne ».

### F5 – Gestion des données

- Synchronisation Health Connect manuelle et automatique (toutes les heures).
- Import du fichier de nutrition, saisie du poids et du ressenti.
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

&#91;embedded content: Découpage en lots · 5 lots, 4 conditions de passage\]

Chaque lot est livré sous forme d'APK utilisable seul. On ne passe au suivant que si la condition de passage est remplie.

**Révision après le lot 0** : le lot 0 sert à constater quelles données on récupère réellement des deux capteurs. Avant de lancer le lot 1, on ajuste ce cahier des charges en conséquence : sources (section 2), règles de fusion (section 3), indicateurs calculables (section 5) et contenu des lots.

## 8. Risques, points ouverts et prochaines étapes

Le risque principal est l'absence de HRV dans Health Connect. Sans HRV, le score de récupération repose sur la FC au repos et le sommeil, et devient moins fin.

| Risque | Impact | Parade |
| --- | --- | --- |
| HRV absente de Health Connect (Suunto et/ou Zepp) | Score de récupération dégradé | Vérifier au lot 0. Sinon : HRV du strap si Zepp l'écrit, puis API Suunto, ou export manuel |
| Doublons ou trous de synchro entre les deux apps | Charge et sommeil faux | Règles de fusion (section 3) et écran de diagnostic |
| Pas de charges ni de répétitions dans les données de musculation | Progression en force invisible | Saisie rapide des exercices clés (F3) |
| Seuils mal calibrés | Trop d'alertes, que je finis par ignorer | Calibration de 3 à 4 semaines, plafond de 2 alertes par jour, seuils réglables |
| Changement de format de l'export nutrition | Import cassé | Parseur isolé et message d'erreur clair |

**Points ouverts**

- [ ] Quels types de données arrivent réellement dans Health Connect depuis Suunto et Zepp ? (lot 0)
- [ ] Exemple de fichier JSON exporté par Suivi macro
- [ ] Cibles personnelles : poids visé, protéines en g/kg, nombre de séances par semaine
- [ ] Exercices de musculation clés à suivre

**Décisions prises**

- Le Helio Strap est porté en permanence : il devient la source de référence pour le sommeil, la HRV et la FC au repos.
- Nutrition : export JSON de l'app Suivi macro.
- Poids : saisie manuelle pour démarrer.

**Prochaines étapes**

1. Valider ou ajuster ce cahier des charges.
2. Passer au design : parcours, écrans du lot 1, identité visuelle.
3. Lancer le lot 0 avec Claude Code pour lever le risque HRV, puis réviser ce cahier des charges selon les données réellement disponibles.
