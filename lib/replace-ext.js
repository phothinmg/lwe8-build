import { readFileSync } from "node:fs";
import { join } from "node:path";
/**
 * Read the type field from the package.json file in the current working directory.
 * @returns "commonjs" if the type field is not present or is "commonjs", otherwise "module".
 */
var getType = function () {
    var packageJsonFile = join(process.cwd(), "package.json");
    var packageData = readFileSync(packageJsonFile, "utf8");
    var data = JSON.parse(packageData);
    return !data.type || data.type === "commonjs" ? "commonjs" : "module";
};
export var replaceFileExtensions = function (fileName, format) {
    var type = getType();
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
            fileName = "".concat(fileName.slice(0, -3), ".global.js");
            break;
    }
    return fileName;
};
