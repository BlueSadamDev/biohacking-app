# Règles du projet

## Contexte
- L'utilisateur ne sait pas développer. Tout expliquer en français simple, sans jargon (ou expliquer chaque terme technique).
- Projet : application Android personnelle de biohacking. Elle lit les données de la montre Suunto 9 Peak Pro et du bracelet Amazfit Helio Strap via Health Connect, puis produit un récap du matin, des alertes et des insights sport. Usage strictement personnel : pas de Play Store, pas de comptes utilisateurs.
- Référence fonctionnelle : [docs/CAHIER_DES_CHARGES.md](docs/CAHIER_DES_CHARGES.md). Le lire avant chaque nouveau lot ou fonctionnalité. Ne rien développer qui n'y figure pas sans demander.
- Livrable : un APK de test installable sur le téléphone (Android 14 ou plus récent).
- Technologie imposée : Expo (React Native, TypeScript) et GitHub Actions pour les APK. Ne proposer aucun autre framework sans demander.
- **Pas d'Expo Go** : la bibliothèque Health Connect contient du code natif, qu'Expo Go ne sait pas charger. Les tests se font avec un **build de développement** (une version de l'app qui contient `expo-dev-client` et se recharge depuis l'ordinateur pendant le développement), construit par GitHub Actions.
- L'application utilise Expo Router : les écrans sont dans `src/app/`, le reste dans `src/` hors de `src/app/` :
  - `src/sources/` : un connecteur par source de données (Health Connect, import Suivi macro, saisie manuelle) ;
  - `src/domain/` : fusion des capteurs, normes personnelles, scores, règles d'alerte (calculs purs, sans interface) ;
  - `src/db/` : base de données locale ;
  - `src/components/` : composants d'interface réutilisables.

## Données de santé et confidentialité
- Toutes les données restent sur le téléphone. Aucun appel réseau dans le code de l'application, aucun SDK d'analytics, de suivi des plantages ou de publicité.
- L'APK de production ne doit pas avoir la permission Internet : la retirer via `android.blockedPermissions` dans `app.json` (à vérifier à chaque build de production). Le build de développement, lui, en a besoin pour se recharger depuis l'ordinateur.
- Ne jamais mettre de vraies données de santé dans le dépôt (exports, captures, logs). Les tests utilisent uniquement des **données fictives** rangées dans `src/domain/__fixtures__/`.
- Ne pas afficher de valeurs de santé dans les logs (`console.log`) en dehors de l'écran de diagnostic prévu à cet effet.
- Sauvegarde uniquement par export manuel d'un fichier, déclenché par l'utilisateur.
- Les textes de l'app ne présentent jamais un résultat comme un diagnostic médical.

## Health Connect
- Bibliothèque : `react-native-health-connect`. Depuis la v4, son plugin Expo est intégré : ne **jamais** installer `expo-health-connect` (paquet obsolète, il casse le build Android).
- `minSdkVersion` d'au moins 26, réglé via `expo-build-properties`.
- Application en **lecture seule** : ne jamais écrire dans Health Connect.
- Ne demander que les permissions de lecture nécessaires au lot en cours, et les lister dans le plan avant de les ajouter.
- Toujours conserver l'**app d'origine** (`dataOrigin`) de chaque enregistrement : c'est elle qui distingue la Suunto du Helio Strap. Sans elle, la fusion est impossible.
- Gérer proprement les cas « Health Connect absent », « permission refusée » et « aucune donnée », avec un message clair à l'écran.

## Règles de calcul
- Ne jamais faire la moyenne de deux capteurs. Appliquer la table « source prioritaire / secours » du cahier des charges (section 3). Le Helio Strap, porté en permanence, est la référence pour le sommeil, la HRV et la FC au repos.
- Tous les seuils et pondérations sont dans un seul fichier de réglages (`src/domain/settings.ts`), jamais en dur dans le code.
- Chaque règle de `src/domain/` a des tests automatiques (Jest, via `jest-expo`) sur données fictives. Après chaque modification d'un calcul, lancer les tests et dire en une phrase ce qu'ils vérifient.
- Quand un calcul ne peut pas être fait (données manquantes, calibration en cours), l'app l'affiche au lieu d'inventer une valeur.

## Découpage en lots
- Le projet avance par lots (voir le cahier des charges, section 7) : un lot = une branche `lot-<n>-<nom>` et un APK testé.
- **Lot 0** (en cours) : seulement lire Health Connect et afficher, pour les 30 derniers jours, l'inventaire des données reçues (type, app d'origine, nombre d'enregistrements, première et dernière date). Pas de calcul, pas de design soigné.
- À la fin du lot 0, produire un court rapport des données réellement disponibles par capteur, pour mettre à jour le cahier des charges avant le lot 1.

## Design
Lire [DESIGN.md](DESIGN.md) avant toute modification d'interface et le respecter. Tant que DESIGN.md n'existe pas (lot 0), garder une interface minimale et lisible, sans travail graphique.
Quand une modification change ce que décrit DESIGN.md (couleur, bouton, écran), vérifier que le README ne contredit pas la nouvelle version.

## Façon de travailler
- Commencer toujours par un plan court et attendre la validation avant d'écrire du code.
- Demander une validation à chaque étape majeure : création du projet, nouvelle fonctionnalité, changement d'architecture, ajout d'une dépendance ou d'une permission Android. Pour une petite modification, avancer sans demander.
- Faire de petites modifications et vérifier que ça fonctionne après chacune.
- Après chaque étape, résumer en 3 à 5 lignes ce qui a changé et comment le vérifier.
- Ne jamais supprimer de fichiers ni installer d'outil global sans demander.
- N'ajouter aucune fonctionnalité non demandée et ne pas réécrire du code qui marche.
- En cas de blocage après 2 tentatives : s'arrêter, expliquer le problème et proposer des options. Ne pas tourner en boucle.

## Dépendances
- Pour ajouter un module Expo (SQLite, notifications, tâches de fond, etc.) : utiliser `npx expo install <nom>`, jamais `npm install`, afin de garantir la compatibilité avec le SDK.
- Modules prévus (à ajouter seulement quand le lot en a besoin, avec validation) : `react-native-health-connect`, `expo-build-properties`, `expo-dev-client`, `expo-sqlite`, `expo-notifications`, `expo-background-task` + `expo-task-manager`, `expo-document-picker` (import du JSON Suivi macro), `jest-expo`.
- Tâches de fond : `expo-background-task` (minimum 15 minutes entre deux exécutions sur Android). Synchro au plus une fois par heure.
- Ne jamais ajouter manuellement `expo-modules-core` ni `expo-modules-autolinking` dans `package.json` : ce sont des dépendances internes gérées par Expo. Lancer `npx expo install --fix` si nécessaire.
- **Dependabot** : ne jamais fusionner une PR Dependabot qui touche les dépendances npm (Dependabot ne connaît pas les versions attendues par le SDK Expo). À la place : `npx expo install --check`, puis `npx expo install --fix` sur une branche dédiée, et fermer la PR Dependabot avec une explication. Les PR Dependabot sur les actions GitHub (`.github/workflows`) peuvent être fusionnées après un build réussi.

## Qualité du code (avant chaque build ou grosse étape)
- Exécuter systématiquement :
  1. `npx expo-doctor` (objectif : aucune erreur)
  2. `npx expo lint`
  3. `npx tsc --noEmit`
  4. `npx jest` (dès que `src/domain/` contient des calculs)
- Si `expo-doctor` signale des versions incompatibles : `npx expo install --fix`, puis relancer les vérifications.

## Git et GitHub
- Le code est versionné avec Git et poussé sur GitHub (dépôt **privé**).
- Faire un commit de sécurité avant chaque grosse modification.
- Faire des commits fréquents avec des messages clairs en français.
- Ne jamais travailler directement sur la branche `main`.
- Créer une branche par lot ou fonctionnalité majeure (nom clair, par exemple `lot-0-inventaire-donnees`).
- Après chaque étape validée : commit, puis push de la branche sur GitHub.
- Fusionner dans `main` uniquement après validation de l'utilisateur, quand l'APK de la branche a été testé.
- Une fusion demande un accord explicite qui nomme la PR (par exemple « fusionne la #22 »). Un « ok » général ne suffit pas.
- Dans chaque résumé, distinguer clairement « APK construit » (le build GitHub a réussi) et « APK testé » (installé et vérifié sur le téléphone par l'utilisateur).
- Après une fusion qui a eu des conflits, relire le résultat sur `package.json` et `.github/workflows/` pour vérifier qu'aucune mise à jour n'a été annulée par erreur.
- Après la fusion, expliquer ce qui a été fait et proposer de supprimer la branche.
- Ne jamais mettre de secrets dans le dépôt (clés API, mots de passe, fichiers de signature) ni de données de santé. Utiliser le fichier `.gitignore`.
- Ne jamais faire de force push ni réécrire l'historique sans accord.

## Travail en parallèle (plusieurs sessions)
- Plusieurs sessions peuvent travailler en même temps sur le projet. Au début de chaque tâche, vérifier avec `git status` et `git worktree list` qu'aucune autre session n'utilise déjà le dossier courant.
- Si le dossier principal est occupé par une autre session : ne jamais y changer de branche, y faire de commit ni y modifier de fichier. Travailler dans un **worktree** (copie de travail séparée, reliée au même dépôt Git).
- Créer un worktree : `git worktree add .claude/worktrees/<nom> -b <branche> origin/main`, puis travailler uniquement dans ce dossier. Le lancement `claude --worktree <nom>` fait la même chose, mais peut échouer sous Windows (différence de majuscule `c:` / `C:` dans les chemins) : utiliser alors la commande Git.
- Une branche par session, jamais la même branche dans deux sessions.
- Une seule session à la fois modifie `package.json` et `package-lock.json` (ajout ou mise à jour de dépendances), car ce sont les fichiers qui créent le plus de conflits.
- Répartir les sujets pour que deux sessions ne modifient pas les mêmes fichiers en même temps (par exemple : une session sur `src/domain/`, une autre sur les écrans).
- Si deux sessions lancent `npx expo start` en même temps, utiliser un port différent pour la seconde : `npx expo start --port 8082`.
- `node_modules` d'un worktree : le dossier n'existe pas au départ. Ne lancer `npm ci` que si des vérifications ou un serveur Expo sont nécessaires, et le placer hors de OneDrive (jonction vers `C:\dev\biohacking-app\node_modules-<nom>`, comme expliqué dans le README).
- Avant de fusionner une branche, récupérer `main` (`git merge main`) pour intégrer le travail des autres sessions et relancer les vérifications.
- À la fin : fusion après validation de l'utilisateur, puis `git worktree remove .claude/worktrees/<nom>` et suppression de la branche.
- Ne jamais mettre dans un commit les fichiers temporaires d'une session (`run.log`, `node_modules_old/`, exports de données, etc.). Ajouter les fichiers un par un, jamais `git add .` ni `git add -A`.

## Build de l'APK
- Méthode unique : **GitHub Actions**, déclenchement manuel depuis l'onglet Actions. Deux workflows :
  - `.github/workflows/build-dev-apk.yml` : **APK de développement** (avec `expo-dev-client`), à réinstaller seulement quand une dépendance native ou une permission change. Entre deux, les modifications de code se voient en rechargeant l'app depuis `npx expo start`.
  - `.github/workflows/build-apk.yml` : **APK de production** (sans permission Internet), pour l'usage au quotidien.
- Les APK signés sont publiés comme artifacts téléchargeables (`biohacking-dev-apk` et `biohacking-apk`).
- Avant chaque build : exécuter les vérifications de la section « Qualité du code ».
- **Erreurs connues et correctifs :**
  - `generateInlineModules` (SyntaxError JSON) → ajouter `npm_config_warn: "false"` dans l'env du workflow.
  - `Could not get unknown property 'BIOHACK_...'` → passer les propriétés via `./gradlew -PKEY=VALUE` (pas via `gradle.properties`).
  - Dans les blocs `signingConfigs`, utiliser `project.getProperty('KEY')` plutôt que la variable nue `KEY`.
  - Classe en double `HealthConnectPackage` au build → le paquet obsolète `expo-health-connect` est présent : le retirer et relancer `npx expo prebuild --clean`.
- Donner les commandes exactes à copier-coller pour lancer le workflow.
- Expliquer comment télécharger et installer l'APK sur le téléphone (artifact → ZIP → `.apk`).
- Un build dure 20 à 30 minutes : donner le lien du build à l'utilisateur. Si la session a redémarré pendant un build, revérifier son état avec `gh run view <ID>` avant de conclure.

## Gestion des erreurs natives (Gradle / Android)
- Si une erreur Gradle survient en CI (GitHub Actions), diagnostiquer avec `gh run view <ID> --log`.
- Les erreurs connues ont des correctifs documentés dans la section « Build de l'APK » ci-dessus.
- Après 2 tentatives infructueuses sur une erreur technique : s'arrêter, expliquer clairement le problème et proposer des options.

## Maîtrise des coûts
- Lire uniquement les fichiers nécessaires, pas tout le projet à chaque fois.
- Ne pas parcourir `node_modules/`, `.expo/`, `android/`, `ios/`, `dist/`, `build/`, les fichiers `*.apk` / `*.aab` ni `package-lock.json`.
- Prévenir l'utilisateur quand la conversation devient longue et suggérer de démarrer une nouvelle tâche.

## Secrets
- Ne jamais créer ni modifier de secret GitHub, de keystore ou de mot de passe de signature.
- Ne jamais lire `credentials.json`, le dossier `credentials/`, les fichiers `*.jks`, `*.keystore` ni les fichiers `.env` (lecture bloquée dans `.claude/settings.json`).

## Documentation
- Tenir à jour le fichier `README.md` : objectif de l'app, comment la lancer, comment construire les deux APK.
- Mettre à jour le README après chaque fusion dans `main` si la structure du projet ou les commandes changent.
- Quand un lot change ce que prévoit le cahier des charges (données indisponibles, règle ajustée), le signaler et proposer la mise à jour de `docs/CAHIER_DES_CHARGES.md`.
