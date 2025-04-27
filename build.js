#!/usr/bin/env node
import { compile } from "./lib/index.js";

await compile({
  entry: "./src/index.ts",
  format: "esm",
  outDir: "dist",
  declaration: true,
});

await compile({
  entry: "./src/index.ts",
  format: "cjs",
  outDir: "dist/commonjs",
});
