import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import english from "./en.json";

// Catch missing catalog entries without depending on whichever UI states a browser test visits.
describe("translation coverage", () => {
  const root = new URL("../../", import.meta.url);
  const files = [
    "src/App.tsx",
    ...readdirSync(new URL("src/routes/", root)).filter((file) => file.endsWith(".tsx")).map((file) => `src/routes/${file}`),
    "src/components/ConfirmDialog.tsx",
    "src/components/SiteInfoButton.tsx",
    "src/components/SiteFooter.tsx",
    "src/components/PrivacyConsent.tsx",
    "src/components/SiteBrand.tsx",
    "src/components/SiteHeader.tsx",
    "src/lib/quotaReset.ts",
    "src/lib/searchExperience.ts",
  ];

  it.each(files)("covers interface messages in %s", (file) => {
    const text = readFileSync(new URL(file, root), "utf8");
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const catalog: Record<string, string> = english;
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && node.expression.getText(source) === "t" && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const key = node.arguments[0].text;
        expect(catalog[key], `Missing English message: ${key}`).toBeDefined();
      }
      if (ts.isJsxText(node)) expect(node.text).not.toMatch(/\p{Script=Han}/u);
      if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
        expect(node.initializer.text).not.toMatch(/\p{Script=Han}/u);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  });
});
