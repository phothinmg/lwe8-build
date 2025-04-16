import { existsSync, readFileSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import $ from "dax-sh";
import ts from "typescript";
import { minify } from "uglify-js";
// -----------------------------------------------------
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
export type Format = "esm" | "cjs" | "browser";
export type BuildOptions = {
  format: Format[];
  outputDirs?: {
    esm?: string;
    cjs?: string;
    browser?: string;
  };
  indexFile: IndexFile;
  otherFiles?: OtherFile[];
  fileName?: string;
};
export type CompileOptions = {
  fileNames: string[];
  format: Format;
  outDir: string;
  declaration?: boolean;
  declareDir?: string;
  replaceFunction?: (fileName: string) => string;
  complierOptions?: Omit<
    ts.CompilerOptions,
    "module" | "outDir" | "declaration" | "declarationDir" | "allowJs"
  >;
};

/**
 * Remove all files in the given directory.
 * @param dir The directory to clean.
 */
export const cleanDir = async (dir: string) => {
  const files = await readdir(dir);
  await Promise.all(files.map((file) => unlink(join(dir, file))));
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
  const txt = `
        ${_otherCode}
        ${_indexCode}
        `;

  await writeFile(outFilePath, txt.trim());
};

/**
 * Read the type field from the package.json file in the current working directory.
 * @returns "commonjs" if the type field is not present or is "commonjs", otherwise "module".
 */
export const getType = () => {
  const packageJsonFile = join(process.cwd(), "package.json");
  const packageData = readFileSync(packageJsonFile, "utf8");
  const data = JSON.parse(packageData);
  return !data.type || data.type === "commonjs" ? "commonjs" : "module";
};

/**
 * Replace the extension of a file name with .mts or .mjs if it is a typescript or
 * javascript file and the type field in the package.json file is "commonjs".
 * @param {string} fileName The file name to replace.
 * @returns {string} The replaced file name.
 */
function extensionReplaceEsm(fileName: string): string {
  const type = getType();
  if (type === "commonjs") {
    const ext = extname(fileName);
    if (ext === ".ts") return `${fileName.slice(0, -3)}.mts`;
    if (ext === ".js") return `${fileName.slice(0, -3)}.mjs`;
  }
  return fileName;
}

/**
 * Replace the extension of a file name with .cts or .cjs if it is a typescript or
 * javascript file and the type field in the package.json file is "module".
 * @param {string} fileName The file name to replace.
 * @returns {string} The replaced file name.
 */
function extensionReplaceCjs(fileName: string): string {
  const type = getType();
  if (type === "module") {
    const ext = extname(fileName);
    if (ext === ".ts") return `${fileName.slice(0, -3)}.cts`;
    if (ext === ".js") return `${fileName.slice(0, -3)}.cjs`;
  }
  return fileName;
}

/**
 * Compile the given files into a single directory.
 * @param {object} options The options to pass to the compiler.
 * @param {string[]} options.fileNames The files to compile.
 * @param {string} options.outDir The directory to output the compiled files to.
 * @param {string} options.declareDir The directory to output the declaration files to.
 * @param {"esm"|"cjs"|"browser"} options.format The format of the output.
 * @param {(fileName: string) => string} [options.replaceFunction] A function to replace the file name with.
 * @param {ts.CompilerOptions} [options.complierOptions] The options to pass directly to the compiler.
 * @returns {Promise<void>} A promise that resolves when the compilation is complete.
 */
export const compile = async ({
  fileNames,
  outDir,
  declaration,
  declareDir,
  format,
  replaceFunction,
  complierOptions,
}: CompileOptions): Promise<void> => {
  let moduleType: ts.ModuleKind = ts.ModuleKind.ES2015;
  if (format === "esm") {
    moduleType = ts.ModuleKind.ESNext;
  } else if (format === "cjs") {
    moduleType = ts.ModuleKind.CommonJS;
  } else if (format === "browser") {
    moduleType = ts.ModuleKind.ES2015;
  }
  const options: ts.CompilerOptions = {
    allowJs: true,
    module: moduleType,
    declaration: declaration ?? true,
    outDir: outDir,
    declarationDir: declareDir,
    jsx: ts.JsxEmit.React,
    ...complierOptions,
  };

  const createdFiles: Record<string, string> = {};
  const host = ts.createCompilerHost(options);

  host.writeFile = (fileName: string, contents: string) => {
    const outName = replaceFunction ? replaceFunction(fileName) : fileName;
    createdFiles[outName] = contents;
  };
  const program = ts.createProgram(fileNames, options, host);
  program.emit();
  await Promise.all(
    Object.entries(createdFiles).map(([outName, contents]) =>
      writeFile(outName, contents)
    )
  );
};

/**
 * Builds the given files into a single directory.
 * @param {object} options The options to pass to the compiler.
 * @param {string[]} options.format The format of the output. Can be "esm", "cjs", or "browser".
 * @param {string} options.outputDirs The directory to output the compiled files to.
 * @param {IndexFile} options.indexFile The file to use as the entry point for the build.
 * @param {OtherFile[]} [options.otherFiles] The other files to include in the build.
 * @param {string} [options.fileName="index.ts"] The file name to use for the output file.
 * @returns {Promise<void>} A promise that resolves when the build is complete.
 */
export const build = async ({
  format,
  outputDirs,
  indexFile,
  otherFiles,
  fileName = "index.ts",
}: BuildOptions): Promise<void> => {
  const tempdir = await mkdtemp("_bc");
  const esmtempDir = `${tempdir}/esm`;
  const cjstempDir = `${tempdir}/cjs`;
  const bwtempDir = `${tempdir}/bw`;
  const createTemps = async () => {
    if (format.includes("esm")) {
      await mkdir(esmtempDir, { recursive: true });
    }
    if (format.includes("cjs")) {
      await mkdir(cjstempDir, { recursive: true });
    }

    if (format.includes("browser")) {
      await mkdir(bwtempDir, { recursive: true });
    }
  };
  // ------------------------------------------
  const start = performance.now();
  // --------------------------------------------
  $.logStep("Start:  .... ");
  try {
    const tempOutFilePath = `${tempdir}/${fileName}`;
    await mergeFiles({
      outFilePath: tempOutFilePath,
      indexFile,
      otherFiles,
    });
    await $.sleep(500);
    $.logStep("Create: Temp Dirs");
    await createTemps();
    await $.sleep(1000);
    $.logStep("Create: Out Dirs");
    if (format.includes("esm") && outputDirs?.esm) {
      if (existsSync(outputDirs.esm)) {
        await cleanDir(outputDirs.esm);
      } else {
        await mkdir(outputDirs.esm, { recursive: true });
      }
    }
    if (format.includes("cjs") && outputDirs?.cjs) {
      if (existsSync(outputDirs.cjs)) {
        await cleanDir(outputDirs.cjs);
      } else {
        await mkdir(outputDirs.cjs, { recursive: true });
      }
    }
    if (format.includes("browser") && outputDirs?.browser) {
      if (existsSync(outputDirs.browser)) {
        await cleanDir(outputDirs.browser);
      } else {
        await mkdir(outputDirs.browser, { recursive: true });
      }
    }
    await $.sleep(1000);
    if (format.includes("esm") && !outputDirs?.esm) {
      $.logWarn(
        "WARNING: Output directory for esm required.Build for esm will skipped."
      );
    }
    if (format.includes("esm") && outputDirs?.esm) {
      $.logStep("Compile: ESM");
      await (async () => {
        await compile({
          fileNames: [tempOutFilePath],
          format: "esm",
          declaration: true,
          declareDir: outputDirs.esm,
          outDir: esmtempDir,
          replaceFunction: extensionReplaceEsm,
        });
        await $.sleep(3000);
        const fname = await readdir(esmtempDir);
        const code = await readFile(`${esmtempDir}/${fname}`, "utf8");
        const result = minify(code, {
          sourceMap: true,
          keep_fnames: true,
        });
        const txt = `
      ${result.code}
      //# sourceMappingURL=${fname}.map \n
      `;
        await writeFile(`${outputDirs.esm}/${fname}`, txt);
        if (result.map) {
          await writeFile(`${outputDirs.esm}/${fname}.map`, result.map);
        }
      })();
    }
    await $.sleep(1000);
    if (format.includes("cjs") && !outputDirs?.cjs) {
      $.logWarn(
        "WARNING: Output directory for cjs required.Build for cjs will skipped."
      );
    }
    if (format.includes("cjs") && outputDirs?.cjs) {
      $.logStep("Compile: CJS");
      await (async () => {
        await compile({
          fileNames: [tempOutFilePath],
          format: "cjs",
          declareDir: outputDirs.cjs,
          declaration: true,
          outDir: cjstempDir,
          replaceFunction: extensionReplaceCjs,
        });
        const fname = await readdir(cjstempDir);
        const code = await readFile(`${cjstempDir}/${fname}`, "utf8");
        const result = minify(code, {
          sourceMap: true,
          keep_fnames: true,
          output: {
            beautify: true,
          },
        });
        const txt = `
      ${result.code}
      //# sourceMappingURL=${fname}.map \n
      `;
        await writeFile(`${outputDirs.cjs}/${fname}`, txt);
        if (result.map) {
          await writeFile(`${outputDirs.cjs}/${fname}.map`, result.map);
        }
      })();
    }
    await $.sleep(1000);
    if (format.includes("browser") && !outputDirs?.browser) {
      $.logWarn(
        "WARNING: Output directory for browser required.Build for browser will skipped."
      );
    }
    if (format.includes("browser") && outputDirs?.browser) {
      $.logStep("Compile: Browser");
      await (async () => {
        await compile({
          fileNames: [tempOutFilePath],
          format: "browser",
          outDir: bwtempDir,
          declaration: false,
        });
        const fname = await readdir(bwtempDir);
        const code = await readFile(`${bwtempDir}/${fname}`, "utf8");
        const _lines = code.replace(/export\s+/g, "").split("\n");
        const _code = _lines.join("\n");
        const result = minify(_code, {
          sourceMap: true,
          keep_fnames: true,
          output: {
            beautify: true,
          },
        });
        const txt = `
      ${result.code}
      //# sourceMappingURL=${fname}.map \n
      `;
        await writeFile(`${outputDirs.browser}/${fname}`, txt);
        if (result.map) {
          await writeFile(`${outputDirs.browser}/${fname}.map`, result.map);
        }
      })();
    }
    $.logStep("Remove: Temp Dir");
    await $.sleep(3000);
    await $`rm -r ${tempdir}`;
    const end = performance.now();
    $.logStep(`Done: ${end - start} ms`);
  } catch (e) {
    $.logError((e as Error).message);
    if (existsSync(tempdir)) await $`rm -r ${tempdir}`;
    if (existsSync(outputDirs?.esm as string)) {
      await $`rm -r ${outputDirs?.esm as string}`;
    }
    if (existsSync(outputDirs?.cjs as string)) {
      await $`rm -r ${outputDirs?.cjs as string}`;
    }
    if (existsSync(outputDirs?.browser as string)) {
      await $`rm -r ${outputDirs?.browser as string}`;
    }
  }
};

// export { minify, compile, build, mergeFiles, };
