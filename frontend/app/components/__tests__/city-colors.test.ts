import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CITY_COLORS } from "../NawabActionsProvider";

/**
 * CITY_COLORS mirrors the `--city-color` values in globals.css `[data-city]`
 * blocks. Editing one and forgetting the other makes card accents disagree with
 * the page theme, which is invisible until someone switches cities. Fail here
 * instead.
 */
describe("CITY_COLORS", () => {
  const css = readFileSync(join(__dirname, "../../globals.css"), "utf8");

  it("matches the --city-color values in globals.css", () => {
    const fromCss: Record<string, string> = {};
    for (const block of css.matchAll(/\[data-city="([^"]+)"\]\s*\{([^}]*)\}/g)) {
      const [, city, body] = block;
      const hex = body.match(/--city-color:\s*(#[0-9A-Fa-f]{6})/)?.[1];
      if (hex) fromCss[city] = hex.toUpperCase();
    }

    expect(Object.keys(fromCss).length).toBeGreaterThan(0);

    const fromJs = Object.fromEntries(
      Object.entries(CITY_COLORS).map(([k, v]) => [k, v.toUpperCase()]),
    );
    expect(fromJs).toEqual(fromCss);
  });
});
