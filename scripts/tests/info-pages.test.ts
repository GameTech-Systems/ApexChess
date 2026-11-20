import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs scripts
import { PAGES, buildPages, writeInfoPages, markdownToHtml } from "../info-pages.mjs";

const root = join(__dirname, "..", "..");
const SITE = "https://apexchess.icu";
const slugs = ["how-to-play", "rules", "45-degree-chess", "custom-setups", "about"];

describe("info pages", () => {
  const pages: Record<string, string> = buildPages(
    readFileSync(join(root, "docs/RULES.md"), "utf8"),
  );

  it("builds the five pages, each with title, description, canonical, and a single h1", () => {
    expect(PAGES.map((p: { slug: string }) => p.slug)).toEqual(slugs);
    for (const slug of slugs) {
      const html = pages[slug]!;
      expect(html).toContain("<!doctype html>");
      expect(html).toMatch(/<title>[^<]+ \| Apex Chess<\/title>/);
      expect(html).toMatch(/<meta name="description" content="[^"]{40,}"/);
      expect(html).toContain(`<link rel="canonical" href="${SITE}/${slug}/" />`);
      expect(html.match(/<h1>/g)).toHaveLength(1);
      expect(html).toContain('href="/"');
      expect(html).not.toContain("<script");
    }
  });

  it("takes rules text from docs/RULES.md and keeps decision ids out", () => {
    expect(pages["rules"]).toContain("light at h1, dark at a8");
    expect(pages["how-to-play"]).toContain("no castling");
    expect(pages["custom-setups"]).toContain("Only one piece beyond the front chord");
    expect(pages["custom-setups"]).toContain("K/BR/RQB/PPPP/PPNPP/5N");
    expect(pages["45-degree-chess"]).toContain("Elbow Room");
    for (const html of Object.values(pages)) {
      expect(html).not.toMatch(/\bD\d{1,2}\b/);
      expect(html).not.toContain("draft 0.1");
    }
  });

  it("escapes text and renders tables, lists, and emphasis", () => {
    const html = markdownToHtml("## A\n\n- **x** <b>\n- y\n\n| a | b |\n|---|---|\n| 1 | `2` |\n");
    expect(html).toContain("<ul><li><strong>x</strong> &lt;b&gt;</li><li>y</li></ul>");
    expect(html).toContain("<table>");
    expect(html).toContain("<td><code>2</code></td>");
  });

  it("the sitemap lists the home page and every info page, and the app links to them", () => {
    const xml = readFileSync(join(root, "apps/web/public/sitemap.xml"), "utf8");
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual([`${SITE}/`, ...slugs.map((s) => `${SITE}/${s}/`)]);
    for (const slug of slugs) expect(pages["about"]).toContain(`href="/${slug}/"`);
  });

  it("writes <slug>/index.html and the shared style sheet into a folder", () => {
    const dir = mkdtempSync(join(tmpdir(), "info-"));
    writeInfoPages(dir, root);
    for (const slug of slugs) {
      expect(readFileSync(join(dir, slug, "index.html"), "utf8")).toContain("Apex Chess");
    }
    expect(readFileSync(join(dir, "info.css"), "utf8")).toContain("body");
  });
});
