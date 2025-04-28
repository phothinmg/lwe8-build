import ts from "typescript";
import type { MergeFilesOptions } from "./merge";
import { mergeFiles } from "./merge.js";
/**
 * Remove all files in the given directory.
 * @param dir The directory to clean.
 */
export declare const cleanDir: (dir: string) => Promise<void>;
export type Format = "esm" | "cjs" | "browser";
export type CompileOptions = {
    entry: string;
    format: Format;
    outDir: string;
    declaration?: boolean;
    declarationDir?: string;
    sourceMap?: boolean;
    compilerOptions?: Omit<ts.CompilerOptions, "module" | "outDir" | "declaration" | "declarationDir" | "allowJs">;
};
export declare function compile({ entry, format, outDir, declaration, compilerOptions, declarationDir, sourceMap, }: CompileOptions): Promise<void>;
export { type MergeFilesOptions, mergeFiles };
