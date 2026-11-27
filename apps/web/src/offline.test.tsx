import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { catalog, resolveRuleset } from "@apexchess/engine";
import { Home } from "./Home";
import { registerServiceWorker } from "./offline";

const ruleset = resolveRuleset(catalog, "standard");
const home = (online?: boolean) =>
  renderToStaticMarkup(
    <Home
      ruleset={ruleset}
      onStart={() => undefined}
      onOpen={() => undefined}
      onEvents={() => undefined}
      onImport={() => undefined}
      online={online}
    />,
  );

describe("Home when offline", () => {
  it("online, nothing is disabled and nothing mentions a connection", () => {
    for (const html of [home(), home(true)]) {
      expect(html).not.toContain("disabled");
      expect(html).not.toContain("Needs a connection");
    }
  });
  it("offline, play online and the account pages are disabled and say why", () => {
    const html = home(false);
    expect(html).toContain("You are offline");
    expect(html.match(/Needs a connection/g)).toHaveLength(5);
    expect(html.match(/disabled=""/g)).toHaveLength(5);
  });
  it("offline, the computer and two-player options stay available", () => {
    const html = home(false);
    expect(html).toMatch(/<input[^>]*checked=""[^>]*value="computer"/);
    expect(html).not.toMatch(/disabled=""[^>]*value="(computer|hotseat)"/);
  });
});

describe("registerServiceWorker", () => {
  const nav = () => ({ serviceWorker: { register: vi.fn(() => Promise.resolve()) } });
  it("registers /sw.js in production", () => {
    const n = nav();
    registerServiceWorker(n as unknown as Navigator, true);
    expect(n.serviceWorker.register).toHaveBeenCalledWith("/sw.js");
  });
  it("does nothing in development or without worker support", () => {
    const n = nav();
    registerServiceWorker(n as unknown as Navigator, false);
    expect(n.serviceWorker.register).not.toHaveBeenCalled();
    expect(() => registerServiceWorker({} as Navigator, true)).not.toThrow();
    expect(() => registerServiceWorker(undefined, true)).not.toThrow();
  });
  it("swallows a failed registration", async () => {
    const n = { serviceWorker: { register: vi.fn(() => Promise.reject(new Error("no"))) } };
    registerServiceWorker(n as unknown as Navigator, true);
    await Promise.resolve();
  });
});
