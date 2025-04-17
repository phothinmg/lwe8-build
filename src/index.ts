import { join, dirname } from "node:path";
import {
  mkdir,
  readFile,
  writeFile,
  readdir,
  unlink,
  mkdtemp,
} from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";
// ----------------------------------------- //
//##
/**
 * Remove all files in the given directory.
 * @param dir The directory to clean.
 */
export const cleanDir = async (dir: string) => {
  const files = await readdir(dir);
  await Promise.all(files.map((file) => unlink(join(dir, file))));
};
//## Replace File Extensions
/**
 * Read the type field from the package.json file in the current working directory.
 * @returns "commonjs" if the type field is not present or is "commonjs", otherwise "module".
 */
const getType = () => {
  const packageJsonFile = join(process.cwd(), "package.json");
  const packageData = readFileSync(packageJsonFile, "utf8");
  const data = JSON.parse(packageData);
  return !data.type || data.type === "commonjs" ? "commonjs" : "module";
};

const replaceFileExtensions = (
  fileName: string,
  format: "esm" | "cjs" | "browser"
) => {
  const type = getType();
  switch (format) {
    case "esm":
      fileName =
        type === "commonjs"
          ? fileName.replace(/.ts/, ".mts").replace(/.js/, ".mjs")
          : fileName;

      break;
    case "cjs":
      fileName =
        type === "module"
          ? fileName.replace(/.ts/, ".cts").replace(/.js/, ".cjs")
          : fileName;
      break;
    case "browser":
      fileName = `${fileName.slice(0, -3)}.global.js`;
      break;
  }
  return fileName;
};
// ------------------------------------------------------------------------------ //
//## Merge Files
type IndexFile = {
  /**
   * Entry file path content of this file will place at last position of mearged output file
   */
  path: string;
  /**
   * Number of lines at the tope of this file to remove.
   */
  lines?: number;
};

type OtherFile = {
  path: string;
  lines?: number;
  removeExport?: boolean;
};
export type MergeFilesOptions = {
  outFilePath: string;
  indexFile: IndexFile;
  otherFiles?: OtherFile[];
};

/**
 * Merge the given files into a single file.
 * @param outFilePath The path to the output file.
 * @param indexFile The main file to be merged.
 * @param otherFiles The other files to be merged.
 * @returns A promise that resolves when the merge is complete.
 */
export const mergeFiles = async ({
  outFilePath,
  indexFile,
  otherFiles,
}: MergeFilesOptions) => {
  const pn = dirname(outFilePath);
  if (!existsSync(pn)) await mkdir(pn);
  const index_code = await readFile(indexFile.path, "utf8");
  const _indexCode = indexFile.lines
    ? index_code.split("\n").slice(indexFile.lines).join("\n")
    : index_code;
  let _otherCode: string;
  if (otherFiles) {
    const other_codes: string[] = [];
    for (const file of otherFiles) {
      const re = file.removeExport ?? false;
      const file_code = await readFile(file.path, "utf8");
      const removedLines = file.lines
        ? file_code.split("\n").slice(file.lines).join("\n")
        : file_code;
      const _removedexport = removedLines.replace(/export\s+/g, "").split("\n");
      const removedExport = re ? _removedexport.join("\n") : removedLines;
      other_codes.push(removedExport);
    }
    _otherCode = other_codes.join("\n");
  } else {
    _otherCode = "";
  }
  return `
          ${_otherCode}
          ${_indexCode}
          `;

  //await writeFile(outFilePath, txt.trim());
};
// --------------------------------------------------------------------------------------- //
//##
export type Format = "esm" | "cjs" | "browser";
export type BuildOptions = {
  format: Format[];
  files: { fileNames: string[] } | MergeFilesOptions;
  outputDirs?: {
    esm?: string;
    cjs?: string;
    browser?: string;
  };
  fileName?: string;
  merge?: boolean;
};
export type CompileOptions = {
  fileNames: string[];
  format: Format;
  outDir: string;
  declaration?: boolean;
  declarationDir?: string;
  complierOptions?: Omit<
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
//
export async function compile({
  fileNames,
  format,
  outDir,
  declaration,
  complierOptions,
  declarationDir,
}: CompileOptions) {
  const debool = !declaration || format === "browser" ? false : declaration;
  const declare = declarationDir ? { declarationDir: declarationDir } : {};
  const options: ts.CompilerOptions = {
    allowJs: true,
    module: getModuleType(format),
    declaration: debool,
    outDir: outDir,
    jsx: ts.JsxEmit.React,
    ...complierOptions,
    ...declare,
  };

  const createdFiles: Record<string, string> = {};
  const host = ts.createCompilerHost(options);

  host.writeFile = (fileName: string, contents: string) => {
    fileName = replaceFileExtensions(fileName, format);
    createdFiles[fileName] = contents;
  };
  const program = ts.createProgram(fileNames, options, host);
  program.emit();
  await Promise.all(
    Object.entries(createdFiles).map(([outName, contents]) =>
      writeFile(outName, contents)
    )
  );
}

// ------------------------------------------------------------- //
