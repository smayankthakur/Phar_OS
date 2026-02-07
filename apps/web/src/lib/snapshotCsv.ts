import Papa from "papaparse";

export const CSV_IMPORT_LIMIT = 2000;

export type CsvImportError = {
  idx: number;
  field: string;
  message: string;
};

export type CsvNormalizedRow = {
  idx: number;
  competitorName: string;
  price: number;
  capturedAt: Date;
};

export type CsvParseResult = {
  rows: CsvNormalizedRow[];
  errors: CsvImportError[];
  totalRows: number;
};

function parseCapturedAt(value: string | undefined) {
  if (!value || !value.trim()) return new Date();
  const raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T00:00:00Z`);
  }
  return new Date(raw);
}

function addError(errors: CsvImportError[], idx: number, field: string, message: string) {
  errors.push({ idx, field, message });
}

export function parseSnapshotCsv(csvText: string): CsvParseResult | { fatalError: string } {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  if (parsed.errors.length > 0) {
    return { fatalError: "Invalid CSV format" };
  }

  const headers = parsed.meta.fields ?? [];
  if (!headers.includes("competitor_name") || !headers.includes("price")) {
    return { fatalError: "Missing required headers: competitor_name and price" };
  }

  const totalRows = parsed.data.length;
  if (totalRows > CSV_IMPORT_LIMIT) {
    return { fatalError: `CSV exceeds row limit (${CSV_IMPORT_LIMIT})` };
  }

  const rows: CsvNormalizedRow[] = [];
  const errors: CsvImportError[] = [];

  parsed.data.forEach((raw, index) => {
    const idx = index + 2;
    const competitorName = (raw.competitor_name ?? "").trim();
    const priceRaw = (raw.price ?? "").trim();
    const capturedRaw = raw.captured_at;

    if (competitorName.length < 2) {
      addError(errors, idx, "competitor_name", "competitor_name must be at least 2 chars");
    }

    const price = Number(priceRaw);
    if (!priceRaw || !Number.isFinite(price) || price <= 0) {
      addError(errors, idx, "price", "price must be a number greater than 0");
    }

    const capturedAt = parseCapturedAt(capturedRaw);
    if (Number.isNaN(capturedAt.getTime())) {
      addError(errors, idx, "captured_at", "captured_at must be a valid date");
    }

    const hasRowErrors = errors.some((error) => error.idx === idx);
    if (!hasRowErrors) {
      rows.push({
        idx,
        competitorName,
        price,
        capturedAt,
      });
    }
  });

  return {
    rows,
    errors,
    totalRows,
  };
}
