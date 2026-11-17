import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const web = join(__dirname, "..", "..", "apps", "web");
const read = (p: string) => readFileSync(join(web, p), "utf8");
const SITE = "https://apexchess.icu";

/** PNG width and height live in the IHDR chunk, right after the 8-byte signature. */
function pngSize(path: string): [number, number] {
  const b = readFileSync(join(web, path));
  expect(b.subarray(1, 4).toString()).toBe("PNG");
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe("launch files (apps/web)", () => {
  const html = read("index.html");

  it("index.html carries the canonical link and share tags", () => {
    expect(html).toContain(`<link rel="canonical" href="${SITE}/" />`);
    expect(html).toContain(`<meta property="og:image" content="${SITE}/og-image.png" />`);
    expect(html).toMatch(/property="og:image:alt"/);
    expect(html).toMatch(/property="og:site_name" content="Apex Chess"/);
    expect(html).toMatch(/name="twitter:card" content="summary_large_image"/);
    expect(html).toContain(`name="twitter:image" content="${SITE}/og-image.png"`);
    expect(html).toMatch(/rel="apple-touch-icon"/);
    expect(html).toMatch(/rel="manifest" href="\/site.webmanifest"/);
  });

  it("the share image is 1200x630 and every linked icon exists", () => {
    expect(pngSize("public/og-image.png")).toEqual([1200, 630]);
    expect(pngSize("public/apple-touch-icon.png")).toEqual([180, 180]);
    expect(existsSync(join(web, "public/favicon.ico"))).toBe(true);
  });

  it("robots.txt keeps /api out and points at the sitemap", () => {
    const robots = read("public/robots.txt");
    expect(robots).toContain("Disallow: /api/");
    expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  });

  it("sitemap.xml lists the home page on the canonical host only", () => {
    const xml = read("public/sitemap.xml");
    expect(xml).toContain("http://www.sitemaps.org/schemas/sitemap/0.9");
    expect([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])).toEqual([`${SITE}/`]);
  });

  it("the manifest names the app and its icons exist at the stated sizes", () => {
    const m = JSON.parse(read("public/site.webmanifest"));
    expect(m.name).toBe("Apex Chess");
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
    for (const icon of (m.icons as { src: string; sizes: string; type: string }[]).filter(
      (i) => i.type === "image/png",
    )) {
      const [w, h] = icon.sizes.split("x").map(Number);
      expect(pngSize(`public${icon.src}`)).toEqual([w, h]);
    }
  });

  it("security.txt has a contact, an expiry in the future, and the canonical URL", () => {
    const t = read("public/.well-known/security.txt");
    expect(t).toMatch(/^Contact: https:\/\/github\.com\/GameTech-Systems\/ApexChess\/security/m);
    const expires = /^Expires: (.+)$/m.exec(t)?.[1];
    expect(Date.parse(expires ?? "")).toBeGreaterThan(Date.now());
    expect(t).toContain(`Canonical: ${SITE}/.well-known/security.txt`);
  });
});
