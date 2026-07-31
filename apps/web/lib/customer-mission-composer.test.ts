import { describe, expect, it } from "vitest";
import { analyzeMissionPrompt, createMissionName } from "./customer-mission-composer";

describe("customer mission composer helpers", () => {
  it("keeps text-only input as the canonical description", () => {
    expect(analyzeMissionPrompt("We sell AI software for long-form video editing.")).toEqual({
      kind: "text",
      original: "We sell AI software for long-form video editing.",
    });
  });

  it("detects URL-only input without inventing a description", () => {
    expect(analyzeMissionPrompt("example.com")).toEqual({
      kind: "url_only",
      original: "example.com",
      websiteSuggestion: "https://example.com/",
    });
  });

  it("preserves text plus URL while suggesting the website separately", () => {
    expect(
      analyzeMissionPrompt(
        "We sell video-editing software for podcast agencies: https://example.com/pricing.",
      ),
    ).toEqual({
      kind: "text_with_url",
      original: "We sell video-editing software for podcast agencies: https://example.com/pricing.",
      websiteSuggestion: "https://example.com/pricing",
    });
  });

  it("creates a bounded readable mission name", () => {
    const name = createMissionName(
      "A very long description about a customer discovery product that should remain readable in recent history rows and never exceed the mission limit.",
    );
    expect(name).toContain("customer discovery");
    expect(name.length).toBeLessThanOrEqual(91);
  });
});
