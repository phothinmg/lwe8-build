import { dirname } from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";

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
  const txt = `
        ${_otherCode}
        ${_indexCode}
        `;

  await writeFile(outFilePath, txt.trim());
};
