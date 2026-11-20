// Static, indexable info pages (S26). Text comes from docs/RULES.md; no new rules.
// Usage: node scripts/info-pages.mjs <dist-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = "https://apexchess.icu";
const CONTACT = "GameTypeBrand@gmail.com";
const SOURCE = "https://github.com/gametech-systems/apexchess";

/** Section headings of docs/RULES.md that each page uses, in order. */
export const PAGES = [
  {
    slug: "how-to-play",
    title: "How to play Apex Chess",
    description:
      "How to play Apex Chess: the turned board, chords and rays, the default setup, how each piece moves, and how a game ends.",
    intro: "Apex Chess uses the pieces you know on a board turned 45°.",
    sections: [
      "The board",
      "Default setup",
      "How the pieces move",
      "Check, checkmate, and the end of the game",
    ],
  },
  {
    slug: "rules",
    title: "Rules",
    description:
      "The full rules of Apex Chess: board, chords and rays, setups, Player's Choice, piece movement, check and draws, and opening lines.",
    intro: "The complete rules of Apex Chess.",
    sections: [
      "The board",
      "Chords and rays",
      "Default setup",
      "Player's Choice (custom setups)",
      "How the pieces move",
      "Check, checkmate, and the end of the game",
      "Opening lines",
      "Future rule sets",
    ],
  },
  {
    slug: "45-degree-chess",
    title: "45-degree chess",
    description:
      "Apex Chess is chess on a board turned 45°, so each king starts in its own light corner. See how the turn changes the lines on the board.",
    intro: "Standard pieces, a standard 8×8 board, turned 45°.",
    sections: ["The board", "Chords and rays", "The Elbow Room"],
  },
  {
    slug: "custom-setups",
    title: "Custom setups (Player's Choice)",
    description:
      "Arrange your own Apex Chess starting position under two rules, share it as a setup code, and see how opening lines open up.",
    intro: "Choose your own arrangement of the same 16 pieces.",
    sections: ["Player's Choice (custom setups)", "Opening lines"],
  },
  {
    slug: "about",
    title: "About Apex Chess",
    description:
      "About Apex Chess: chess shifted 45°, free to play at apexchess.icu, with rules and setups kept as data and the source code available to read.",
    intro: "",
    sections: [],
  },
];

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Decision ids belong to the owner's ledger, not to public pages. */
const stripIds = (s) =>
  s
    .replace(/\s*\*\((?:provisional, )?D\d+(?:, provisional)?\)\*/g, "")
    .replace(/\s*\(provisional, D\d+\)/g, "")
    .replace(/, D\d+\)/g, ")");

function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

/** Small Markdown subset: ## and ### headings, paragraphs, - lists, 1. lists, pipe tables. */
export function markdownToHtml(md, baseLevel = 2) {
  const lines = md.split("\n");
  const out = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
    } else if (/^#{2,3} /.test(line)) {
      const level = line.startsWith("###") ? baseLevel + 1 : baseLevel;
      out.push(`<h${level}>${inline(line.replace(/^#+ /, ""))}</h${level}>`);
      i++;
    } else if (/^\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) =>
        r
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => inline(c.trim()));
      const [head, , ...body] = rows;
      out.push(
        "<table><thead><tr>" +
          cells(head)
            .map((c) => `<th>${c}</th>`)
            .join("") +
          "</tr></thead><tbody>" +
          body
            .map(
              (r) =>
                "<tr>" +
                cells(r)
                  .map((c) => `<td>${c}</td>`)
                  .join("") +
                "</tr>",
            )
            .join("") +
          "</tbody></table>",
      );
    } else if (/^(- |\d+\. )/.test(line)) {
      const tag = line.startsWith("- ") ? "ul" : "ol";
      const items = [];
      while (i < lines.length && /^(- |\d+\. )/.test(lines[i])) {
        items.push(`<li>${inline(lines[i++].replace(/^(- |\d+\. )/, ""))}</li>`);
      }
      out.push(`<${tag}>${items.join("")}</${tag}>`);
    } else {
      const para = [];
      while (i < lines.length && lines[i].trim() && !/^(#{2,3} |\||- |\d+\. )/.test(lines[i])) {
        para.push(lines[i++]);
      }
      out.push(`<p>${inline(para.join(" "))}</p>`);
    }
  }
  return out.join("\n");
}

/** Map of heading text (numbering removed) to the section's Markdown, from the "## " level. */
export function sectionsOf(rulesMd) {
  const map = {};
  const parts = rulesMd.split(/^(?=## )/m).slice(1);
  for (const part of parts) {
    const [head, ...rest] = part.split("\n");
    map[head.replace(/^## (\d+\. )?/, "").trim()] =
      `${head.replace(/^## (\d+\. )?/, "## ")}\n${rest.join("\n")}`;
  }
  return map;
}

const NAV = [
  ["how-to-play", "How to play"],
  ["rules", "Rules"],
  ["45-degree-chess", "45-degree chess"],
  ["custom-setups", "Custom setups"],
  ["about", "About"],
];

function aboutBody() {
  return [
    "<p>Apex Chess is chess on a board turned 45°, so each king starts in its own light corner. The pieces are the standard ones; only the board is turned.</p>",
    "<p>You can play the default setup, or bring your own arrangement (Player's Choice). Online, you see your opponent's arrangement only when the game begins. Play against a friend on one screen, against the computer, or online at <a href=\"/\">apexchess.icu</a>.</p>",
    "<p>Rules and setups are kept as data, so new setups, presets, and rule sets can be added without rewriting the game. Every saved game records the ruleset and both setups it was played with.</p>",
    `<p>The code and rules are source-available under the PolyForm Shield License 1.0.0; they are not open source. <a href="${SOURCE}">Source code</a>. Contact: <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>`,
    "<h2>Read more</h2>",
    "<ul>" +
      NAV.filter(([s]) => s !== "about")
        .map(([s, t]) => `<li><a href="/${s}/">${t}</a></li>`)
        .join("") +
      "</ul>",
  ].join("\n");
}

function render(page, body) {
  const nav = NAV.map(([s, t]) =>
    s === page.slug ? `<a href="/${s}/" aria-current="page">${t}</a>` : `<a href="/${s}/">${t}</a>`,
  ).join(" ");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(page.title)} | Apex Chess</title>
<meta name="description" content="${esc(page.description)}" />
<link rel="canonical" href="${SITE}/${page.slug}/" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="stylesheet" href="/info.css" />
<meta property="og:title" content="${esc(page.title)} | Apex Chess" />
<meta property="og:description" content="${esc(page.description)}" />
<meta property="og:type" content="article" />
<meta property="og:url" content="${SITE}/${page.slug}/" />
<meta property="og:site_name" content="Apex Chess" />
<meta property="og:image" content="${SITE}/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />
</head>
<body>
<header><a href="/">Apex Chess</a> <a class="play" href="/">Play now</a></header>
<nav aria-label="Pages">${nav}</nav>
<main>
<h1>${esc(page.title)}</h1>
${body}
</main>
<footer><p>© 2026 Duke Johnson. Apex Chess™ is a trademark of Duke Johnson. <a href="/">Play at apexchess.icu</a></p></footer>
</body>
</html>
`;
}

export const CSS = `body { font: 1rem/1.6 system-ui, sans-serif; margin: 0; color: #1b2430; background: #f3f6fa; }
header, nav, main, footer { max-width: 44rem; margin: 0 auto; padding: 0.5rem 1rem; }
header { display: flex; justify-content: space-between; align-items: center; font-weight: 700; }
nav a { margin-right: 0.75rem; }
a { color: #0b5cad; }
.play { background: #0b5cad; color: #fff; padding: 0.4rem 0.9rem; border-radius: 0.4rem; text-decoration: none; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #c5d0dd; padding: 0.35rem 0.5rem; text-align: left; }
code { background: #e4eaf2; padding: 0 0.25rem; border-radius: 0.2rem; }
footer { font-size: 0.875rem; color: #4a5766; }
@media (prefers-color-scheme: dark) {
  body { color: #e6ebf2; background: #121820; }
  a { color: #7db7f5; }
  .play { background: #2a74c4; }
  th, td { border-color: #3a4656; }
  code { background: #232d3a; }
  footer { color: #a9b4c2; }
}
`;

export function buildPages(rulesMd) {
  const secs = sectionsOf(rulesMd);
  const out = {};
  for (const page of PAGES) {
    let body;
    if (page.slug === "about") body = aboutBody();
    else {
      const parts = page.sections.map((name) => {
        if (!secs[name]) throw new Error(`docs/RULES.md has no section "${name}"`);
        return secs[name];
      });
      body = `<p>${esc(page.intro)}</p>\n` + markdownToHtml(stripIds(parts.join("\n")));
      body += `\n<p><a href="/">Play Apex Chess</a> or read the <a href="/rules/">full rules</a>.</p>`;
    }
    out[page.slug] = render(page, body);
  }
  return out;
}

export function writeInfoPages(
  dist,
  repoRoot = join(dirname(fileURLToPath(import.meta.url)), ".."),
) {
  const pages = buildPages(readFileSync(join(repoRoot, "docs", "RULES.md"), "utf8"));
  for (const [slug, html] of Object.entries(pages)) {
    mkdirSync(join(dist, slug), { recursive: true });
    writeFileSync(join(dist, slug, "index.html"), html);
  }
  writeFileSync(join(dist, "info.css"), CSS);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeInfoPages(resolve(process.argv[2] ?? "dist"));
}
