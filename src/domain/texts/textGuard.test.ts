// Garde-fou des textes affichés (lot 5a.1) : lit le code des fichiers qui affichent du texte et
// vérifie chaque texte (chaînes et texte des écrans) avec textProblems() : apostrophe droite,
// « (s) », « à définir », vocabulaire médical, mots abandonnés du glossaire. Vérifie aussi qu'aucune
// erreur technique (err.message, String(err)) n'est affichée ailleurs qu'à l'écran de diagnostic.
//
// Ne sont pas lus : l'écran de diagnostic, la base de données (requêtes SQL), les consignes et
// garde-fous du coach (destinés au modèle, pas à l'écran), les tests et les données fictives.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import ts from 'typescript';

import { textProblems } from './guard';

const SRC = join(__dirname, '..', '..');
const ROOTS = ['app', 'components', 'domain', 'sources', 'background', 'coach'];

/** Fichiers jamais lus (chemins depuis src/, séparateur /). */
const IGNORED = new Set([
  'app/diagnostic.tsx',
  'domain/diagnostic.ts',
  'domain/coachPrompt.ts',
  'domain/coachGuard.ts',
  'domain/texts/guard.ts',
  // Mise en forme du fichier CSV exporté (guillemets du format CSV), pas un texte affiché.
  'domain/csv.ts',
]);

/**
 * Fichiers pas encore réécrits (étape 3 du lot 5a.1) : sautés pour l'instant. Chaque groupe de
 * réécriture retire ses fichiers ; à la fin du lot, la liste doit être vide.
 */
const PENDING = new Set<string>([
  // Groupe C : sources, réglages, périodes.
  'app/(tabs)/reglages.tsx',
  'app/periodes.tsx',
  'app/sources.tsx',
  'sources/healthConnect.ts',
]);

/** Blocs de settings.ts qui sont des règles (expressions régulières du coach), pas des textes. */
const RULE_BLOCKS = new Set(['guard', 'focus']);

/** Fichiers dont les erreurs techniques ne vont qu'à l'écran de diagnostic (champ errorMessage). */
const TECHNICAL_OK = new Set([
  'sources/healthConnect.ts',
  // Erreur gardée dans l'état de l'app, jamais affichée : l'accueil montre un message simple.
  'components/useHealthData.ts',
]);

type Finding = { line: number; text: string; problem: string };

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name !== '__fixtures__') walk(full);
      } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
        const rel = relative(SRC, full).split(sep).join('/');
        if (!IGNORED.has(rel)) out.push(rel);
      }
    }
  };
  for (const root of ROOTS) walk(join(SRC, root));
  return out.sort();
}

function isSkipped(node: ts.Node): boolean {
  const parent = node.parent;
  if (!parent) return false;
  // Chemins d'import et clés d'objet.
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isLiteralTypeNode(parent)) return true;
  if ((ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent)) && parent.name === node) return true;
  if (ts.isCallExpression(parent) || ts.isNewExpression(parent)) {
    const callee = parent.expression.getText();
    // require(), messages d'erreur internes, journaux de développement, expressions régulières.
    if (/^(require|Error|TypeError|RangeError|RegExp)$/.test(callee) || /^console\./.test(callee)) return true;
  }
  return false;
}

function insideRuleBlock(node: ts.Node): boolean {
  for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
    if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name) && RULE_BLOCKS.has(n.name.text)) return true;
  }
  return false;
}

function findings(rel: string): Finding[] {
  const code = readFileSync(join(SRC, rel), 'utf8');
  const file = ts.createSourceFile(rel, code, ts.ScriptTarget.Latest, true, rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: Finding[] = [];
  const add = (node: ts.Node, text: string) => {
    const line = file.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    for (const problem of textProblems(text)) found.push({ line, text: text.trim(), problem });
  };
  const technical = (node: ts.Node, text: string) => {
    const line = file.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    if (!TECHNICAL_OK.has(rel)) found.push({ line, text, problem: 'erreur technique affichée (réservée à l’écran de diagnostic)' });
  };

  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!isSkipped(node) && !insideRuleBlock(node)) add(node, node.text);
    } else if (ts.isTemplateExpression(node)) {
      if (!isSkipped(node) && !insideRuleBlock(node)) {
        add(node, [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(' … '));
      }
    } else if (ts.isJsxText(node)) {
      if (node.text.trim()) add(node, node.text);
    } else if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === 'message' &&
      /^(e|err|error)$/.test(node.expression.getText())
    ) {
      technical(node, node.getText());
    } else if (
      ts.isCallExpression(node) &&
      node.expression.getText() === 'String' &&
      node.arguments.length === 1 &&
      /^(e|err|error)$/.test(node.arguments[0].getText())
    ) {
      technical(node, node.getText());
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

const FILES = sourceFiles();

describe('garde-fou des textes affichés', () => {
  it('lit bien les fichiers des écrans et des calculs', () => {
    expect(FILES).toContain('app/(tabs)/index.tsx');
    expect(FILES).toContain('domain/alerts.ts');
    expect(FILES).not.toContain('app/diagnostic.tsx');
  });

  it('chaque fichier de la liste « pas encore réécrit » existe', () => {
    for (const rel of PENDING) expect(FILES).toContain(rel);
  });

  it.each(FILES.filter((f) => !PENDING.has(f)))('%s respecte la charte des textes', (rel) => {
    const problems = findings(rel).map((f) => `ligne ${f.line} : ${f.problem} → « ${f.text} »`);
    expect(problems).toEqual([]);
  });

  it('chaque fichier « pas encore réécrit » a encore un texte à corriger (sinon le retirer de la liste)', () => {
    const clean = [...PENDING].filter((rel) => FILES.includes(rel) && findings(rel).length === 0);
    expect(clean).toEqual([]);
  });
});

describe('textProblems', () => {
  it('accepte une phrase conforme à la charte', () => {
    expect(textProblems('Tu t’entraînes *45 % de plus* que d’habitude cette semaine.')).toEqual([]);
    expect(textProblems('Ta variabilité cardiaque (HRV) est dans ta norme.')).toEqual([]);
  });

  it('repère chaque faute de la charte', () => {
    expect(textProblems("Aujourd'hui")).toEqual(['apostrophe droite (’ attendue)']);
    expect(textProblems('3 nuit(s)')).toEqual(['pluriel « (s) »']);
    expect(textProblems('Poids visé : à définir')).toEqual(['« à définir » (une invitation est attendue)']);
    expect(textProblems('Fatigue ou infection qui débute')).toEqual(['vocabulaire médical']);
    expect(textProblems('Possible début de maladie')).toEqual(['vocabulaire médical']);
    expect(textProblems('Sous ta plage habituelle')).toEqual(['mot du glossaire à abandonner : « plage » (« norme »)']);
    expect(textProblems('Charge 7 j / 28 j')).toHaveLength(1);
    expect(textProblems('Silence à partir de')).toHaveLength(1);
  });

  it('laisse passer les mots proches mais permis', () => {
    // « Malade » est un type de période choisi par l'utilisateur, pas un diagnostic.
    expect(textProblems('Période Malade')).toEqual([]);
    expect(textProblems('Plagiat')).toEqual([]);
  });
});
