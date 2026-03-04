type RowLike = Record<string, unknown>;

const FACTORY_LABEL_TO_ID: Record<string, number> = {
  TS: 1,
  TL: 2,
  KK: 3,
};

const parseFactoryText = (raw: string): number | null => {
  const upper = raw.trim().toUpperCase();
  if (!upper) return null;

  if (FACTORY_LABEL_TO_ID[upper] !== undefined) {
    return FACTORY_LABEL_TO_ID[upper];
  }

  // Handles labels like "TS - ...", "Factory: TL", etc.
  if (upper.includes("TS")) return 1;
  if (upper.includes("TL")) return 2;
  if (upper.includes("KK")) return 3;

  const numeric = Number(upper);
  if (Number.isFinite(numeric)) return numeric;

  return null;
};

export const getFactoryIdFromRow = (row: RowLike): number | null => {
  const candidates = [row.FactoryId, row.factoryId, row.Factory, row.factory];
  for (const candidate of candidates) {
    const parsed = parseFactoryText(String(candidate ?? ""));
    if (parsed !== null) return parsed;
  }
  return null;
};

export const matchesFactory = (row: RowLike, factoryId: number): boolean =>
  getFactoryIdFromRow(row) === factoryId;

export const factoryLabelFromRow = (row: RowLike): string => {
  const id = getFactoryIdFromRow(row);
  if (id === 1) return "TS";
  if (id === 2) return "TL";
  if (id === 3) return "KK";
  return "Unspecified";
};
