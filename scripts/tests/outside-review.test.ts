import { describe, expect, it } from "vitest";
// @ts-expect-error untyped .mjs module
import {
  buildMessages,
  parseArgs,
  readStream,
  reportPath,
  DEFAULT_MODELS,
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
});
