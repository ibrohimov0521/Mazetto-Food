import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const desktopDirectory = resolve(scriptsDirectory, "..");
const sourcePath = resolve(desktopDirectory, "src", "preload.ts");
const outputPath = resolve(desktopDirectory, "dist", "preload.cjs");
const source = await readFile(sourcePath, "utf8");
const result = ts.transpileModule(source, {
  fileName: sourcePath,
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
});

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, result.outputText, "utf8");