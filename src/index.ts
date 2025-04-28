import { existsSync } from "node:fs";
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import ts from "typescript";
import type { MergeFilesOptions } from "./merge";
import { mergeFiles } from "./merge.js";
import { replaceFileExtensions } from "./replace-ext.js";

/**
 * Remove all files in the given directory.
 * @param dir The directory to clean.
 */
export const cleanDir = async (dir: string) => {
  const files = await readdir(dir);
  await Promise.all(files.map((file) => unlink(join(dir, file))));
};
export type Format = "esm" | "cjs" | "browser";

export type CompileOptions = {
  entry: string;
  format: Format;
  outDir: string;
  declaration?: boolean;
  declarationDir?: string;
  sourceMap?: boolean;
  compilerOptions?: Omit<
    ts.CompilerOptions,
    "module" | "outDir" | "declaration" | "declarationDir" | "allowJs"
  >;
};
// ## getModuleType
const getModuleType = (format: Format) => {
  let moduleType: ts.ModuleKind = ts.ModuleKind.ES2015;
  if (format === "esm") {
    moduleType = ts.ModuleKind.ESNext;
  } else if (format === "cjs") {
    moduleType = ts.ModuleKind.CommonJS;
  } else if (format === "browser") {
    moduleType = ts.ModuleKind.ES2015;
  }
  return moduleType;
};


export async function compile({
  entry,
  format,
  outDir,
  declaration,
  compilerOptions,
  declarationDir,
  sourceMap,
}: CompileOptions) {
  const declareBool =
    !declaration || format === "browser" ? false : declaration;
  const declareDir = declarationDir ? { declarationDir: declarationDir } : {};
  const sm = sourceMap ? { sourceMap: sourceMap } : {};
  const options: ts.CompilerOptions = {
    allowJs: true,
    module: getModuleType(format),
    declaration: declareBool,
    outDir: outDir,
    jsx: ts.JsxEmit.React,
    ...compilerOptions,
    ...declareDir,
    ...sm,
  };
  const fileNames = [entry];
  const createdFiles: Record<string, string> = {};
  const host = ts.createCompilerHost(options);

  host.writeFile = (fileName: string, contents: string) => {
    fileName = replaceFileExtensions(fileName, format);
    createdFiles[fileName] = contents;
  };
  const program = ts.createProgram(fileNames, options, host);
  program.emit();
  await Promise.all(
    Object.entries(createdFiles).map(([outName, contents]) => {
      const dir = dirname(outName);
      if (!existsSync(dir)) {
        mkdir(dir, { recursive: true });
      }
      writeFile(outName, contents);
    })
  );
}
export { type MergeFilesOptions, mergeFiles };
// ------------------------------------------------------------- //
