/// <reference types="node" />
// Test exécuté par Jest sur l'ordinateur (Node) : lecture des fichiers du projet. Jamais inclus dans l'app.
// Confidentialité (CLAUDE.md, « Données de santé et confidentialité » ; lot 4, étape C9).
// Garde-fou automatique : aucun appel réseau dans le code de l'app, aucune bibliothèque d'analytics,
// de suivi des plantages ou de publicité. Un ajout futur ferait échouer ce test.

import * as fs from 'fs';
import * as path from 'path';

const SRC = __dirname;
const ROOT = path.join(SRC, '..');

/** Fichiers de code de l'app (hors tests et données fictives). */
function appFiles(dir: string = SRC): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__fixtures__' ? [] : appFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/** Appels qui ouvriraient une connexion réseau ou téléchargeraient un fichier. */
const NETWORK_CALLS = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /\bsendBeacon\b/,
  /\bdownloadAsync\b/,
  /\bcreateDownloadResumable\b/,
  /\bdownloadFileAsync\b/,
  /\buploadAsync\b/,
  /\bopenBrowserAsync\b/,
  /\bopenURL\s*\(/,
  /from ['"]axios['"]/,
];

/** Bibliothèques interdites (réseau, analytics, plantages, publicité). */
const FORBIDDEN_PACKAGES = /^(axios|@sentry\/|sentry-|@react-native-firebase\/|firebase|@amplitude\/|amplitude|@segment\/|mixpanel|@bugsnag\/|bugsnag|@datadog\/|posthog|expo-insights|expo-updates|react-native-blob-util|google-mobile-ads|react-native-google-mobile-ads)/;

/** Seule exception : les liens figés des modèles du coach, gardés pour la documentation (jamais téléchargés par l'app). */
function isAllowedUrl(line: string): boolean {
  return /^\s*'https:\/\/huggingface\.co\/[^']+\.gguf',?$/.test(line);
}

describe('aucun appel réseau dans l’app', () => {
  const files = appFiles();

  it('parcourt bien le code de l’app', () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files.some((f) => f.endsWith(path.join('coach', 'llamaModel.ts')))).toBe(true);
  });

  it('n’utilise aucune fonction réseau', () => {
    const found: string[] = [];
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      for (const re of NETWORK_CALLS) if (re.test(text)) found.push(`${path.relative(ROOT, file)} : ${re}`);
    }
    expect(found).toEqual([]);
  });

  it('ne contient aucune adresse Internet, hormis les liens de documentation des modèles', () => {
    const found: string[] = [];
    for (const file of files) {
      fs.readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .forEach((line, i) => {
          if (/(https?|wss?|ftp):\/\//i.test(line) && !isAllowedUrl(line)) found.push(`${path.relative(ROOT, file)}:${i + 1}`);
        });
    }
    expect(found).toEqual([]);
  });

  it('les liens des modèles ne servent qu’aux réglages (aucun code ne lit downloadUrl)', () => {
    const users = files.filter((f) => !f.endsWith(path.join('domain', 'settings.ts')) && /\bdownloadUrl\b/.test(fs.readFileSync(f, 'utf8')));
    expect(users.map((f) => path.relative(ROOT, f))).toEqual([]);
  });

  it('n’installe aucune bibliothèque réseau, d’analytics, de suivi des plantages ou de publicité', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const names = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
    expect(names.filter((n) => FORBIDDEN_PACKAGES.test(n))).toEqual([]);
  });
});
