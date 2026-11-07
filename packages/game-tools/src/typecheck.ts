// Type-checks the project. Strict, but without the options that make an author (usually an AI)
// iterate over code that is already correct, such as checked index access.
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

import { configModule } from './config.ts';
import { assetsModule, projectModule, type Diagnostic, type Project } from './project.ts';

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

// Where the generated modules are type-checked from, by import; they exist only in memory.
const generatedModules = {
  '@playhoot/assets': '__playhoot_assets__.ts',
  '@playhoot/project': '__playhoot_project__.ts',
  '@playhoot/config': '__playhoot_config__.ts',
  '@playhoot/config/server': '__playhoot_config_server__.ts',
} as const;
type GeneratedModule = keyof typeof generatedModules;

export function typecheck(project: Project): Diagnostic[] {
  const host = ts.createCompilerHost(options);
  const contents: Record<GeneratedModule, string> = {
    '@playhoot/assets': assetsModule(project, true),
    '@playhoot/project': projectModule(project, true),
    '@playhoot/config': configModule(project.config, project.languages, false, true),
    '@playhoot/config/server': configModule(project.config, project.languages, true, true),
  };
  const files = new Map<string, string>();
  const generated = new Map<string, ts.SourceFile>();
  for (const name of Object.keys(generatedModules) as GeneratedModule[]) {
    const file = join(project.root, generatedModules[name]).split('\\').join('/');
    files.set(name, file);
    generated.set(file, ts.createSourceFile(file, contents[name], ts.ScriptTarget.ES2022));
  }
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, ...rest) =>
    generated.get(fileName) ?? getSourceFile(fileName, ...rest);
  host.resolveModuleNameLiterals = (literals, containingFile) =>
    literals.map((literal) => {
      const resolvedFileName = files.get(literal.text);
      if (resolvedFileName !== undefined) {
        return { resolvedModule: { resolvedFileName, extension: ts.Extension.Ts } };
      }
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
