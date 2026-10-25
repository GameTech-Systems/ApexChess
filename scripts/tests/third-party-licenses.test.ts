import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error untyped .mjs module
import { collectLicenses, formatLicenses } from "../third-party-licenses.mjs";

function pkg(dir: string, data: Record<string, unknown>, files: Record<string, string> = {}) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify(data));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
}

/** app -> lib (MIT, with a LICENSE), app -> workspace pkg -> leaf (no license file). */
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "licenses-"));
  const app = join(root, "app");
  pkg(app, {
    name: "app",
    version: "0.0.0",
    dependencies: { lib: "^1.0.0", "@ws/pkg": "workspace:*" },
  });
  pkg(
    join(root, "node_modules", "lib"),
    { name: "lib", version: "1.2.3", license: "MIT" },
    {
      LICENSE: "MIT License\nCopyright (c) Someone",
    },
  );
  pkg(join(app, "node_modules", "@ws", "pkg"), {
    name: "@ws/pkg",
    version: "0.0.0",
    dependencies: { leaf: "1.0.0" },
  });
  pkg(join(root, "node_modules", "leaf"), {
    name: "leaf",
    version: "1.0.0",
    license: "ISC",
    repository: "git+https://example.com/leaf.git",
  });
  return app;
}

describe("third-party licenses", () => {
  it("lists packages reached through dependencies and workspace packages, not the workspace ones", () => {
    const list = collectLicenses(fixture());
    expect(list.map((p: { name: string }) => p.name)).toEqual(["leaf", "lib"]);
    expect(list[1].texts[0]).toContain("Copyright (c) Someone");
    expect(list[0].source).toBe("https://example.com/leaf");
  });

  it("writes each license with its copyright notice", () => {
    const text = formatLicenses(collectLicenses(fixture()));
    expect(text).toContain("lib 1.2.3 (MIT)");
    expect(text).toContain("Copyright (c) Someone");
    expect(text).toContain("the package declares ISC");
    expect(text).toContain("PolyForm Shield License 1.0.0");
  });

  it("covers the real web app's dependencies", () => {
    const text = formatLicenses(collectLicenses(join(__dirname, "..", "..", "apps", "web")));
    for (const name of ["react ", "react-dom ", "scheduler ", "@simplewebauthn/browser "])
      expect(text).toContain(name);
    expect(text).not.toContain("@apexchess/");
  });
});
