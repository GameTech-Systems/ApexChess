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

/** Page title and description per route, for the tab and for sharing. */
export const ROUTE_TITLES: Record<Route | "home", { title: string; description?: string }> = {
  home: { title: "Apex Chess: chess shifted 45°" },
  rules: {
    title: "Rules | Apex Chess",
    description:
      "The full rules of Apex Chess: the turned board, chords and rays, setups, Player's Choice, how each piece moves, and how a game ends.",
  },
  about: { title: "About | Apex Chess" },
  tournaments: { title: "Tournaments | Apex Chess" },
  stats: { title: "Statistics | Apex Chess" },
  leaderboard: { title: "Leaderboards | Apex Chess" },
  account: { title: "Account | Apex Chess" },
  privacy: { title: "Privacy | Apex Chess" },
  terms: { title: "Terms | Apex Chess" },
};
