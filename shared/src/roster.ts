import { BOARD_SIZE } from "./constants.js";
import type { Character, ThemeId } from "./types.js";
import { hashStringToSeed, mulberry32, pickInt } from "./rng.js";
import { composeDisplayName } from "./names.js";
import { portraitForCharacter } from "./portraitCatalog.js";

export function buildRoster(rosterSeed: string, themeId: ThemeId): Character[] {
  const base = hashStringToSeed(rosterSeed);
  const out: Character[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    const seed = hashStringToSeed(`${rosterSeed}|${themeId}|${i}`) ^ (base + i * 2654435761);
    const rng = mulberry32(seed);
    // burn a few for variety (keeps cartoon name stream stable vs older builds)
    rng();
    rng();
    const portrait = portraitForCharacter(themeId, rosterSeed, i);
    const displayName = portrait
      ? portrait.displayName
      : composeDisplayName(themeId, seed ^ pickInt(rng, 1_000_000));
    out.push({
      id: `c-${i}`,
      index: i,
      themeId,
      seed,
      displayName,
      portraitUrl: portrait?.portraitUrl,
    });
  }
  return out;
}
