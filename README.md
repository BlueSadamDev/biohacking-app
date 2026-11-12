# biohacking-app

Application Android personnelle de biohacking. Elle lit les données de la montre Suunto 9 Peak Pro et du bracelet Amazfit Helio Strap via Health Connect, puis produit un récap du matin, des alertes et des insights sport. Toutes les données restent sur le téléphone.

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

Par GitHub Actions (à venir dans le lot 0) :

- APK de développement : workflow `build-dev-apk.yml`, artifact `biohacking-dev-apk`.
- APK de production (sans permission Internet) : workflow `build-apk.yml`, artifact `biohacking-apk`.
