# Lwe8 Build

## Overview

Mini build tool.

### Install

```shell
npm i lwe8-build
```

### Use

```js
import { compile } from ".lwe8-build";

await compile({
  entry: "./src/index.ts",
  format: "esm",
  outDir: "dist",
  declaration: true,
});

await compile({
  entry: "./src/index.ts",
  format: "cjs",
  outDir: "dist",
});
```

### License

[MIT][file-license] © [Pho Thin Mg][ptm]

<!-- Definitions -->

[file-license]: LICENSE
[ptm]: https://github.com/phothinmg
