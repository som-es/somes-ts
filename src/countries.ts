export type EuCountryLocale = "de" | "en";

const EU_COUNTRY_NAMES: Record<string, Record<EuCountryLocale, string>> = {
  AUT: { de: "Österreich", en: "Austria" },
  BEL: { de: "Belgien", en: "Belgium" },
  BGR: { de: "Bulgarien", en: "Bulgaria" },
  CYP: { de: "Zypern", en: "Cyprus" },
  CZE: { de: "Tschechien", en: "Czechia" },
  DEU: { de: "Deutschland", en: "Germany" },
  DNK: { de: "Dänemark", en: "Denmark" },
  ESP: { de: "Spanien", en: "Spain" },
  EST: { de: "Estland", en: "Estonia" },
  FIN: { de: "Finnland", en: "Finland" },
  FRA: { de: "Frankreich", en: "France" },
  GRC: { de: "Griechenland", en: "Greece" },
  HRV: { de: "Kroatien", en: "Croatia" },
  HUN: { de: "Ungarn", en: "Hungary" },
  IRL: { de: "Irland", en: "Ireland" },
  ITA: { de: "Italien", en: "Italy" },
  LTU: { de: "Litauen", en: "Lithuania" },
  LUX: { de: "Luxemburg", en: "Luxembourg" },
  LVA: { de: "Lettland", en: "Latvia" },
  MLT: { de: "Malta", en: "Malta" },
  NLD: { de: "Niederlande", en: "Netherlands" },
  POL: { de: "Polen", en: "Poland" },
  PRT: { de: "Portugal", en: "Portugal" },
  ROU: { de: "Rumänien", en: "Romania" },
  SVK: { de: "Slowakei", en: "Slovakia" },
  SVN: { de: "Slowenien", en: "Slovenia" },
  SWE: { de: "Schweden", en: "Sweden" },
};

export const EU_COUNTRY_CODES: readonly string[] = Object.keys(EU_COUNTRY_NAMES);

/** Falls back to the raw code for unrecognised input, same as somes-frontend's `countryName`. */
export function euCountryName(alpha3Code: string, locale: EuCountryLocale = "en"): string {
  return EU_COUNTRY_NAMES[alpha3Code]?.[locale] ?? alpha3Code;
}
