const arabicDigits = "٠١٢٣٤٥٦٧٨٩";

export const standardSchoolLevels = [
  "1AP",
  "2AP",
  "3AP",
  "4AP",
  "5AP",
  "1AM",
  "2AM",
  "3AM",
  "4AM",
  "1AS",
  "2AS",
  "3AS",
];

export function schoolLevelLabel(level: string) {
  const label = level.trim().replace(/\s+/g, " ");
  const key = label
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)))
    .toLowerCase();
  const match =
    /^(?:السنة )?([1-5])(?:\s*(?:ere|er|eme|e))?\s*(?:annee\s+)?(ap|am|as|primaire|moyenne?|secondaire|ابتدائي|متوسط|ثانوي)$/.exec(
      key,
    );
  if (!match) return label;
  const [, year, cycle] = match;
  if (["ap", "primaire", "ابتدائي"].includes(cycle)) return year + "AP";
  if (["am", "moyen", "moyenne", "متوسط"].includes(cycle) && Number(year) <= 4)
    return year + "AM";
  if (["as", "secondaire", "ثانوي"].includes(cycle) && Number(year) <= 3)
    return year + "AS";
  return label;
}

export function schoolLevelOptions(levels: string[], locale: "fr" | "ar") {
  const labels = new Map<string, string>();
  for (const level of levels) {
    const label = schoolLevelLabel(level);
    if (label) labels.set(label.toLowerCase(), label);
  }
  return labels.size
    ? [...labels.values()].sort((a, b) =>
        a.localeCompare(b, locale, { numeric: true }),
      )
    : standardSchoolLevels;
}
