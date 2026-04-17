import { describe, expect, it } from "vitest";
import { buildRoster } from "./roster.js";

describe("buildRoster", () => {
  it("is deterministic for same seed and theme", () => {
    const a = buildRoster("seed-abc", "cartoons");
    const b = buildRoster("seed-abc", "cartoons");
    expect(a).toEqual(b);
  });

  it("differs across themes with same seed", () => {
    const celeb = buildRoster("same", "celebrities");
    const gov = buildRoster("same", "government");
    expect(celeb[0]!.displayName).not.toEqual(gov[0]!.displayName);
  });

  it("uses Wikimedia portrait URLs for celebrities and government", () => {
    const celeb = buildRoster("portrait-seed", "celebrities");
    const gov = buildRoster("portrait-seed", "government");
    expect(celeb.every((c) => c.portraitUrl?.includes("wikimedia.org"))).toBe(true);
    expect(gov.every((c) => c.portraitUrl?.includes("wikimedia.org"))).toBe(true);
  });

  it("produces 24 characters", () => {
    expect(buildRoster("x", "celebrities")).toHaveLength(24);
  });
});
