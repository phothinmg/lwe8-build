import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
import { minify } from "uglify-js";
//-----------------------------------
const out = "./dist";
if (fs.existsSync(out)) {
  const files = fs.readdirSync(out);
  if (files.length > 0) {
    files.map((i) => fs.unlinkSync(`${out}/${i}`));
  }
} else {
  fs.mkdirSync(out, { recursive: true });
}
// -----------------------------------------------------------
(() => {
  /** @type {ts.CompilerOptions} */
  const options = {
    allowJs: true,
    module: ts.ModuleKind.ESNext,
    declaration: true,
    outDir: out,
  };

  /**
   * @type {Record<string,string>}
   */
  const createdFiles = {};
  /**
   * @type {Record<string,string>}
   */
  const mapFiles = {};
  const host = ts.createCompilerHost(options);
  /**
   *
   * @param {string} fileName
   * @param {string} contents
   */
  host.writeFile = (fileName, contents) => {
    const ext = path.extname(fileName);
    const outName = fileName;
    const mini = minify(contents, { keep_fnames: true, sourceMap: true });
    const _content = ext === ".js" ? mini.code : contents;
    createdFiles[outName] = _content;
    if (ext === ".js") {
      mapFiles[`${outName}.map`] = mini.map;
    }
  };
  const program = ts.createProgram(["./index.ts"], options, host);
  program.emit();
  Object.entries(createdFiles).map(([outName, contents]) =>
    fs.writeFileSync(outName, contents)
  );
  Object.entries(mapFiles).map(([outName, contents]) =>
    fs.writeFileSync(outName, contents)
  );
})();
// ----------------------------------------------------------------
(() => {
  /** @type {ts.CompilerOptions} */
  const options = {
    allowJs: true,
    module: ts.ModuleKind.CommonJS,
    declaration: true,
    outDir: out,
  };

  /**
   * @type {Record<string,string>}
   */
  const createdFiles = {};
  /**
   * @type {Record<string,string>}
   */
  const mapFiles = {};
  const host = ts.createCompilerHost(options);
  /**
   *
   * @param {string} fileName
   * @param {string} contents
   */
  host.writeFile = (fileName, contents) => {
    const ext = path.extname(fileName);
    const outName =
      ext === ".ts"
        ? fileName.slice(0, -3) + ".cts"
        : fileName.slice(0, -3) + ".cjs";
    const mini = minify(contents, { keep_fnames: true, sourceMap: true });
    const _content = ext === ".js" ? mini.code : contents;
    createdFiles[outName] = _content;
    if (ext === ".js") {
      mapFiles[`${outName}.map`] = mini.map;
    }
  };
  const program = ts.createProgram(["./index.ts"], options, host);
  program.emit();
  Object.entries(createdFiles).map(([outName, contents]) =>
    fs.writeFileSync(outName, contents)
  );
  Object.entries(mapFiles).map(([outName, contents]) =>
    fs.writeFileSync(outName, contents)
  );
})();
