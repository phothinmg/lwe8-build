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
export type CompileOptions = {
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
//const gray = (d: string) => `\x1b[0;38;5;0m${d}\x1b[0m`;

/**
 * Remove all files in the given directory.
 * @param dir The directory to clean.
 */
const cleanDir = async (dir: string) => {
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
const mergeFiles = async ({
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
const getType = () => {
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
const compile = async ({
	fileNames,
	outDir,
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
			writeFile(outName, contents),
		),
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
const build = async ({
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
	/**
	 * If the esm output directory exists, clean it.
	 * Otherwise, create it.
	 * @returns {Promise<void>}
	 */
	const createEsmDir = async (): Promise<void> => {
		if (existsSync(outputDirs.esm)) {
			cleanDir(outputDirs.esm);
		} else {
			await mkdir(outputDirs.esm, { recursive: true });
		}
	};
	/**
	 * If the cjs output directory exists, clean it.
	 * Otherwise, create it.
	 * @returns {Promise<void>}
	 */
	const createCjsDir = async (): Promise<void> => {
		if (existsSync(outputDirs.cjs)) {
			cleanDir(outputDirs.cjs);
		} else {
			await mkdir(outputDirs.cjs, { recursive: true });
		}
	};
	/**
	 * Ensures the browser output directory exists.
	 * If the directory exists, it cleans the directory by removing all files.
	 * If the directory doesn't exist, it creates a new directory.
	 * @returns {Promise<void>}
	 */
	const createBwDir = async (): Promise<void> => {
		if (existsSync(outputDirs.browser as string)) {
			cleanDir(outputDirs.browser as string);
		} else {
			await mkdir(outputDirs.browser as string, { recursive: true });
		}
	};

	/**
	 * Creates the output directory if it doesn't exist, and cleans it if it does.
	 * It chooses the correct output directory based on the given format.
	 * @returns {Promise<void>} A promise that resolves when the output directory is created/cleaned.
	 */
	const createOutDir = async (): Promise<void> => {
		if (isEsm) {
			await createEsmDir();
		} else if (isCjs) {
			await createCjsDir();
		} else {
			await createBwDir();
		}
	};
	// ------------------------------------------
	const start = performance.now();
	// --------------------------------------------
	$.logStep("Build Process Started .... ");
	const tempOutFilePath = `${tempdir}/${fileName}`;
	await mergeFiles({
		outFilePath: tempOutFilePath,
		indexFile,
		otherFiles,
	});
	await $.sleep(500);
	$.logStep("Creating Temp Dirs .... ");
	await createTemps();
	await $.sleep(500);
	await createOutDir();
	await $.sleep(1000);
	if (format.includes("esm")) {
		$.logStep("Compiling for ESM  .... ");
		await (async () => {
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
		$.logStep("Compiling for CJS  .... ");
		await (async () => {
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
		$.logStep("Compiling for Browser  .... ");
		await (async () => {
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
	$.logStep("Removing Temp Directory");
	await $.sleep(3000);
	await $`rm -r ${tempdir}`;
	const end = performance.now();
	$.logStep(`Done in ... ${end - start} ms`);
};

export { minify, compile, build };
