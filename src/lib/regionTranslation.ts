const regionMap: Record<string, string> = {
  "Бразилия": "Brasil",
  "Европа": "Europa",
  "Северная Америка": "América do Norte",
  "Латинская Америка": "América Latina",
  "Азия": "Ásia",
  "Корея": "Coreia",
  "Япония": "Japão",
  "Океания": "Oceania",
  "Турция": "Turquia",
  "Россия": "Rússia",
};

export function translateRegion(phrase: string): string {
  for (const [ru, pt] of Object.entries(regionMap)) {
    if (phrase.includes(ru)) return phrase.replace(ru, pt);
  }
  return phrase;
}
