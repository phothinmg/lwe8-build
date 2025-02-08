import {
  readdir,
  unlink,
  readFile,
  writeFile,
  mkdir,
  mkdtemp,
} from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import ts from "typescript";
import { minify } from "uglify-js";
import $ from "dax-sh";
// -----------------------------------------------------
type IndexFile = {
  path: string;
  lines?: number;
};

type OtherFile = {
  path: string;
  lines?: number;
  removeExport?: boolean;
};
type MergeFilesOptions = {
  outFilePath: string;
  indexFile: IndexFile;
  otherFiles?: OtherFile[];
};
export type Format = "esm" | "cjs" | "browser";
export type BuildOptions = {
  format: Format[];
  outputDirs: {
    esm: string;
    cjs: string;
    browser?: string;
  };
  indexFile: IndexFile;
  otherFiles?: OtherFile[];
  fileName?: string;
};
type CompileOptions = {
  fileNames: string[];
  outDir: string;
  declareDir: string;
  format: Format;
  replaceFunction?: (fileName: string) => string;
  complierOptions?: Omit<
    ts.CompilerOptions,
    "module" | "outDir" | "declaration" | "declarationDir" | "allowJs"
  >;
};
//---------------------------------------
export const cleanDir = async function (dir: string) {
  const files = await readdir(dir);
  await Promise.all(files.map((file) => unlink(join(dir, file))));
};

const mergeFiles = async function ({
  outFilePath,
  indexFile,
  otherFiles,
}: MergeFilesOptions) {
  const pn = dirname(outFilePath);
  if (!existsSync(pn)) await mkdir(pn);
  const index_code = await readFile(indexFile.path, "utf8");
  const _indexCode = indexFile.lines
    ? index_code.split("\n").slice(indexFile.lines).join("\n")
    : index_code;
  let _otherCode;
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

const getType = function () {
  const packageJsonFile = join(process.cwd(), "package.json");
  const packageData = readFileSync(packageJsonFile, "utf8");
  const data = JSON.parse(packageData);
  return !data.type || data.type === "commonjs" ? "commonjs" : "module";
};

function extensionReplaceEsm(fileName: string) {
  const type = getType();
  if (type === "commonjs") {
    const ext = extname(fileName);
    if (ext === ".ts") return fileName.slice(0, -3) + ".mts";
    if (ext === ".js") return fileName.slice(0, -3) + ".mjs";
  }
  return fileName;
}

function extensionReplaceCjs(fileName: string) {
  const type = getType();
  if (type === "module") {
    const ext = extname(fileName);
    if (ext === ".ts") return fileName.slice(0, -3) + ".cts";
    if (ext === ".js") return fileName.slice(0, -3) + ".cjs";
  }
  return fileName;
}

export const compile = async function ({
  fileNames,
  outDir,
  declareDir,
  format,
  replaceFunction,
  complierOptions,
}: CompileOptions) {
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
    declaration: true,
    outDir: outDir,
    declarationDir: declareDir,
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

export const build = async function ({
  format,
  outputDirs,
  indexFile,
  otherFiles,
  fileName = "index.ts",
}: BuildOptions) {
  const tempdir = await mkdtemp("_bc");
  const esmtempDir = `${tempdir}/esm`;
  const cjstempDir = `${tempdir}/cjs`;
  const bwtempDir = `${tempdir}/bw`;
  const createTemps = async () => {
    if (format.includes("esm")) {
      await mkdir(esmtempDir);
    }
    if (format.includes("cjs")) {
      await mkdir(cjstempDir);
    }

    if (format.includes("browser")) {
      await mkdir(bwtempDir);
    }
  };
  // -------------------------------------
  const isE = format.includes("esm");
  const isC = format.includes("cjs");
  const isB = format.includes("browser");
  const isAll =
    format.includes("esm") &&
    format.includes("cjs") &&
    format.includes("browser") &&
    outputDirs.esm === outputDirs.cjs &&
    outputDirs.esm === outputDirs.browser;
  const isEC =
    format.includes("esm") &&
    format.includes("cjs") &&
    outputDirs.esm === outputDirs.cjs;
  const isEB =
    format.includes("esm") &&
    format.includes("browser") &&
    outputDirs.esm === outputDirs.browser;
  const isCB =
    format.includes("cjs") &&
    format.includes("browser") &&
    !format.includes("esm") &&
    outputDirs.cjs === outputDirs.browser;
  const isEsm = isAll || isEC || isEB || (!isCB && isE);
  const isCjs = isCB || (!isE && !isB && isC);
  const createEsmDir = async () => {
    if (existsSync(outputDirs.esm)) {
      cleanDir(outputDirs.esm);
    } else {
      await mkdir(outputDirs.esm);
    }
  };
  const createCjsDir = async () => {
    if (existsSync(outputDirs.cjs)) {
      cleanDir(outputDirs.cjs);
    } else {
      await mkdir(outputDirs.cjs);
    }
  };
  const createBwDir = async () => {
    if (existsSync(outputDirs.browser as string)) {
      cleanDir(outputDirs.browser as string);
    } else {
      await mkdir(outputDirs.browser as string);
    }
  };

  const createOutDir = async () => {
    if (isEsm) {
      await createEsmDir();
    } else if (isCjs) {
      await createCjsDir();
    } else {
      await createBwDir();
    }
  };
  // --------------------------------------------
  const tempOutFilePath = `${tempdir}/${fileName}`;
  await mergeFiles({
    outFilePath: tempOutFilePath,
    indexFile,
    otherFiles,
  });
  await $.sleep(500);
  await createTemps();
  await $.sleep(500);
  await createOutDir();
  await $.sleep(1000);
  if (format.includes("esm")) {
    await (async function () {
      await compile({
        fileNames: [tempOutFilePath],
        format: "esm",
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
      //# sourceMappingURL=${fname}.map
      `;
      await writeFile(`${outputDirs.esm}/${fname}`, txt.trim());
      if (result.map) {
        await writeFile(`${outputDirs.esm}/${fname}.map`, result.map);
      }
    })();
  }
  await $.sleep(1000);
  if (format.includes("cjs")) {
    await (async function () {
      await compile({
        fileNames: [tempOutFilePath],
        format: "cjs",
        declareDir: outputDirs.esm,
        outDir: cjstempDir,
        replaceFunction: extensionReplaceCjs,
      });
      const fname = await readdir(cjstempDir);
      const code = await readFile(`${cjstempDir}/${fname}`, "utf8");
      const result = minify(code, {
        sourceMap: true,
        keep_fnames: true,
      });
      const txt = `
      ${result.code}
      //# sourceMappingURL=${fname}.map
      `;
      await writeFile(`${outputDirs.cjs}/${fname}`, txt.trim());
      if (result.map) {
        await writeFile(`${outputDirs.cjs}/${fname}.map`, result.map);
      }
    })();
  }
  await $.sleep(1000);
  if (format.includes("browser")) {
    await (async function () {
      await compile({
        fileNames: [tempOutFilePath],
        format: "browser",
        declareDir: outputDirs.esm,
        outDir: bwtempDir,
      });
      const fname = await readdir(bwtempDir);
      const code = await readFile(`${bwtempDir}/${fname}`, "utf8");
      const _lines = code.replace(/export\s+/g, "").split("\n");
      const _code = _lines.join("\n");
      const result = minify(_code, {
        sourceMap: true,
        keep_fnames: true,
      });
      const txt = `
      ${result.code}
      //# sourceMappingURL=${fname}.map
      `;
      await writeFile(`${outputDirs.browser}/${fname}`, txt.trim());
      if (result.map) {
        await writeFile(`${outputDirs.browser}/${fname}.map`, result.map);
      }
    })();
  }
  await $.sleep(3000);
  await $`rm -r ${tempdir}`;
};

export { minify };
