import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pageHtml, SITE } from "./pageHtml";
import { ROUTE_PATHS, ROUTE_TITLES, type Route } from "./routes";

const index = readFileSync(join(__dirname, "..", "index.html"), "utf8");

describe("built page files", () => {
  for (const route of Object.keys(ROUTE_PATHS) as Route[]) {
    it(`${route} gets its own title, description, canonical and share tags`, () => {
      const { title, description } = ROUTE_TITLES[route];
      const url = SITE + ROUTE_PATHS[route];
      const html = pageHtml(index, ROUTE_PATHS[route], ROUTE_TITLES[route]);
      expect(html).toContain(`<title>${title}</title>`);
      expect(html).toContain(`<link rel="canonical" href="${url}" />`);
      expect(html).toMatch(new RegExp(`property="og:url" content="${url}"`));
      expect(html).toContain(`content="${description}"`);
      expect(html).toMatch(
        new RegExp(`name="twitter:title" content="${title.replace("|", "\\|")}"`),
      );
      expect(html).toContain(`<h1>${title}</h1>`);
      expect(html).not.toContain(`href="${SITE}/" />`);
      expect(html).toContain('<div id="root"></div>');
    });
  }
  it("escapes quotes and fails loudly when a tag is missing", () => {
    expect(pageHtml(index, "/x/", { title: "A & B", description: 'say "hi"' })).toContain(
      'content="say &quot;hi&quot;"',
    );
    expect(() => pageHtml("<title>x</title>", "/x/", { title: "t", description: "d" })).toThrow();
  });
  it("home keeps the source page's text", () => {
    const html = pageHtml(index, "/", ROUTE_TITLES.home);
    expect(html).toContain(`<link rel="canonical" href="${SITE}/" />`);
    expect(html).toContain(ROUTE_TITLES.home.description);
  });
});
