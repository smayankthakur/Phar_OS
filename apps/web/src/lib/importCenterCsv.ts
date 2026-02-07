import Papa from "papaparse";

export const BULK_IMPORT_LIMIT = 5000;

export type ImportErrorItem = {
  idx: number;
  field: string;
  message: string;
};

export type ParsedSkuRow = {
  idx: number;
  sku: string;
  title: string;
  cost: number;
  currentPrice: number;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
};

export type ParsedCompetitorRow = {
  idx: number;
  name: string;
  domain: string | null;
  currency: string;
};

export type ParsedSnapshotRow = {
  idx: number;
  sku: string;
  competitorName: string;
  price: number;
  capturedAt: Date;
};

export type ParseCsvResult<T> = {
  rows: T[];
  errors: ImportErrorItem[];
  totalRows: number;
};

type RawCsvParseResult =
  | {
      fatalError: string;
    }
  | {
      rows: Record<string, string>[];
      totalRows: number;
    };

function parseDate(raw: string | undefined): Date {
  if (!raw || !raw.trim()) return new Date();
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00Z`);
  }
  return new Date(value);
}

function parseCsvText(csvText: string, requiredHeaders: string[]): RawCsvParseResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  if (parsed.errors.length > 0) {
    return { fatalError: "Invalid CSV format" } as const;
  }

  const headers = parsed.meta.fields ?? [];
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    return { fatalError: `Missing required headers: ${missingHeaders.join(", ")}` } as const;
  }

  const totalRows = parsed.data.length;
  if (totalRows > BULK_IMPORT_LIMIT) {
    return { fatalError: `CSV exceeds row limit (${BULK_IMPORT_LIMIT})` } as const;
  }

  return {
    rows: parsed.data,
    totalRows,
  };
}

function hasRowErrors(errors: ImportErrorItem[], idx: number) {
  return errors.some((item) => item.idx === idx);
}

export function parseSkusCsv(csvText: string): ParseCsvResult<ParsedSkuRow> | { fatalError: string } {
  const parsed = parseCsvText(csvText, ["sku", "title", "cost", "current_price", "status"]);
  if ("fatalError" in parsed) return parsed;

  const rows: ParsedSkuRow[] = [];
  const errors: ImportErrorItem[] = [];

  parsed.rows.forEach((raw, i) => {
    const idx = i + 2;
    const sku = (raw.sku ?? "").trim();
    const title = (raw.title ?? "").trim();
    const cost = Number((raw.cost ?? "").trim());
    const currentPrice = Number((raw.current_price ?? "").trim());
    const status = ((raw.status ?? "ACTIVE").trim().toUpperCase() || "ACTIVE") as ParsedSkuRow["status"];

    if (sku.length < 2) errors.push({ idx, field: "sku", message: "sku must be at least 2 chars" });
    if (title.length < 2) errors.push({ idx, field: "title", message: "title must be at least 2 chars" });
    if (!Number.isFinite(cost) || cost <= 0) errors.push({ idx, field: "cost", message: "cost must be > 0" });
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      errors.push({ idx, field: "current_price", message: "current_price must be > 0" });
    }
    if (status !== "ACTIVE" && status !== "PAUSED" && status !== "ARCHIVED") {
      errors.push({ idx, field: "status", message: "status must be ACTIVE, PAUSED, or ARCHIVED" });
    }

    if (!hasRowErrors(errors, idx)) {
      rows.push({ idx, sku, title, cost, currentPrice, status });
    }
  });

  return { rows, errors, totalRows: parsed.totalRows };
}

const domainPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function parseCompetitorsCsv(csvText: string): ParseCsvResult<ParsedCompetitorRow> | { fatalError: string } {
  const parsed = parseCsvText(csvText, ["name"]);
  if ("fatalError" in parsed) return parsed;

  const rows: ParsedCompetitorRow[] = [];
  const errors: ImportErrorItem[] = [];

  parsed.rows.forEach((raw, i) => {
    const idx = i + 2;
    const name = (raw.name ?? "").trim();
    const domainRaw = (raw.domain ?? "").trim();
    const currency = ((raw.currency ?? "INR").trim().toUpperCase() || "INR");

    if (name.length < 2) errors.push({ idx, field: "name", message: "name must be at least 2 chars" });
    if (domainRaw && !domainPattern.test(domainRaw)) {
      errors.push({ idx, field: "domain", message: "domain format is invalid" });
    }
    if (currency.length !== 3) {
      errors.push({ idx, field: "currency", message: "currency must be 3 chars" });
    }

    if (!hasRowErrors(errors, idx)) {
      rows.push({
        idx,
        name,
        domain: domainRaw || null,
        currency,
      });
    }
  });

  return { rows, errors, totalRows: parsed.totalRows };
}

export function parseSnapshotsCsv(csvText: string): ParseCsvResult<ParsedSnapshotRow> | { fatalError: string } {
  const parsed = parseCsvText(csvText, ["sku", "competitor_name", "price"]);
  if ("fatalError" in parsed) return parsed;

  const rows: ParsedSnapshotRow[] = [];
  const errors: ImportErrorItem[] = [];

  parsed.rows.forEach((raw, i) => {
    const idx = i + 2;
    const sku = (raw.sku ?? "").trim();
    const competitorName = (raw.competitor_name ?? "").trim();
    const price = Number((raw.price ?? "").trim());
    const capturedAt = parseDate(raw.captured_at);

    if (sku.length < 2) errors.push({ idx, field: "sku", message: "sku must be at least 2 chars" });
    if (competitorName.length < 2) {
      errors.push({ idx, field: "competitor_name", message: "competitor_name must be at least 2 chars" });
    }
    if (!Number.isFinite(price) || price <= 0) {
      errors.push({ idx, field: "price", message: "price must be > 0" });
    }
    if (Number.isNaN(capturedAt.getTime())) {
      errors.push({ idx, field: "captured_at", message: "captured_at must be a valid date" });
    }

    if (!hasRowErrors(errors, idx)) {
      rows.push({ idx, sku, competitorName, price, capturedAt });
    }
  });

  return { rows, errors, totalRows: parsed.totalRows };
}
