# Aube (biohacking-app)

**Aube** est une application Android personnelle de biohacking. Elle lit les données du bracelet Amazfit Helio Strap via Health Connect, importe une fois par mois les séances de la montre Suunto 9 Peak Pro (fichiers FIT), puis produit un récap du matin, des alertes et des insights sport. Toutes les données restent sur le téléphone.

- Cahier des charges : [docs/CAHIER_DES_CHARGES.md](docs/CAHIER_DES_CHARGES.md)
- Règles de travail : [CLAUDE.md](CLAUDE.md)
- Technologie : Expo (React Native, TypeScript), Expo Router. Les écrans sont dans `src/app/`.

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
```

## Lancer l'app

L'app n'utilise pas Expo Go (Health Connect contient du code natif). Il faut installer sur le téléphone l'**APK de développement**, puis lancer sur l'ordinateur :

```powershell
npx expo start
```

et ouvrir le projet depuis l'app installée sur le téléphone (même réseau Wi-Fi).

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
