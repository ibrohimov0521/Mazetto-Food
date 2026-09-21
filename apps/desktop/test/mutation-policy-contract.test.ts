import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";
import { classifyOfflineMutation } from "../src/commands.js";

const modulesRoot = resolve(process.cwd(), "../backend/src/modules");

test("every backend staff mutation is queueable or explicitly online-only", () => {
  const files = ts.sys
    .readDirectory(modulesRoot, [".ts"], undefined, ["**/*.controller.ts"])
    .sort();
  const unknown: string[] = [];

  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const statement of source.statements) {
      if (!ts.isClassDeclaration(statement)) continue;
      const prefixes = decoratorPaths(statement, "Controller");
      if (prefixes.length === 0) continue;
      for (const member of statement.members) {
        if (!ts.isMethodDeclaration(member)) continue;
        for (const method of ["Post", "Patch", "Put", "Delete"] as const) {
          const paths = decoratorPaths(member, method);
          for (const prefix of prefixes) {
            for (const path of paths) {
              const pathname = normalizeRoute(prefix, path);
              if (classifyOfflineMutation(method.toUpperCase(), pathname) === "unknown") {
                unknown.push(`${method.toUpperCase()} ${pathname}`);
              }
            }
          }
        }
      }
    }
  }

  assert.deepEqual(unknown, []);
});

function decoratorPaths(node: ts.Node, name: string): string[] {
  const decorators = ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : [];
  const match = decorators.find((decorator) => {
    const expression = decorator.expression;
    return ts.isCallExpression(expression) && ts.isIdentifier(expression.expression) && expression.expression.text === name;
  });
  if (!match || !ts.isCallExpression(match.expression)) return [];
  const argument = match.expression.arguments[0];
  if (!argument) return [""];
  if (ts.isStringLiteral(argument)) return [argument.text];
  if (ts.isArrayLiteralExpression(argument)) {
    return argument.elements.filter(ts.isStringLiteral).map((element) => element.text);
  }
  return [];
}

function normalizeRoute(prefix: string, path: string): string {
  const route = ["api", "v1", prefix, path]
    .filter(Boolean)
    .join("/")
    .replace(/:([A-Za-z0-9_]+)/g, "$1-sample");
  return `/${route}`;
}
