// Checks each source file before bundling, so a mistake is reported on the author's own line with a
// fix. The backend's scriptcheck profile `sdk-v1` checks the bundled script again and decides; this
// only explains the same rules earlier.
import { dirname, posix } from 'node:path';

import ts from 'typescript';

import { areaOf, type Diagnostic, type SourceArea } from './project.ts';

// Packages each area may import. Anything else is not available to games.
const allowedPackages: Record<SourceArea, readonly string[]> = {
  shared: ['@playhoot/game-core', '@playhoot/config'],
  // Only server code reads the private configuration values.
  server: [
    '@playhoot/game-core',
    '@playhoot/game-server',
    '@playhoot/config',
    '@playhoot/config/server',
  ],
  client: [
    '@playhoot/game-core',
    '@playhoot/game-react',
    '@playhoot/assets',
    '@playhoot/project',
    '@playhoot/config',
    'react',
  ],
};

// Folders each area may import from.
const allowedAreas: Record<SourceArea, readonly SourceArea[]> = {
  shared: ['shared'],
  server: ['shared', 'server'],
  client: ['shared', 'client'],
};

// Calls allowed in top-level constants: the SDK's definition functions.
export const definitionFunctions = ['defineGame', 'defineCommands', 'defineInputs'];

// Global names the generated script declares.
export const reservedNames = [
  'start',
  'command',
  'samples',
  'update',
  'playerDisconnected',
  'playerRejoined',
  'project',
];

const forbiddenGlobals = ['eval', 'Function', 'globalThis', 'Reflect', 'WebAssembly'];
const forbiddenProperties = ['constructor', 'prototype', '__proto__'];

export function checkSource(file: string, text: string): Diagnostic[] {
  const area = areaOf(file);
  if (area === null) return [];
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const diagnostics: Diagnostic[] = [];
  const report = (node: ts.Node, message: string) => {
    const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
    diagnostics.push({ stage: 'source', file, line: line + 1, column: character + 1, message });
  };

  for (const statement of source.statements) checkImport(file, area, statement, report);
  // Client code runs in the browser frame; the rest runs in the backend sandbox.
  if (area !== 'client') {
    for (const statement of source.statements) checkTopLevel(statement, report);
    checkEverywhere(source, report);
  }
  return diagnostics;
}

type Report = (node: ts.Node, message: string) => void;

function checkImport(file: string, area: SourceArea, statement: ts.Statement, report: Report) {
  let specifier: ts.Expression | undefined;
  if (ts.isImportDeclaration(statement)) {
    if (statement.importClause === undefined) {
      report(statement, 'imports must name what they take; side-effect imports are not allowed');
    }
    specifier = statement.moduleSpecifier;
  } else if (ts.isExportDeclaration(statement)) {
    specifier = statement.moduleSpecifier;
  }
  if (specifier === undefined || !ts.isStringLiteral(specifier)) return;
  const path = specifier.text;
  if (path.startsWith('.')) {
    const target = posix.normalize(posix.join(dirname(file).split('\\').join('/'), path));
    const targetArea = areaOf(target);
    if (targetArea === null || target.startsWith('..')) {
      report(specifier, `"${path}" is outside the project's shared/, server/ and client/ folders`);
    } else if (!allowedAreas[area].includes(targetArea)) {
      report(
        specifier,
        area === 'client' && targetArea === 'server'
          ? 'client code cannot import server code: it would reach the players. Move what both need to shared/'
          : `${area}/ code cannot import from ${targetArea}/`,
      );
    }
    return;
  }
  if (!allowedPackages[area].includes(path)) {
    report(
      specifier,
      `"${path}" is not available in ${area}/ code; available: ${allowedPackages[area].join(', ')}`,
    );
  }
}

function checkTopLevel(statement: ts.Statement, report: Report) {
  if (
    ts.isImportDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isEmptyStatement(statement)
  ) {
    return;
  }
  if (ts.isExportDeclaration(statement)) return;
  if (ts.isFunctionDeclaration(statement)) {
    if (statement.name !== undefined) checkName(statement.name, report);
    return;
  }
  if (ts.isEnumDeclaration(statement)) {
    report(
      statement,
      "enums are not allowed; use a union of strings: type Phase = 'ask' | 'reveal'",
    );
    return;
  }
  if (ts.isClassDeclaration(statement)) {
    report(statement, 'top-level classes are not allowed; use functions and plain objects');
    return;
  }
  if (ts.isExportAssignment(statement)) {
    if (!isConstant(statement.expression)) {
      report(statement.expression, constantMessage);
    }
    return;
  }
  if (ts.isVariableStatement(statement)) {
    if ((statement.declarationList.flags & ts.NodeFlags.Const) === 0) {
      report(
        statement,
        'top-level let/var is state kept between calls, which games cannot have; keep it in the game state',
      );
      return;
    }
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) {
        report(declaration.name, 'top-level destructuring is not allowed');
        continue;
      }
      checkName(declaration.name, report);
      if (declaration.initializer === undefined || !isConstant(declaration.initializer)) {
        report(declaration.initializer ?? declaration, constantMessage);
      }
    }
    return;
  }
  report(
    statement,
    'top-level code may only declare functions, constants and types; put this inside a function',
  );
}

const constantMessage =
  'top-level constants may only hold literals, objects and arrays of them, property reads of other constants, functions, or ' +
  `${definitionFunctions.join('/')}(...); compute anything else inside a function`;

function checkName(name: ts.Identifier, report: Report) {
  if (reservedNames.includes(name.text) || name.text.startsWith('__playhoot')) {
    report(name, `"${name.text}" is reserved by the platform at the top level; rename it`);
  }
}

// Whether an expression evaluated once at load can hold no hidden state: no calls but the SDK's
// definition functions, whose arguments must be constant too.
function isConstant(node: ts.Expression): boolean {
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isTypeAssertionExpression(node)
  ) {
    return isConstant(node.expression);
  }
  if (
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isIdentifier(node) ||
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword
  ) {
    return true;
  }
  // Reading a property of another constant (config.rounds) runs no code; constructors stay out.
  if (ts.isPropertyAccessExpression(node)) {
    return (
      !forbiddenProperties.includes(node.name.text) &&
      (ts.isIdentifier(node.expression) || ts.isPropertyAccessExpression(node.expression)) &&
      isConstant(node.expression)
    );
  }
  if (ts.isPrefixUnaryExpression(node)) {
    return (
      (node.operator === ts.SyntaxKind.MinusToken || node.operator === ts.SyntaxKind.PlusToken) &&
      ts.isNumericLiteral(node.operand)
    );
  }
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.every((element) =>
      ts.isSpreadElement(element) ? isConstant(element.expression) : isConstant(element),
    );
  }
  if (ts.isObjectLiteralExpression(node)) {
    return node.properties.every((property) => {
      if (ts.isPropertyAssignment(property)) {
        return !ts.isComputedPropertyName(property.name) && isConstant(property.initializer);
      }
      if (ts.isSpreadAssignment(property)) return isConstant(property.expression);
      return ts.isShorthandPropertyAssignment(property) || ts.isMethodDeclaration(property);
    });
  }
  if (ts.isCallExpression(node)) {
    return (
      ts.isIdentifier(node.expression) &&
      definitionFunctions.includes(node.expression.text) &&
      node.arguments.every((argument) => isConstant(argument))
    );
  }
  return false;
}

function checkEverywhere(source: ts.SourceFile, report: Report) {
  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node) && forbiddenGlobals.includes(node.text) && isReference(node)) {
      report(node, `"${node.text}" is not available to games`);
    }
    if (ts.isPropertyAccessExpression(node) && forbiddenProperties.includes(node.name.text)) {
      report(node.name, `".${node.name.text}" is not available to games`);
    }
    if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteral(node.argumentExpression) &&
      forbiddenProperties.includes(node.argumentExpression.text)
    ) {
      report(
        node.argumentExpression,
        `"${node.argumentExpression.text}" is not available to games`,
      );
    }
    if (ts.isFunctionLike(node)) {
      const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
      if (modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)) {
        report(node, 'async code is not available: game logic runs synchronously');
      }
      if ('asteriskToken' in node && node.asteriskToken !== undefined) {
        report(node, 'generators are not available to games');
      }
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      report(node, 'dynamic import is not available to games');
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

// An identifier used as a value, not a property name or a declaration's own name.
function isReference(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return false;
  if (ts.isMethodDeclaration(parent) && parent.name === node) return false;
  if (ts.isPropertySignature(parent) || ts.isPropertyDeclaration(parent))
    return parent.name !== node;
  return true;
}
