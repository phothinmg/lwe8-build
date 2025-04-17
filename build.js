import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
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
    sourceMap: true,
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
    createdFiles[outName] = contents;
  };
  const program = ts.createProgram(["./src/index.ts"], options, host);
  program.emit();
  Object.entries(createdFiles).map(([outName, contents]) => {
    const ext = path.extname(outName);
    fs.writeFileSync(outName, contents);
  });
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
    sourceMap: true,
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
    createdFiles[fileName] = contents;
  };
  const program = ts.createProgram(["./src/index.ts"], options, host);
  program.emit();
  Object.entries(createdFiles).map(([outName, contents]) => {
    outName = outName.replace(/.js/, ".cjs").replace(/.ts/, ".cts");
    fs.writeFileSync(outName, contents);
  });
  Object.entries(mapFiles).map(([outName, contents]) =>
    fs.writeFileSync(outName, contents)
  );
})();
