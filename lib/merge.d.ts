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
    indexFile: IndexFile;
    otherFiles?: OtherFile[];
};
/**
 * Merge the given files into a single file.
 * @param indexFile The main file to be merged.
 * @param otherFiles The other files to be merged.
 * @returns A promise that resolves when the merge is complete.
 */
export declare const mergeFiles: ({ indexFile, otherFiles, }: MergeFilesOptions) => Promise<string>;
export {};
