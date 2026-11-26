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

**Hors périmètre pour l'instant** : multi-utilisateurs, publication sur le Play Store, synchronisation cloud, tout traitement par une IA hors du téléphone (API en ligne, cloud), plan d'entraînement de la semaine généré par le coach (reporté).

## 2. Sources de données

Le Helio Strap, lu via Health Connect, est la source principale et automatique. L'app Zepp écrit dans Health Connect depuis 2024 ([Notebookcheck](https://www.notebookcheck.net/Amazfit-smartwatches-get-new-Health-Connect-data-sync-feature.951489.0.html)). L'app Suivi macro écrit elle aussi dans Health Connect les calories et les macros des repas (vérifié). La Suunto, elle, n'écrit rien dans Health Connect (confirmé au lot 0) : elle est **abandonnée pour l'instant, hors périmètre**. L'import de fichiers FIT est abandonné lui aussi. Si un jour une appli passerelle (Health Sync ou FitnessSyncer) écrit les séances Suunto dans Health Connect, elles seront lues comme une source de plus, sans autre changement que la table de fusion (section 3).

| Source | Données | Voie d'accès | Point de vigilance |
| --- | --- | --- | --- |
| Amazfit Helio Strap (app Zepp), porté en permanence | FC continue, FC au repos, HRV, sommeil, séances, pas, poids (confirmés au lot 0) ; pas de VO2max | Health Connect, automatique | HRV et FC au repos arrivent en nombreuses mesures par jour (voir section 3) ; latence de 15 à 30 min |
| Suunto 9 Peak Pro (app Suunto) | Séances détaillées : GPS, distance, dénivelé, allure, FC, cadence | Hors périmètre (abandonnée pour l'instant). Lisible plus tard si une appli passerelle (Health Sync ou FitnessSyncer) l'écrit dans Health Connect | Ni sommeil ni HRV. N'écrit pas dans Health Connect |
| Poids | Poids, éventuellement % de masse grasse | Saisie manuelle dans l'app (prioritaire) ; Zepp via Health Connect en secours | Valeur Zepp retenue seulement les jours sans saisie manuelle. Pesée dans les mêmes conditions (le matin à jeun) |
| Suivi macro (app développée par un ami) | Calories et macros des repas (protéines, glucides, lipides), totalisées par jour | Health Connect, automatique (app d'origine : Suivi macro) | Garder l'app d'origine de chaque repas pour ne compter que ceux de Suivi macro |
| Ressenti (optionnel) | Fatigue, courbatures, humeur, note de séance (1 à 5) | Saisie dans l'app, 10 secondes le matin | Facultatif, mais très utile pour les corrélations |

**Constat du lot 0** (voir [RAPPORT_LOT_0.md](RAPPORT_LOT_0.md)) : Zepp écrit dans Health Connect tous les types lus au lot 0 (dont la HRV et le poids), sauf la VO2max. La Suunto n'écrit rien : sa connexion à Health Connect échoue du côté de l'app Suunto. Le Helio Strap est donc la seule source automatique de données de santé et de sport. La course est suivie sans GPS, par sa FC (durée, zones cardiaques, temps en zone 2).

**Principe d'ouverture** : chaque source passe par un « connecteur » interchangeable. On peut ainsi ajouter plus tard la Suunto (via une appli passerelle vers Health Connect) ou une autre app sans toucher au reste.

**Prérequis technique** : lire l'historique et lire en arrière-plan demandent des permissions Health Connect spécifiques ([doc Android](https://developer.android.com/health-and-fitness/health-connect/data-types)). En usage personnel, sans publication sur le Play Store, aucune déclaration n'est à faire auprès de Google.

## 3. Fusion des sources

La règle : pas de moyenne, une source prioritaire par métrique et une source de secours. Moyenner deux capteurs qui mesurent différemment brouille les tendances. Pour les insights, la constance d'une même source compte plus que la précision absolue.

| Métrique | Source prioritaire | Secours | Règle |
| --- | --- | --- | --- |
| FC pendant les séances | Helio Strap | — | Le capteur optique au poignet décroche en musculation et en escalade (flexion du poignet, prise en main). Le strap est plus stable. Sert aussi aux zones cardiaques (section 5) |
| GPS, distance, dénivelé, allure | Aucune source (Suunto hors périmètre) | — | Non suivis. La course est suivie par la FC du Helio Strap |
| Séances | Helio Strap (immédiat) | — | Si une source passerelle s'ajoute un jour (séances Suunto), une séance qui chevauche une séance Helio à plus de 50 % la complète (type précis, GPS) au lieu de créer un doublon. Une séance ne compte dans les calculs que si elle dure au moins 20 minutes (musculation toujours comptée) : les courtes activités détectées automatiquement par le bracelet sont ignorées, mais restent enregistrées |
| Sommeil | Helio Strap (porté en permanence) | — | Une seule source à vie, pour garder des tendances comparables |
| HRV nocturne | Helio Strap (Zepp transmet la HRV : confirmé au lot 0) | — | Ne jamais mélanger : chaque constructeur calcule la HRV différemment. Une valeur par nuit : moyenne des mesures prises pendant le sommeil principal, calculée sur le logarithme de la rMSSD (atténue les pics isolés) |
| FC au repos | Helio Strap | — | Une valeur par nuit : moyenne des 5 valeurs les plus basses mesurées pendant le sommeil principal (moins sensible qu'un minimum unique à une mesure erronée) |
| Poids | Saisie manuelle dans l'app | Zepp (Health Connect) | Jamais de moyenne des deux : la saisie fait foi ; la valeur Zepp ne sert que les jours sans saisie |
| Pas, calories dépensées | Helio Strap | — | Une seule source, pas de cumul (double comptage) |

Pour la HRV et la FC au repos, sans sommeil principal enregistré la nuit concernée, la valeur est affichée « non calculable ». Les paramètres (dont le nombre de valeurs basses retenues) sont dans `src/domain/settings.ts`.

**Contrôle de cohérence** (seulement si une source passerelle s'ajoute un jour) : à l'arrivée d'une séance Suunto, si sa FC moyenne diffère de plus de 10 % de celle du Helio Strap, la séance est signalée « donnée douteuse » et exclue des calculs de tendance.

**Paramétrable** : le tableau ci-dessus est un réglage de l'application, pas du code figé. On pourra le modifier après quelques semaines de comparaison réelle des deux capteurs.

## 4. Fonctionnalités

Cinq onglets (Aujourd'hui, Tendances, Sport, Coach, Réglages), des écrans secondaires (détail d'un indicateur, journal du matin, saisie de séance, alertes, sources de données, diagnostic, modèle du coach, bilans de la semaine, périodes) et un moteur de règles couvrent le besoin : récap du matin, alertes, progression sportive, tendances, coach, collecte du contexte (périodes particulières, comportements de la veille).

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
- Musculation : le bracelet ne voit ni les charges ni les répétitions. Il faut donc une **saisie rapide de 3 exercices clés** : squat, développé couché, soulevé de terre. Après chaque séance de musculation, je saisis seulement la meilleure série de chaque exercice (charge × répétitions), ou « Pas fait ». La force se suit par le 1RM estimé (formule d'Epley).
- Course : suivie sans GPS, par la FC du Helio Strap : durée, temps passé dans chaque zone cardiaque, temps en zone 2. L'allure à FC donnée et la VO2max sont retirées (aucune source).
- Composition corporelle : courbe du poids lissée sur 7 jours, croisée avec les calories et les protéines. On verra ainsi si je prends du muscle ou du gras.
- **Suggestions d'autres sports** pour combler mes manques (par exemple peu d'endurance douce en zone 2, peu de mobilité ou trop de charge sur le haut du corps), choisies parmi des activités faciles à pratiquer à Paris.

### F4 – Tendances et corrélations

- Courbes sur 7, 30 et 90 jours pour chaque métrique.
- Corrélations personnelles calculées localement, affichées seulement quand elles sont assez solides, par exemple : « Les soirs de séance après 20 h, ta HRV de la nuit est inférieure de 12 % en moyenne ».

### F5 – Gestion des données

- Synchronisation Health Connect manuelle et automatique (toutes les heures), nutrition comprise (repas écrits par Suivi macro).
- Saisie du poids et du ressenti, dans le journal du matin (F8) depuis le lot 5a.
- Séances Suunto : hors périmètre (lisibles plus tard si une appli passerelle les écrit dans Health Connect).
- Export complet en CSV (sauvegarde) et effacement des données.
- Écran de diagnostic : dernière synchro par source, types de données reçus, trous dans les données. Depuis le lot 5b : durées et comptages des 10 dernières synchros, et rattrapage de l'historique (365 jours) à la demande.
- Synchro (lot 5b) : suivi des modifications de Health Connect (ajouts, modifications et suppressions) ; sans suivi possible, relecture par période où les enregistrements disparus de Health Connect sont supprimés (jamais les saisies manuelles) ; fréquence cardiaque lue seulement pendant le sommeil et les séances ; à l'ouverture, la dernière nuit d'abord.

### F6 – Coach

Un coach qui explique mes chiffres en langage naturel, en français, sans que rien ne quitte le téléphone.

- **100 % local** : aucune donnée ne quitte le téléphone et l'APK de production reste sans permission Internet. Le Samsung Galaxy S21 n'a pas Gemini Nano : le coach utilise un petit modèle ouvert (environ 1 à 1,5 milliard de paramètres, quantifié, fichier d'environ 1 Go).
- **Installation** : une seule fois, par import manuel du fichier du modèle (téléchargé depuis l'ordinateur, copié sur le téléphone, choisi dans l'app). L'app ne télécharge rien. Le modèle peut être supprimé depuis l'app.
- **Usages** :
  - **Bilan de la semaine** : synthèse, ce qui a marché, ce qui coince et 2 actions pour la semaine suivante, avec la liste des chiffres utilisés.
  - **Bouton « Pourquoi ? »** sur les alertes et les liens observés : explication du constat en quelques phrases.
  - **Questions libres encadrées**, avec des questions suggérées.
  - Le plan d'entraînement de la semaine est reporté à plus tard.
- **Règle de sécurité** : le coach ne calcule rien. Il reformule et explique uniquement les chiffres déjà calculés par l'app (sections 3 et 5), ne pose jamais de diagnostic médical, et dit « je ne sais pas » quand l'information manque. Partage des rôles : **l'app écrit le constat chiffré** (« Chiffres utilisés », repris du résumé calculé par l'app, donc toujours juste) et **le modèle n'écrit que l'explication et l'action, sans aucun chiffre**. Chaque conseil est contrôlé (chiffre, verdict contredit, vocabulaire médical, vouvoiement) : s'il est refusé, il est refait une fois, puis remplacé par un conseil de repli, le constat restant affiché.
- **Bilan de la semaine** : l'app décide elle-même ce qui a marché et ce qui coince, d'après ses verdicts ; le modèle écrit la phrase de synthèse et 2 actions ciblées sur ce qui coince. Généré à la première ouverture de l'onglet Coach à partir du dimanche (le modèle n'est jamais chargé ailleurs), enregistré, historique consultable.

### F7 – Étiquettes de période (lot 5a)

Signaler une période particulière pour qu'elle ne fausse pas mes normes et ne déclenche pas d'alertes inutiles.

- **Types** : Malade, Blessure, Voyage, Vacances, Autre.
- **Dates** : une date de début (aujourd'hui par défaut, jusqu'à 14 jours en arrière) et une date de fin, vide tant que la période est en cours. Deux périodes ne se chevauchent jamais. Le bouton « Terminer la période » fixe la fin à aujourd'hui ; les dates restent modifiables, et une période peut être supprimée (avec confirmation), depuis Réglages > Données > Mes périodes.
- **Pendant une période et sur ses jours** (règles détaillées en section 5) :
  - les jours sont exclus des normes (plages de HRV, FC au repos, sommeil), de la calibration, des liens observés et des suggestions de sports ;
  - les alertes sont en pause : rien n'est envoyé ni enregistré ; elles reprennent le lendemain de la fin ;
  - le score de récupération reste calculé et affiché, mais en gris, sans jugement de couleur ni recommandation chiffrée : la recommandation du jour est remplacée par une phrase propre au type (Malade : repos ; Blessure : pas de séance qui sollicite la zone blessée ; Voyage : régularité du sommeil ; Vacances : profite), jamais de vocabulaire médical ;
  - la charge d'entraînement continue d'être calculée (les séances réelles comptent), mais sans alerte.
- **Rappel** : si une période est ouverte depuis 14 jours, une notification (hors plage silencieuse) demande si elle est terminée.
- **Coach** : le résumé fourni au modèle signale la période en cours et le nombre de jours exclus de la semaine ; le bilan de la semaine la mentionne dans « ce qui coince » ou à part, sans la compter comme un échec.
- **Données** : les périodes sont incluses dans l'export CSV et dans l'effacement des données.

### F8 – Journal du matin (lot 5a)

Noter en 15 secondes ce que j'ai fait la veille, pour comprendre plus tard ce qui aide ou gêne ma nuit. Il remplace l'écran de saisie du matin.

- **Comportements de la veille** : liste par défaut : magnésium le soir, alcool, caféine après 14 h, écran au lit, repas tardif, sieste, sauna, méditation. Liste modifiable : ajouter (40 caractères au plus), renommer, masquer. Pas de suppression : un comportement masqué garde son historique.
- **Date** : un comportement coché le matin est enregistré pour la veille (le jour où il a eu lieu).
- **« Non » et « inconnu »** : un jour dont le journal est enregistré et où un comportement n'est pas coché compte comme « non » ; un jour sans journal enregistré compte comme « inconnu » et est exclu des analyses. Rien coché = rien de particulier.
- **Champs existants** : poids, ressenti (énergie, courbatures, humeur) et note libre rejoignent cet écran ; les saisies du matin déjà enregistrées sont conservées.
- **Corrections** : le journal des 7 derniers jours reste modifiable.
- **Rappel** : le récap du matin rappelle le journal s'il n'est pas rempli, dans la notification existante (pas de notification supplémentaire).
- **Liens observés** (F4) : chaque comportement affiché devient une paire testée (règles en section 5).
- **Coach** : le résumé fourni au modèle liste les comportements des 7 derniers jours sous forme de faits (« Alcool : 2 soirs sur 7 »).
- **Données** : la liste des comportements et le journal sont inclus dans l'export CSV et dans l'effacement des données.

## 5. Indicateurs et règles de calcul

Tous les indicateurs se comparent à ma propre norme : une valeur n'est « mauvaise » que si elle sort de ma plage habituelle. Il faut donc environ 3 à 4 semaines de données avant d'activer les alertes (phase de calibration). Les seuils ci-dessous sont des valeurs de départ, tous réglables.

| Indicateur | Calcul | Règle d'alerte (valeur de départ) |
| --- | --- | --- |
| HRV nocturne | Moyenne glissante 7 j de ln(rMSSD), comparée à la plage normale sur 60 j (moyenne ± 1 écart-type) | Moyenne 7 j sous la plage normale, ou 3 nuits d'affilée sous la plage |
| FC au repos | Valeur nocturne, comparée à la moyenne sur 30 j | Plus de 5 bpm au-dessus de la moyenne pendant 2 jours (fatigue ou maladie qui débute) |
| Sommeil | Durée, régularité de l'heure de coucher, efficacité | Moins de 6 h pendant 3 nuits sur 4, ou heure de coucher qui varie de plus d'1 h 30 sur la semaine |
| Charge d'entraînement | TRIMP par séance (durée × intensité cardiaque), charge aiguë (7 j) / chronique (28 j). Non fiable (ni valeur ni alerte) si plus d'une séance comptée sur 4 des 28 derniers jours manque de fréquence cardiaque | Ratio supérieur à 1,5 (pic de charge) ou inférieur à 0,8 pendant 2 semaines (désentraînement) |
| Score de récupération | Combinaison pondérée HRV, FC au repos, sommeil et charge de la veille, sur 0 à 100 | Moins de 40 : recommandation de séance légère |
| Poids | Moyenne glissante 7 j | Tendance hors de la fourchette cible fixée (prise ou perte trop rapide) sur 3 semaines |
| Protéines | g/kg/jour depuis les repas Suivi macro (Health Connect) | Sous la cible plus de 3 jours sur 7 |
| Calories | Total du jour depuis les repas Suivi macro, comparé à la cible des Réglages, qui est un **plafond** : respectée à la cible ou en dessous, dépassée même de peu (décision du 16 novembre 2026) | Pas d'alerte : la veille au-dessus du plafond est signalée dans le récap du matin |
| Zones cardiaques | Temps passé en zones 1 à 5 par séance et par semaine, à partir de la FC du Helio Strap et de la FC max des Réglages (Z2 = 60 à 70 % de la FC max ; tout ce qui est sous 60 %, échauffement et repos entre les séries compris, compte en zone 1) | Pas d'alerte : temps en zone 2 de la semaine comparé à une cible réglable (minutes par semaine), qui alimente les suggestions de sports |
| Force (musculation) | 1RM estimé par exercice clé (squat, développé couché, soulevé de terre) à partir de la meilleure série saisie : charge × (1 + répétitions / 30) (formule d'Epley) | Stagnation sur 6 semaines : suggestion de changer de programme |

**Combinaisons** : les alertes les plus utiles croisent plusieurs signaux. Exemple : HRV basse + FC au repos haute + charge élevée = alerte « surcharge ». HRV basse + FC au repos haute avec une charge normale = alerte « possible début de maladie ou stress ».

**Transparence** : chaque score affiche les éléments qui l'ont fait monter ou baisser. Aucune « boîte noire ».

Ces règles servent au suivi personnel et ne remplacent pas un avis médical. L'app le rappelle quand une alerte persiste.

### Jours étiquetés et comportements (lot 5a)

**Date d'une nuit** : une nuit porte la date du réveil (la nuit du 3 au 4 est la « nuit du 4 »). Un sommeil qui se termine avant 14 h compte pour ce jour-là, après 18 h pour le lendemain ; entre les deux, c'est une sieste, ignorée.

**Jour étiqueté** : un jour compris entre la date de début et la date de fin d'une période (aujourd'hui inclus si la période est en cours). Une seule fonction de calcul dit si un jour est étiqueté.

**Exclusion des jours étiquetés** : un filtre unique retire ces jours des données avant les calculs concernés.

- Une nuit est exclue si elle se termine un jour étiqueté. Exemple : période du 10 au 12 → les nuits du 10, du 11 et du 12 sont exclues (celle du 9 au 10 comprise) ; la nuit du 12 au 13 compte de nouveau.
- Exclus des normes (plages de HRV, FC au repos, sommeil) et de la calibration : les jours étiquetés ne comptent pas dans les 28 jours.
- Exclus des liens observés et des suggestions de sports.
- La charge d'entraînement n'est pas filtrée : les séances réelles comptent toujours.
- Alertes en pause : pendant une période, aucune alerte n'est envoyée ni enregistrée ; elles reprennent le lendemain de la date de fin.
- Le score de récupération reste calculé, sans couleur d'état ni recommandation chiffrée (phrase propre au type, voir F7).

**Comportements (F8) dans les liens observés** :

- Chaque comportement affiché devient trois paires : comportement du jour J → HRV de la nuit suivante (celle qui porte la date J+1), durée du sommeil de cette nuit, score de récupération de J+1.
- Jour « oui » : comportement coché ; jour « non » : journal enregistré, comportement non coché. Les jours « inconnus » (sans journal) et les jours étiquetés (J ou la nuit de J+1) sont exclus.
- Mêmes minimums qu'au lot 3 : au moins 20 jours comparables, dont au moins 5 « oui » et 5 « non » ; sinon « pas assez de jours ».
- **Limiter les faux liens** (on teste beaucoup plus de paires) : pour un comportement, le lien doit être au moins « modéré » (au lieu de « faible ») et tenir dans le même sens sur les deux moitiés de la période, avec au moins 3 jours « oui » et 3 « non » dans chaque moitié (au lieu de 2). Les comportements partagent le plafond de 3 liens affichés en tout. Seuils réglables dans `settings.ts`.

## 6. Exigences non fonctionnelles

Application Expo (React Native, TypeScript), 100 % locale, développée avec Claude Code selon les règles du CLAUDE.md du projet. Expo garde ma méthode habituelle (build de l'APK par GitHub Actions). Health Connect contenant du code natif, les tests passent par un build de développement et non par Expo Go.

**Confidentialité**

- Aucune donnée ne quitte le téléphone : l'APK de production n'a pas la permission Internet, ce qui le garantit techniquement (le build de développement en a besoin pour se recharger depuis l'ordinateur).
- Base de données locale chiffrée. Accès à l'app protégé par empreinte ou code (option).
- Sauvegarde uniquement par export manuel d'un fichier.
- Coach IA : le modèle tourne sur le téléphone, aucune donnée n'est envoyée à un service en ligne. Le fichier du modèle n'est jamais mis dans le dépôt.

**Stack technique proposée**

| Brique | Choix | Rôle |
| --- | --- | --- |
| Langage et interface | Expo (React Native, TypeScript), Expo Router | Écrans, thème sombre uniquement (voir DESIGN.md) |
| Données de santé | react-native-health-connect (plugin Expo intégré) | Lecture des capteurs, historique compris |
| Stockage | expo-sqlite | Données fusionnées, normes, alertes |
| Tâches de fond | expo-background-task (WorkManager, 15 min minimum) | Synchro horaire, calculs de nuit, récap du matin |
| Notifications | expo-notifications | Récap du matin, alertes |
| Coach IA | llama.rn (moteur local choisi au test de faisabilité du lot 4) | Faire tourner le petit modèle ouvert sur le téléphone |
| Import de fichier | expo-document-picker | Importer le fichier du modèle (une fois) |
| Tests des calculs | Jest (jest-expo) sur données fictives | Vérifier les règles sans lire le code |
| Architecture | Dossiers séparés : sources, domain (calculs), db, écrans | Ajouter une source sans casser le reste |

**Appareil cible** : Samsung Galaxy S21 5G (8 Go de RAM), Android 14 ou plus récent (Health Connect y est intégré au système).

**Méthode de développement**

- Un fichier CLAUDE.md à la racine du projet (mes règles habituelles, adaptées aux données de santé), et ce cahier des charges copié dans docs/CAHIER\_DES\_CHARGES.md.
- Un lot = une branche git, livré sous forme d'APK que j'installe et teste sur mon téléphone.
- Les règles de calcul (section 5) sont couvertes par des tests automatiques sur des données fictives, pour vérifier les calculs sans avoir à lire le code.

**Performance et batterie** : synchro au plus une fois par heure, calculs lourds la nuit pendant la recharge, ouverture de l'app en moins de 2 secondes. Le modèle du coach n'est chargé en mémoire que sur l'onglet Coach ou pour un « Pourquoi ? », puis libéré ; aucune génération en arrière-plan.

## 7. Découpage en lots

Le MVP correspond au lot 1 : un récap du matin fiable, basé sur des données fusionnées et ma norme personnelle. Les alertes viennent ensuite, parce qu'elles ont besoin de 3 à 4 semaines d'historique pour être justes.

1. **Lot 0 – Preuve de faisabilité des données** (terminé) : lecture Health Connect, inventaire des types reçus par source, écran de diagnostic. Résultat : [RAPPORT_LOT_0.md](RAPPORT_LOT_0.md).
2. **Lot 1 – MVP : récap du matin** : normes personnelles, score de récupération, notification du matin avec une recommandation, saisie du poids et du ressenti. *Condition de passage : 4 semaines d'usage quotidien, calibration des normes terminée.*
3. **Lot 2 – Alertes, charge et nutrition** : moteur de règles, alertes proactives, charge aiguë / chronique, nutrition lue via Health Connect (Suivi macro), suivi des protéines. *Condition de passage : alertes jugées pertinentes, moins de 2 fausses alertes par semaine.*
4. **Lot 3 – Progression et corrélations** : zones cardiaques (temps en zone 2), saisie de la meilleure série des 3 exercices clés, 1RM estimé, composition corporelle, corrélations, suggestions d'autres sports faciles à pratiquer à Paris. Sans la Suunto (hors périmètre). *Condition de passage : lots 1 à 3 stables et utilisés au quotidien.*
5. **Lot 4 – Coach IA local** (F6) : d'abord un test de faisabilité (comparaison de 2 moteurs et de 2 ou 3 petits modèles sur le S21 : mémoire, vitesse, qualité en français, licence), résultat dans `docs/RAPPORT_LOT_4_MODELE.md` et choix du modèle ; puis installation du modèle par import manuel, résumé chiffré des données (seule source de chiffres du coach), garde-fous, bilan de la semaine, « Pourquoi ? » sur les alertes et les liens observés, questions libres. *Condition de passage : réponses jugées justes et utiles, aucun chiffre inventé, aucune formulation de diagnostic.*
6. **Lot 4.1 – Fiabilité** : stabiliser l'app pendant la calibration des normes, sans nouvelle fonctionnalité de calcul. Base de données qui attend quelques secondes au lieu d'échouer (« database is locked » quand la synchro du lancement et la tâche de fond tournent en même temps) et écritures qui ne se chevauchent jamais ; bouton « Ouvrir Zepp » sur l'onglet Aujourd'hui quand la nuit n'est pas encore arrivée dans Health Connect (il ouvre seulement l'app Zepp, sans appel réseau ; Aube relance sa synchro au retour ; absent si Zepp n'est pas installée) ; chiffres utilisés repliables sur la carte « Bilan de la semaine », comme dans les réponses du coach.
7. **Lot 5a – Collecter** : étiquettes de période (F7 : malade, blessure, voyage, vacances, autre) : les jours étiquetés sont exclus des normes, de la calibration, des liens observés et des suggestions, les alertes sont en pause, rappel au bout de 14 jours ; journal du matin (F8 : comportements de la veille, qui remplace la saisie du matin et devient une source des liens observés). Aucun nouveau calcul de recommandation.
8. **Lot 5a.1 – Écriture et relief** : textes affichés et mise en forme seulement (charte, glossaire et relief décrits dans DESIGN.md, section « Textes ») ; aucun changement de calcul, de seuil ni de donnée enregistrée. Seule exception : un champ facultatif « en phrase » pour les comportements (migration additive), utilisé par les liens observés. *Condition de passage : relecture de l'app écran par écran sur le téléphone, avec captures avant / après de l'accueil, d'une alerte, du journal et d'un lien observé.*
9. **Pause d'usage de 3 à 4 semaines** (depuis le 16 novembre 2026) :
   seuls sont permis la collecte, la mise en forme et les corrections de
   qualité recalculées sur tout l'historique ; aucun nouveau seuil ni
   nouvel affichage de résultat. Objectifs : calibration des normes
   terminée, vérification des conditions de passage des lots 2 et 3,
   captures avant / après du lot 5a.1.
10. **Lot 5b – Moteur d'analyses** (pendant la pause, en 4 étapes) :
    mesure et accélération de la synchro ; qualité des données (règle
    séances / activités, séances qui se chevauchent, nuits coupées,
    mesures aberrantes, séances sans fréquence cardiaque, ratio de charge
    en moyennes exponentielles, comportements calculés, avis sur les
    alertes) ; historique des alertes et du coach, relance du bilan ;
    moteur statistique en mode silencieux (valeurs de départ de
    docs/PREUVES.md).
11. **Lot 5c – Insights** (fin de la pause) : affichage des analyses qui
    ont assez de données (charge et fatigue, calories de maintien,
    validation du score, alcool et caféine à conditions égales),
    historique des découvertes, certitude en mots, ajustement des seuils
    d'alerte d'après les avis.
12. **Lot 5d – Collecte complémentaire** : temps d'écran du soir, note
    d'effort de chaque séance (notification environ 30 minutes après la
    fin), annulation des notifications par identifiant, charge combinant
    fréquence cardiaque et note d'effort.
13. **Lot 5e – Expériences** : tests « avec / sans » tirés au sort (test
    de permutation), cible d'effort du jour.
14. **Lot 6 – Nutrition, nuit, corps et lumière** : répartition des
    protéines, préparation de la nuit (dette de sommeil, heure de coucher
    conseillée), temps d'écran du soir dans les liens, composition
    corporelle (poids et masse grasse en tendance, protocole de pesée,
    tour de taille mensuel), durée du jour et lever du soleil.
15. **Lot 7 – Cycles et bilans** : plan de semaine, semaine allégée,
    rapport mensuel en PDF, prévision de la VFC du lendemain.

**Plus tard** (non planifié, à cadrer avant tout développement) : score de récupération qui s'ajuste à mon ressenti, heure d'entraînement idéale.

**Écartés** : voir la liste « Points écartés » de la section 8.

Chaque lot est livré sous forme d'APK utilisable seul. On ne passe au suivant que si la condition de passage est remplie. Le lot 5a est détaillé (F7, F8, section 5 ; aucune nouvelle permission). Les lots 5b à 7 seront détaillés (fonctionnalités, règles de calcul, permissions) dans ce cahier avant leur développement.

**Révision après le lot 0** : faite. Ce cahier intègre les constats du lot 0 (sections 2, 3 et 8). Les deux points bloquants pour le lot 1 (valeur par nuit, source du poids) sont tranchés.

## 8. Risques, points ouverts et prochaines étapes

Le risque HRV est levé : Zepp transmet la HRV. La Suunto, absente de Health Connect, est abandonnée pour l'instant. Le point d'attention reste la façon de résumer les nombreuses mesures quotidiennes de HRV et de FC au repos.

| Risque | Impact | Parade |
| --- | --- | --- |
| HRV et FC au repos en nombreuses mesures par jour | Valeurs du matin instables, normes faussées | Une valeur par nuit (règle validée, section 3) |
| Suunto absente de Health Connect | Pas de GPS, de distance ni d'allure | Suunto hors périmètre ; course suivie par la FC du Helio Strap (zones cardiaques). Si une appli passerelle (Health Sync ou FitnessSyncer) écrit un jour les séances Suunto dans Health Connect, elles seront lues comme une source de plus |
| Doublons ou trous de synchro | Charge et sommeil faux | Règles de fusion (section 3) et écran de diagnostic |
| Pas de charges ni de répétitions dans les données de musculation | Progression en force invisible | Saisie rapide des exercices clés (F3) |
| Seuils mal calibrés | Trop d'alertes, que je finis par ignorer | Calibration de 3 à 4 semaines, plafond de 2 alertes par jour, seuils réglables |
| Repas absents de Health Connect (Suivi macro non synchronisé, permission retirée) | Protéines et calories sous-estimées, fausses alertes | Jour sans repas affiché « aucune donnée » au lieu de 0, pas d'alerte protéines ce jour-là |
| Modèle du coach trop lent ou trop gourmand en mémoire sur le S21 | Coach inutilisable, app qui ferme | Test de faisabilité avant tout développement (lot 4) ; modèle chargé seulement à l'usage puis libéré |
| Le coach invente un chiffre | Conseil faux, perte de confiance | Le coach ne calcule rien : chaque nombre de la réponse est vérifié dans les données fournies, sinon nouvelle génération puis message de repli |
| Une réponse ressemble à un avis médical | Fausse réassurance ou inquiétude | Consignes du coach (aucun diagnostic) et mention permanente « Ce n'est pas un avis médical » |
| Fichier du modèle corrompu ou erroné | Coach qui plante ou répond mal | Vérification de la taille et de l'empreinte SHA-256 à l'import |
| Oubli de fermer une période | Normes amputées de jours normaux, alertes muettes trop longtemps | Bandeau permanent sur l'accueil avec « Terminer la période » ; notification au bout de 14 jours ; dates modifiables après coup (Mes périodes) |
| Journal du matin non rempli | Trous dans les analyses de comportements | Un jour sans journal compte comme « inconnu », jamais comme « non » ; rappel dans le récap du matin ; corrections possibles sur les 7 derniers jours |
| Faux liens quand on teste beaucoup de comportements | Conseils fondés sur le hasard | Seuil plus strict pour les comportements (lien au moins modéré, même sens sur les deux moitiés avec au moins 3 jours « oui » et 3 « non » dans chaque moitié) ; 3 liens affichés au plus ; rappel « Un lien observé n'est pas une preuve de cause » |

**Points ouverts**

- [x] Quels types de données arrivent réellement dans Health Connect depuis Suunto et Zepp ? (lot 0 : tout depuis Zepp sauf VO2max, rien depuis la Suunto, voir [RAPPORT_LOT_0.md](RAPPORT_LOT_0.md))
- [x] Plan B pour la Suunto : abandonnée pour l'instant, hors périmètre (l'import des FIT est abandonné, voir décisions)
- [x] Voie d'accès aux séances Suunto : aucune pour l'instant, Suunto abandonnée (voir décisions)
- [x] HRV et FC au repos : règle « une valeur par nuit » validée (voir section 3 et décisions)
- [x] Poids : saisie manuelle prioritaire, Zepp en secours (voir section 3 et décisions)
- [x] VO2max (aucune source) : retirée du cahier des charges, comme l'allure à FC donnée (voir décisions)
- [x] Cibles personnelles : poids visé, protéines en g/kg, nombre de séances par semaine : saisies dans l'app (Réglages > Mes cibles), volontairement absentes du dépôt public
- [x] Exercices de musculation clés à suivre : squat, développé couché, soulevé de terre (voir décisions)
- [x] Nutrition : Suivi macro écrit les repas dans Health Connect (vérifié), plus besoin d'export JSON
- [ ] **Contrôle qualité des données Zepp** (à cadrer, noté le 16 novembre 2026) : vérifier ce que Zepp écrit réellement dans Health Connect, sur mes enregistrements (export CSV de l'app). Exemples à analyser : deux séances de même durée le même jour (vraies séances ou doublon / erreur de mesure de Zepp ?), nombreuses activités courtes détectées automatiquement (environ 100 en 28 jours), séances arrivées sans fréquence cardiaque. L'analyse se fait sur l'ordinateur, hors du dépôt ; le rapport ne garde que des comptages et des dates, jamais de valeurs. Selon le résultat : règles de nettoyage (section 3) et contrôles affichés dans « Contrôle des données ».

**Décisions prises**

- Le Helio Strap est porté en permanence : il devient la source de référence pour le sommeil, la HRV, la FC au repos, les pas et la FC des séances, lu via Health Connect.
- Suunto : pas de Health Connect, abandonnée pour l'instant, hors périmètre. L'import des fichiers FIT est abandonné. Si un jour une appli passerelle (Health Sync ou FitnessSyncer) écrit les séances Suunto dans Health Connect, elles seront lues comme une source de plus, sans autre changement que la table de fusion (section 3).
- Course : suivie sans GPS, par la FC du Helio Strap (durée, zones cardiaques, temps en zone 2). L'allure à FC donnée et la VO2max sont retirées (aucune source).
- Musculation : 3 exercices clés suivis (squat, développé couché, soulevé de terre). Après chaque séance de musculation, saisie de la meilleure série seulement (charge × répétitions). 1RM estimé par la formule d'Epley.
- Suggestions d'autres sports : elles comblent mes manques (endurance douce, mobilité…) et sont faciles à pratiquer à Paris. Le manque d'endurance douce se juge sur la zone 2 des 7 derniers jours glissants (et non depuis le lundi), pour éviter une suggestion systématique en début de semaine.
- Nutrition : lue dans Health Connect, app d'origine Suivi macro. L'import du fichier JSON est abandonné.
- Poids : la saisie manuelle dans l'app fait foi ; une valeur Zepp (Health Connect) n'est retenue que les jours sans saisie.
- HRV : une valeur par nuit, moyenne (sur le logarithme) des mesures du sommeil principal. FC au repos : moyenne des 5 valeurs les plus basses du sommeil principal. Sans sommeil enregistré : « non calculable ».
- Design : style sombre inspiré de Whoop, maquettes du lot 1 validées.
- Coach IA (lot 4) : 100 % local, sur le Galaxy S21 (pas de Gemini Nano) avec un petit modèle ouvert (environ 1 à 1,5 milliard de paramètres, quantifié), installé par import manuel du fichier. L'APK de production reste sans permission Internet. Le coach ne calcule rien, ne pose aucun diagnostic et dit quand il ne sait pas. Usages : bilan de la semaine, « Pourquoi ? », questions libres encadrées ; plan de semaine reporté.
- Coach IA, choix du modèle et partage des rôles (lot 4, 15 novembre 2026) : LFM2.5 1.2B avec llama.rn (voir [RAPPORT_LOT_4_MODELE.md](RAPPORT_LOT_4_MODELE.md)), et Luth-LFM2 1.2B (version française) accepté aussi ; un seul installé à la fois, interchangeables. Un modèle de cette taille déforme les verdicts même avec des consignes strictes : l'app écrit donc le constat chiffré et le modèle seulement l'explication et l'action, sans chiffre. Le bilan de la semaine est généré à l'ouverture de l'onglet Coach (et non de l'app), pour ne charger le modèle que là.
- Séances courtes (15 novembre 2026, remplacée le 18 novembre par la décision « Séances et activités », appliquée à l'étape 2 du lot 5b) : le Helio Strap enregistre toutes les activités détectées (marche rapide de quelques minutes…). Seules les séances d'au moins 20 minutes comptent dans les calculs (séances de la semaine, charge, zones, liens observés, suggestions) ; la musculation compte toujours. Seuil réglable dans `settings.ts`.
- Charge et fréquence cardiaque des séances (16 novembre 2026) : la charge affichait +300 % parce que la fréquence cardiaque de la plupart des séances n'avait pas été gardée à la synchro (séance arrivée après les mesures). Corrections : (1) rattrapage à chaque synchro : une séance comptée des 28 derniers jours sans aucune mesure est relue dans Health Connect sur sa durée ; (2) charge « non fiable » quand plus d'une séance comptée sur 4 (28 derniers jours) n'a pas assez de fréquence cardiaque : ni pourcentage, ni pastille, ni alerte de charge ; (3) carte « Charge : séances des 28 derniers jours » dans « Contrôle des données » (points ou raison du rejet de chaque séance). Seuil réglable dans `settings.ts`.
- Séances et activités (18 novembre 2026, remplace la règle des 20 minutes) : une activité = tout ce que le bracelet enregistre ; toutes les activités comptent dans les zones et la charge. Une séance = une activité d'au moins 45 minutes, ou une séance de musculation quelle que soit sa durée ; seules les séances comptent dans le nombre de séances de la semaine, les jours d'entraînement des liens observés et les suggestions. Charge non fiable quand plus d'un quart des minutes d'activité des 28 derniers jours manque de fréquence cardiaque.
- Référentiel des preuves (24 novembre 2026) : docs/PREUVES.md fixe la liste fermée des liens testés, leurs valeurs de départ et les garde-fous de plausibilité. Un lien absent du référentiel n'est jamais testé.

**Points écartés**

- Widget d'écran d'accueil, âge biologique, réveil intelligent.
- Météo et pollution (demandent Internet, or l'APK de production n'a pas cette permission).
- Effort et charge calculés par Zepp (absents de Health Connect).
- Indicateurs de la balance autres que poids et masse grasse.
- Agenda comme indicateur de stress.
- Évaluation du mouvement et des muscles par Zepp (à confirmer par l'inventaire).
- Réseau de neurones ou entraînement du coach (trop peu de données).

**Prochaines étapes**

1. ~~Rédiger DESIGN.md à partir des maquettes du lot 1.~~ Fait.
2. ~~Lot 1 : récap du matin.~~ Fait (PR #5).
3. ~~Lot 2 : alertes, charge et nutrition.~~ Fait (PR #8).
4. ~~Lot 3 : progression et corrélations.~~ Fait (PR #11).
5. ~~Lot 4 : coach IA local.~~ Fait (PR #14).
6. ~~Lot 4.1 : fiabilité.~~ Fait (PR #16). Les trois « idées pour plus tard » notées à la fin du lot 4 y sont intégrées (section 7).
7. ~~Lot 5a : collecter (F7, F8 ; règles en section 5).~~ Fait (PR #17).
8. ~~Lot 5a.1 : écriture et relief (textes et mise en forme, section 7).~~ Fait (PR #19). Pause d'usage en cours depuis le 16 novembre 2026 (section 7).
9. Lot 5b : moteur d'analyses, en 4 étapes (section 7), en cours.
