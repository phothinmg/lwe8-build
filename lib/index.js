var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { existsSync } from "node:fs";
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import ts from "typescript";
import { mergeFiles } from "./merge.js";
import { replaceFileExtensions } from "./replace-ext.js";
/**
 * Remove all files in the given directory.
 * @param dir The directory to clean.
 */
export var cleanDir = function (dir) { return __awaiter(void 0, void 0, void 0, function () {
    var files;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, readdir(dir)];
            case 1:
                files = _a.sent();
                return [4 /*yield*/, Promise.all(files.map(function (file) { return unlink(join(dir, file)); }))];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
// ## getModuleType
var getModuleType = function (format) {
    var moduleType = ts.ModuleKind.ES2015;
    if (format === "esm") {
        moduleType = ts.ModuleKind.ESNext;
    }
    else if (format === "cjs") {
        moduleType = ts.ModuleKind.CommonJS;
    }
    else if (format === "browser") {
        moduleType = ts.ModuleKind.ES2015;
    }
    return moduleType;
};
export function compile(_a) {
    return __awaiter(this, arguments, void 0, function (_b) {
        var declareBool, declareDir, sm, options, fileNames, createdFiles, host, program;
        var entry = _b.entry, format = _b.format, outDir = _b.outDir, declaration = _b.declaration, compilerOptions = _b.compilerOptions, declarationDir = _b.declarationDir, sourceMap = _b.sourceMap;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    declareBool = !declaration || format === "browser" ? false : declaration;
                    declareDir = declarationDir ? { declarationDir: declarationDir } : {};
                    sm = sourceMap ? { sourceMap: sourceMap } : {};
                    options = __assign(__assign(__assign({ allowJs: true, module: getModuleType(format), declaration: declareBool, outDir: outDir, jsx: ts.JsxEmit.React }, compilerOptions), declareDir), sm);
                    fileNames = [entry];
                    createdFiles = {};
                    host = ts.createCompilerHost(options);
                    host.writeFile = function (fileName, contents) {
                        fileName = replaceFileExtensions(fileName, format);
                        createdFiles[fileName] = contents;
                    };
                    program = ts.createProgram(fileNames, options, host);
                    program.emit();
                    return [4 /*yield*/, Promise.all(Object.entries(createdFiles).map(function (_a) {
                            var outName = _a[0], contents = _a[1];
                            var dir = dirname(outName);
                            if (!existsSync(dir)) {
                                mkdir(dir, { recursive: true });
                            }
                            writeFile(outName, contents);
                        }))];
                case 1:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    });
}
export { mergeFiles };
// ------------------------------------------------------------- //
