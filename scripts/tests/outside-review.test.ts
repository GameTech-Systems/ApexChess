import { describe, expect, it } from "vitest";
import {
  authHint,
  reviewOrder,
  buildMessages,
  parseArgs,
  provider,
  readStream,
  reportPath,
  shouldFallBack,
  DEFAULT_MODELS,
  FALLBACK_MODELS,
  // @ts-expect-error untyped .mjs module
} from "../outside-review.mjs";

describe("outside review", () => {
  it("reads flags and falls back to the default models", () => {
    expect(parseArgs([])).toEqual({
      models: DEFAULT_MODELS,
      since: null,
      focus: "",
      dryRun: false,
    });
    expect(
      parseArgs(["--model", "a/b,c/d", "--since", "v1", "--focus", "AI search", "--dry-run"]),
    ).toEqual({ models: ["a/b", "c/d"], since: "v1", focus: "AI search", dryRun: true });
  });

  it("names the report by date and model", () => {
    expect(reportPath("2026-11-20", "moonshotai/kimi-k3.1-pro")).toBe(
      "docs/reviews/2026-11-20-moonshotai-kimi-k3.1-pro.md",
    );
  });

  it("caps the material sent and says so", () => {
    const big = "x".repeat(500);
    const msgs = buildMessages({
      focus: "rules",
      files: [{ path: "a.ts", text: big }],
      diff: big,
      cap: 300,
    });
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain("Never invent rules");
    const user = msgs[1].content as string;
    expect(user).toContain("Focus: rules");
    expect(user.length).toBeLessThan(800);
    expect(user).toContain("[truncated]");
  });

  it("joins a streamed reply and reports a failed one", () => {
    const raw = [
      'data: {"choices":[{"delta":{"reasoning_content":"thinking"}}]}',
      'data: {"choices":[{"delta":{"content":"High: "}}]}',
      'data: {"choices":[{"delta":{"content":"bug"}}]}',
      "data: [DONE]",
    ].join("\n");
    expect(readStream(raw)).toBe("High: bug");
    expect(readStream(raw + '\ndata: {"choices":[{"del')).toBe("High: bug");
    expect(() => readStream("upstream request timeout")).toThrow("upstream request timeout");
  });

  it("sends openrouter: models to OpenRouter, free models only", () => {
    expect(provider("moonshotai/kimi-k3.1-pro")).toEqual({
      url: "https://integrate.api.nvidia.com/v1/chat/completions",
      model: "moonshotai/kimi-k3.1-pro",
      envKey: "NVIDIA_API_KEY",
    });
    expect(provider("openrouter:google/gemma-4-31b-it:free")).toEqual({
      url: "https://openrouter.ai/api/v1/chat/completions",
      model: "google/gemma-4-31b-it:free",
      envKey: "OPENROUTER_API_KEY",
    });
    expect(() => provider("openrouter:openai/gpt-6-luna")).toThrow(":free");
    expect(
      FALLBACK_MODELS.every((m: string) => m.startsWith("openrouter:") && m.endsWith(":free")),
    ).toBe(true);
  });

  it("falls back to OpenRouter only when every model hit a limit", () => {
    expect(shouldFallBack([new Error("429 Too Many Requests")])).toBe(true);
    expect(shouldFallBack([new Error("daily quota exceeded"), new Error("rate limit")])).toBe(true);
    expect(shouldFallBack([new Error("429"), new Error("upstream request timeout")])).toBe(false);
    expect(shouldFallBack([])).toBe(false);
  });
  it("puts code before tests, docs and rules data, so a cut diff keeps the code", () => {
    expect(
      reviewOrder([
        "README.md",
        "rules/rulesets/standard-1.0.0.json",
        "docs/HANDOFF.md",
        "apps/web/src/share.ts",
        "packages/online/src/room.test.ts",
        "scripts/smoke.mjs",
        "packages/online/src/room.ts",
        "apps/server/src/worker.ts",
      ]),
    ).toEqual([
      "apps/server/src/worker.ts",
      "packages/online/src/room.ts",
      "apps/web/src/share.ts",
      "scripts/smoke.mjs",
      "packages/online/src/room.test.ts",
      "docs/HANDOFF.md",
      "README.md",
      "rules/rulesets/standard-1.0.0.json",
    ]);
  });
  it("names the missing key on a 401, and stays quiet on other errors", () => {
    expect(authHint("nvidia/x", '{"status":401,"title":"Unauthorized"}')).toContain(
      "NVIDIA_API_KEY",
    );
    expect(authHint("openrouter:a/b:free", "Missing Authentication header")).toContain(
      "OPENROUTER_API_KEY",
    );
    expect(authHint("nvidia/x", "429 Too Many Requests")).toBe("");
  });
});
