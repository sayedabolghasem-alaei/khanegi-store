// Pure CSV utilities (RFC 4180) — encoding for Persian-safe exports and
// decoding for the bulk product import. SERVER-SIDE but dependency-free and
// fully pure (no Next/DB imports) so it is trivially testable.
//
// Conventions:
// - Every produced document starts with a UTF-8 BOM (\uFEFF) so Microsoft
//   Excel detects UTF-8 and renders Persian text correctly.
// - Line endings are CRLF ("\r\n") per RFC 4180.
// - Fields containing commas, quotes or newlines are quoted; embedded quotes
//   are escaped by doubling them ("").

export const CSV_BOM = "\uFEFF";
export const CSV_EOL = "\r\n";

/** A single CSV cell value (booleans are stringified as "true"/"false"). */
export type CsvCell = string | number | boolean | null | undefined;

/** Escapes a single CSV field per RFC 4180. */
export function csvEscape(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  const s =
    typeof value === "boolean"
      ? value
        ? "true"
        : "false"
      : typeof value === "number"
        ? String(value)
        : value;
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Renders ONE data row as a CRLF-terminated CSV line (no BOM). */
export function toCsvRow(row: CsvCell[]): string {
  return row.map(csvEscape).join(",") + CSV_EOL;
}

/**
 * Full CSV document: UTF-8 BOM + header row + data rows (CRLF line endings).
 * `toCsv(headers, rows)` is the canonical export used by small payloads
 * (templates); large exports stream via `csvChunks`.
 */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  return CSV_BOM + toCsvRow(headers) + rows.map(toCsvRow).join("");
}

/**
 * Chunked generator for streaming large exports — yields the BOM+header line
 * first, then blocks of `chunkRows` data rows per yield.
 */
export function* csvChunks(
  headers: string[],
  rows: CsvCell[][],
  chunkRows = 500
): Generator<string> {
  yield CSV_BOM + toCsvRow(headers);
  for (let i = 0; i < rows.length; i += chunkRows) {
    yield rows.slice(i, i + chunkRows).map(toCsvRow).join("");
  }
}

/**
 * RFC 4180 parser: handles quoted fields, escaped "" quotes, CRLF/LF/CR line
 * endings and a leading BOM. Blank trailing lines are dropped. Returns an
 * array of rows (each an array of string fields); the header row is included
 * as the first element when present.
 */
export function parseCsv(text: string): string[][] {
  const src = text.startsWith(CSV_BOM) ? text.slice(CSV_BOM.length) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
    } else if (ch === ",") {
      pushField();
      i += 1;
    } else if (ch === "\r") {
      pushRow();
      i += 1;
      if (src[i] === "\n") i += 1;
    } else if (ch === "\n") {
      pushRow();
      i += 1;
    } else {
      field += ch;
      i += 1;
    }
  }
  // Flush the final unterminated field/row (file not ending with newline).
  if (field !== "" || row.length > 0) pushRow();

  // Drop fully-empty lines (trailing newline artifacts).
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}
