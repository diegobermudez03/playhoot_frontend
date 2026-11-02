// Type-checks the project. Strict, but without the options that make an author (usually an AI)
// iterate over code that is already correct, such as checked index access.
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

import type { Diagnostic, Project } from './project.ts';

// Packages resolve from the toolchain, wherever the project lives.
const toolchainFile = fileURLToPath(import.meta.url);

const options: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX,
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  isolatedModules: true,
  allowImportingTsExtensions: true,
  types: [],
};

export function typecheck(project: Project): Diagnostic[] {
  const host = ts.createCompilerHost(options);
  host.resolveModuleNameLiterals = (literals, containingFile) =>
    literals.map((literal) => {
      const from = literal.text.startsWith('.') ? containingFile : toolchainFile;
      return ts.resolveModuleName(literal.text, from, options, host);
    });
  const program = ts.createProgram(
    project.files.map((file) => join(project.root, file)),
    options,
    host,
  );
  return ts.getPreEmitDiagnostics(program).map((diagnostic) => {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    if (diagnostic.file === undefined || diagnostic.start === undefined) {
      return { stage: 'types', message };
    }
    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    return {
      stage: 'types',
      message,
      file: diagnostic.file.fileName
        .slice(project.root.length + 1)
        .split('\\')
        .join('/'),
      line: line + 1,
      column: character + 1,
    };
  });
}
