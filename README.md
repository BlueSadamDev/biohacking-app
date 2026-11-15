# Aube (biohacking-app)

**Aube** est une application Android personnelle de biohacking. Elle lit via Health Connect les données du bracelet Amazfit Helio Strap et les repas de l'app Suivi macro, puis produit un récap du matin, des alertes et des insights sport. Toutes les données restent sur le téléphone.

- Cahier des charges : [docs/CAHIER_DES_CHARGES.md](docs/CAHIER_DES_CHARGES.md)
- Règles de travail : [CLAUDE.md](CLAUDE.md)
- Charte graphique et identité : [DESIGN.md](DESIGN.md)
- Technologie : Expo (React Native, TypeScript), Expo Router.
- État : lots 1 (récap du matin), 2 (alertes, charge, nutrition) et 3 (progression et corrélations) terminés ; lot 4 (coach IA local) en cours.

## Organisation du code

- `src/app/` : les écrans. Onglets : Aujourd'hui, Tendances, Sport, Coach (lot 4), Réglages. Autres écrans : Détail (HRV, FC au repos, Sommeil, Poids), Saisie du matin, Saisie de séance de musculation, Sources de données, Alertes, Diagnostic, Modèle du coach, Bilans de la semaine, Banc d'essai du coach (temporaire, lot 4).
- `src/coach/` : coach IA local (lot 4) : installation et vérification du fichier du modèle, banc d'essai.
- `src/sources/` : lecture de Health Connect (dont les repas de Suivi macro et les séances) et saisie manuelle.
- `src/domain/` : calculs purs (valeurs par nuit, normes, calibration, score de récupération, recommandation, charge d'entraînement, nutrition, alertes, zones cardiaques, musculation et 1RM, composition corporelle, liens observés, suggestions de sports et leur catalogue, export CSV). Réglages dans `src/domain/settings.ts`, tests à côté de chaque fichier, données fictives dans `src/domain/__fixtures__/`.
- `src/db/` : base de données locale (SQLite), réglages de l'utilisateur, historique des alertes, saisies de musculation, export CSV et effacement.
- `src/components/` : composants d'interface réutilisables.
- `src/background/` : synchro en arrière-plan, moteur d'alertes, rappel de saisie de musculation et notification du récap du matin.
- `assets/brand/` : logos SVG d'Aube, source de l'icône et de l'écran de démarrage.

## Installer le projet sur l'ordinateur

Prérequis : Node.js (version 20 ou plus récente) et Git.

Le dossier du projet est dans OneDrive. Pour éviter que OneDrive synchronise les dizaines de milliers de fichiers de `node_modules` (les bibliothèques installées), ce dossier est rangé hors de OneDrive, dans `C:\dev\biohacking-app\node_modules`, et relié au projet par une **jonction** (un raccourci de dossier que les outils voient comme un vrai dossier).

À faire une seule fois, dans PowerShell, depuis le dossier du projet :

```powershell
New-Item -ItemType Directory -Force "C:\dev\biohacking-app\node_modules"
cmd /c mklink /J "$PWD\node_modules" "C:\dev\biohacking-app\node_modules"
npm ci
```

Pour un worktree (copie de travail séparée), même principe avec un dossier dédié : `C:\dev\biohacking-app\node_modules-<nom>`.

## Vérifications avant un build

```powershell
npx expo-doctor
npx expo lint
npx tsc --noEmit
npx jest
```

## Lancer l'app

L'app n'utilise pas Expo Go (Health Connect contient du code natif). Il faut installer sur le téléphone l'**APK de développement**, puis lancer sur l'ordinateur :

```powershell
npx expo start
```

et ouvrir le projet depuis l'app installée sur le téléphone (même réseau Wi-Fi).

**Si le téléphone ne trouve pas l'ordinateur** (écran noir ; Windows bloque souvent les connexions quand le Wi-Fi est classé « Public »), passer par le câble USB avec l'outil Android `adb` (dossier « platform-tools » de Google, rangé ici dans `C:\dev\android-platform-tools`). Activer une fois le débogage USB sur le téléphone (Paramètres > Options de développement), brancher le câble, accepter « Autoriser le débogage USB », puis :

```powershell
C:\dev\android-platform-tools\platform-tools\adb.exe reverse tcp:8081 tcp:8081
```

et choisir `http://localhost:8081` dans l'app de développement. À refaire à chaque branchement du câble.

## Installer le modèle du coach (lot 4)

Le coach utilise un petit modèle d'IA ouvert qui tourne **sur le téléphone**, sans Internet. L'app ne télécharge rien : le fichier s'installe une fois, à la main. Il ne doit **jamais** être mis dans le dépôt (le `.gitignore` bloque les `*.gguf`).

| | |
|---|---|
| Modèle | LFM2.5 1.2B Instruct, quantification Q4_K_M (licence LFM Open License v1.0, usage personnel autorisé) |
| Fichier | `LFM2.5-1.2B-Instruct-Q4_K_M.gguf` (731 Mo) |
| Téléchargement | [lien figé sur Hugging Face](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF/resolve/8ed288026e23958ad9dfa92d53ed773a8eee7125/LFM2.5-1.2B-Instruct-Q4_K_M.gguf) |
| Empreinte SHA-256 | `b1b3de114215d9507409a662a501a631095a479a419584e8a2ded6304b19b4f5` |

1. Sur l'ordinateur, télécharger le fichier avec le lien ci-dessus (le ranger hors du dossier du projet, par exemple dans `C:\dev\modeles-coach`).
2. Le copier dans le dossier **Téléchargements** du téléphone : câble USB, mode « Transfert de fichiers », puis glisser le fichier dans `Download` ; ou en ligne de commande : `adb push <fichier> /sdcard/Download/`.
3. Dans Aube : **Réglages > Coach > Modèle du coach > Choisir le fichier du modèle**. L'app vérifie la taille et l'empreinte (environ une minute), puis le range dans son espace privé. Le fichier de Téléchargements peut ensuite être supprimé.

Le choix de ce modèle est expliqué dans [docs/RAPPORT_LOT_4_MODELE.md](docs/RAPPORT_LOT_4_MODELE.md).

**Modèle en comparaison (lot 4)** : l'app accepte aussi Luth-LFM2 1.2B, une version de LFM2 entraînée en français. Un seul modèle est installé à la fois : dans **Modèle du coach > Changer de modèle (comparaison)**, le fichier choisi remplace l'autre.

| | |
|---|---|
| Modèle | Luth-LFM2 1.2B, quantification Q4_K_M de mradermacher (licence LFM 1.0, usage personnel autorisé) |
| Fichier | `Luth-LFM2-1.2B.Q4_K_M.gguf` (731 Mo) |
| Téléchargement | [lien figé sur Hugging Face](https://huggingface.co/mradermacher/Luth-LFM2-1.2B-GGUF/resolve/5f91c560983cf8874def628fd4a3fb5ef7333a16/Luth-LFM2-1.2B.Q4_K_M.gguf) |
| Empreinte SHA-256 | `9ca9c9a4f53ec05855434061a65f541e1336a47fa7fdc38a2215b6a6e4e7d18d` |

## Construire les APK

Par GitHub Actions, déclenchement manuel (onglet Actions > choisir le workflow > « Run workflow », ou en ligne de commande ci-dessous). Un build dure 20 à 30 minutes.

| APK | Workflow | Artifact | Particularités |
|---|---|---|---|
| Développement | `build-dev-apk.yml` | `biohacking-dev-apk` | Nom « Aube (dev) », s'installe à côté de l'app de production. Signé avec la clé de développement d'Expo : aucun secret nécessaire. À reconstruire seulement quand une dépendance native ou une permission change. |
| Production | `build-apk.yml` | `biohacking-apk` | Sans permission Internet (le build échoue si elle est présente), sans accès au stockage ni affichage par-dessus les autres apps. Signé avec les 4 secrets ci-dessous. |

```powershell
gh workflow run build-dev-apk.yml --ref <branche>
gh workflow run build-apk.yml --ref <branche>
```

Secrets GitHub nécessaires pour la production (Settings > Secrets and variables > Actions) : `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`, `ANDROID_KEY_ALIAS`.

**Installer l'APK** : ouvrir la page du build terminé, télécharger l'artifact (un fichier ZIP) en bas de page, extraire le `.apk`, le copier sur le téléphone et l'ouvrir (autoriser l'installation depuis cette source si Android le demande).
