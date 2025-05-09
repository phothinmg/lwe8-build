import { readFileSync } from "node:fs";
import { join } from "node:path";
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

export const replaceFileExtensions = (
	fileName: string,
	format: "esm" | "cjs" | "browser",
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
