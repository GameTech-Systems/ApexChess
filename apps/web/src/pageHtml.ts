/** Built page files: a copy of index.html per address, with that page's title, description and canonical link. */
export const SITE = "https://apexchess.icu";

export interface PageMeta {
  title: string;
  description: string;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Set the `content` of the <meta> whose `attr` is `name`, however the tag is wrapped. */
function setMeta(html: string, attr: string, name: string, value: string): string {
  const re = new RegExp(`(<meta\\s+${attr}="${name}"\\s+content=")[^"]*(")`);
  if (!re.test(html)) throw new Error(`index.html has no <meta ${attr}="${name}">`);
  return html.replace(re, `$1${esc(value)}$2`);
}

const NOSCRIPT_NOTE =
  "<noscript><p>Apex Chess needs JavaScript to play. Please turn it on and reload.</p></noscript>";

/**
 * `html` (the built index.html) rewritten for the page at `path` ("/rules/").
 * With `body` (the page's text, rendered at build time) it goes inside the root, so it reads
 * without JavaScript; the app replaces it when it starts.
 */
export function pageHtml(html: string, path: string, meta: PageMeta, body?: string): string {
  const url = SITE + path;
  let out = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(meta.title)}</title>`);
  out = out.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`);
  out = setMeta(out, "name", "description", meta.description);
  out = setMeta(out, "property", "og:url", url);
  out = setMeta(out, "property", "og:title", meta.title);
  out = setMeta(out, "property", "og:description", meta.description);
  out = setMeta(out, "name", "twitter:title", meta.title);
  out = setMeta(out, "name", "twitter:description", meta.description);
  if (body !== undefined) {
    if (!out.includes('<div id="root"></div>')) throw new Error("index.html has no empty root");
    return out
      .replace('<div id="root"></div>', () => `<div id="root">${body}</div>`)
      .replace(/<noscript>[\s\S]*?<\/noscript>/, NOSCRIPT_NOTE);
  }
  return out.replace(
    /(<noscript>\s*<h1>)[^<]*(<\/h1>\s*<p>)[^<]*(<\/p>)/,
    `$1${esc(meta.title)}$2${esc(meta.description)}$3`,
  );
}
