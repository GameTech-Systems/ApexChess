import type { Panel } from "./Home";

/** Each page has its own address; every one is served by the same app (single-page fallback). */
export type Route = Panel | "tournaments";

export const ROUTE_PATHS: Record<Route, string> = {
  rules: "/rules/",
  about: "/about/",
  tournaments: "/tournaments/",
  stats: "/stats/",
  leaderboard: "/leaderboard/",
  account: "/account/",
  privacy: "/privacy/",
  terms: "/terms/",
};

/** Retired pages whose text now lives in the rules page. */
const RETIRED = ["how-to-play", "45-degree-chess", "custom-setups"];

/** The page an address names, or undefined for the home page and unknown addresses. */
export function routeOf(pathname: string): Route | undefined {
  const slug = pathname.replace(/^\/+|\/+$/g, "");
  if (RETIRED.includes(slug)) return "rules";
  return (Object.keys(ROUTE_PATHS) as Route[]).find((r) => ROUTE_PATHS[r] === `/${slug}/`);
}

/** Page title and description per route, for the tab, for sharing, and for the built page files. */
export const ROUTE_TITLES: Record<Route | "home", { title: string; description: string }> = {
  home: {
    title: "Apex Chess: chess shifted 45°",
    description:
      "Apex Chess is chess on a board turned 45°, so each king starts in its own corner. Play the default setup or arrange your own, against a friend, the computer, or online.",
  },
  rules: {
    title: "Rules | Apex Chess",
    description:
      "The full rules of Apex Chess: the turned board, chords and rays, setups, Player's Choice, how each piece moves, and how a game ends.",
  },
  about: {
    title: "About | Apex Chess",
    description: "What Apex Chess is, where its source code lives, and how to get in touch.",
  },
  tournaments: {
    title: "Tournaments | Apex Chess",
    description: "Run a private Apex Chess tournament by link: round robin or Swiss, with clocks.",
  },
  stats: {
    title: "Statistics | Apex Chess",
    description: "How often each Apex Chess setup wins, from anonymous archived online games.",
  },
  leaderboard: {
    title: "Leaderboards | Apex Chess",
    description: "Opt-in Apex Chess leaderboards, one per rules version (beta).",
  },
  account: {
    title: "Account | Apex Chess",
    description: "Sign in to Apex Chess with a passkey and a handle. No email needed.",
  },
  privacy: {
    title: "Privacy | Apex Chess",
    description: "What Apex Chess stores, for how long, and what an account keeps.",
  },
  terms: {
    title: "Terms | Apex Chess",
    description: "The terms for playing Apex Chess at apexchess.icu.",
  },
};
