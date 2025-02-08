import ts from "typescript";
import { minify } from "uglify-js";
type IndexFile = {
    path: string;
    lines?: number;
};
type OtherFile = {
    path: string;
    lines?: number;
    removeExport?: boolean;
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
    complierOptions?: Omit<ts.CompilerOptions, "module" | "outDir" | "declaration" | "declarationDir" | "allowJs">;
};
export declare const cleanDir: (dir: string) => Promise<void>;
export declare const compile: ({ fileNames, outDir, declareDir, format, replaceFunction, complierOptions, }: CompileOptions) => Promise<void>;
export declare const build: ({ format, outputDirs, indexFile, otherFiles, fileName, }: BuildOptions) => Promise<void>;
export { minify };
