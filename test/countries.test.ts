import { describe, expect, it } from "vitest";
import { EU_COUNTRY_CODES, euCountryName } from "../src/countries";

describe("countries", () => {
  it("lists all 27 EU member states", () => {
    expect(EU_COUNTRY_CODES).toHaveLength(27);
  });

  it("returns the English name by default", () => {
    expect(euCountryName("DEU")).toBe("Germany");
  });

  it("returns the requested locale's name", () => {
    expect(euCountryName("DEU", "de")).toBe("Deutschland");
    expect(euCountryName("DEU", "en")).toBe("Germany");
  });

  it("falls back to the raw code for an unknown country", () => {
    expect(euCountryName("XXX")).toBe("XXX");
    expect(euCountryName("XXX", "de")).toBe("XXX");
  });
});
