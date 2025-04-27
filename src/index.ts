import { join, dirname, extname } from "node:path";
import { writeFile, readdir, unlink, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import ts from "typescript";
import { replaceFileExtensions } from "./replace-ext";
import type { MergeFilesOptions } from "./merge";
import { mergeFiles } from "./merge";

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
// --
function rep(str: string) {
  const rex = /\".*\"/g;
  let wm = str.match(rex) ? str.match(rex)?.[0] : "";
  wm = wm?.replace(/"/g, "");
  return str.replace(rex, `"${wm}.js"`);
}
function jsReplace(str: string) {
  const _aa: string[] = [];
  const lines = str.split("\n");
  lines.map((line) => {
    if (
      line.startsWith("import") &&
      line
        .split(" ")
        .slice(-1)
        .join("")
        .replace(/"/g, "")
        .replace(/;/, "")
        .startsWith("./")
    ) {
      line = rep(line);
    }
    _aa.push(line);
  });
  return _aa.join("\n");
}
// --
const isNotTs = (str: string) =>
  extname(str) !== ".ts" && extname(str) !== ".mts" && extname(str) !== ".cts";
// --
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
    if (isNotTs(fileName)) {
      contents = jsReplace(contents);
    }
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
