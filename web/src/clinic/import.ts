import type { ClinicServiceInput, ServiceAvailability } from './data';

/**
 * CSV parsing and validation for CA-11's service import.
 *
 * The file is read and checked in the browser; nothing is uploaded anywhere.
 * Ready rows are then written through the same clinic-scoped insert CA-04 uses,
 * so the policies on clinic_services still decide what lands and which clinic
 * it lands in.
 */

/** Also the header CA-11 writes when it exports the catalogue. */
export const SERVICE_IMPORT_COLUMNS = [
  'Service name',
  'Category',
  'Description',
  'Price',
  'Duration (minutes)',
  'Availability',
] as const;

export const MAX_IMPORT_ROWS = 500;

const AVAILABILITY: ServiceAvailability[] = ['available', 'limited', 'unavailable'];

export type CsvRecord = { line: number; cells: string[] };

const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const nameKey = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Quotes, doubled quotes and newlines inside quoted cells follow RFC 4180, so a
 * description with a comma survives a round trip through the export.
 */
export function parseCsv(text: string): CsvRecord[] {
  const source = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const records: CsvRecord[] = [];

  let cells: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;
  let begun = false;

  const pushField = () => {
    cells.push(field);
    field = '';
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (!begun) {
      recordLine = line;
      begun = true;
    }

    if (inQuotes) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        if (character === '\n') line += 1;
        field += character;
      }
      continue;
    }

    if (character === '"' && field === '') {
      inQuotes = true;
    } else if (character === ',') {
      pushField();
    } else if (character === '\n') {
      pushField();
      records.push({ line: recordLine, cells });
      cells = [];
      begun = false;
      line += 1;
    } else {
      field += character;
    }
  }

  if (begun) {
    pushField();
    records.push({ line: recordLine, cells });
  }

  return records.filter((record) => record.cells.some((cell) => cell.trim() !== ''));
}

const COLUMN_ALIASES = {
  name: ['servicename', 'service', 'name'],
  category: ['category'],
  description: ['description', 'details'],
  price: ['price', 'fee'],
  duration: ['durationminutes', 'duration', 'minutes', 'estimatedduration'],
  availability: ['availability', 'status'],
} as const;

type ColumnKey = keyof typeof COLUMN_ALIASES;

export type ServiceImportRow = {
  /** 1-based line in the uploaded file, so an issue points at the right row. */
  line: number;
  name: string;
  category: string | null;
  description: string | null;
  price: number | null;
  duration: number | null;
  availability: ServiceAvailability | null;
  issues: string[];
};

export type ServiceImportPlan = {
  rows: ServiceImportRow[];
  ready: number;
  problem: number;
  /** A problem with the file itself; when set, no row can be imported. */
  error: string | null;
};

/** Empty cells fall back to the column defaults the table defines. */
function parseMoney(value: string): number | null {
  if (!value) return 0;
  const amount = Number(value.replace(/[₱,\s]/g, ''));
  if (!Number.isFinite(amount) || amount < 0 || amount > 99_999_999.99) return null;
  return Math.round(amount * 100) / 100;
}

function parseDuration(value: string): number | null {
  if (!value) return 30;
  const minutes = Number(value);
  return Number.isInteger(minutes) && minutes > 0 ? minutes : null;
}

/**
 * `existingNames` are the clinic's current services: the unique index is on
 * (clinic_id, lower(service_name)), so a repeated name is refused here rather
 * than as a constraint error from the database.
 */
export function buildServiceImport(text: string, existingNames: string[]): ServiceImportPlan {
  const records = parseCsv(text);
  const empty: ServiceImportPlan = { rows: [], ready: 0, problem: 0, error: null };

  if (!records.length) return { ...empty, error: 'That file is empty.' };

  const header = records[0].cells.map(normalizeHeader);
  const columns: Partial<Record<ColumnKey, number>> = {};
  (Object.keys(COLUMN_ALIASES) as ColumnKey[]).forEach((key) => {
    const at = header.findIndex((cell) => (COLUMN_ALIASES[key] as readonly string[]).includes(cell));
    if (at >= 0) columns[key] = at;
  });

  if (columns.name === undefined) {
    return {
      ...empty,
      error: 'The first row must name the columns and needs at least a “Service name” column.',
    };
  }

  const body = records.slice(1);
  if (!body.length) return { ...empty, error: 'That file has a header row but no services.' };
  if (body.length > MAX_IMPORT_ROWS) {
    return {
      ...empty,
      error: `That file has ${body.length} rows. Import up to ${MAX_IMPORT_ROWS} services at a time.`,
    };
  }

  const taken = new Set(existingNames.map(nameKey));
  const seen = new Map<string, number>();

  const rows = body.map<ServiceImportRow>((record) => {
    const cell = (key: ColumnKey) => {
      const at = columns[key];
      return at === undefined ? '' : (record.cells[at] ?? '').trim();
    };

    const name = cell('name');
    const issues: string[] = [];

    if (!name) issues.push('Service name is required.');
    else if (name.length > 120) issues.push('Service names must be 120 characters or fewer.');

    const price = parseMoney(cell('price'));
    if (price === null) issues.push('Price must be a number between 0 and 99,999,999.99.');

    const duration = parseDuration(cell('duration'));
    if (duration === null) issues.push('Duration must be a whole number of minutes above 0.');

    const availabilityText = cell('availability').toLowerCase();
    const availability: ServiceAvailability | null = availabilityText
      ? (AVAILABILITY.find((option) => option === availabilityText) ?? null)
      : 'available';
    if (!availability) {
      issues.push('Availability must be available, limited or unavailable.');
    }

    const key = nameKey(name);
    if (key) {
      if (taken.has(key)) {
        issues.push('This clinic already has a service with that name.');
      } else {
        const first = seen.get(key);
        if (first === undefined) seen.set(key, record.line);
        else issues.push(`The same name appears on line ${first} of this file.`);
      }
    }

    return {
      line: record.line,
      name: name || '(no name)',
      category: cell('category') || null,
      description: cell('description') || null,
      price,
      duration,
      availability,
      issues,
    };
  });

  return {
    rows,
    ready: rows.filter((row) => row.issues.length === 0).length,
    problem: rows.filter((row) => row.issues.length > 0).length,
    error: null,
  };
}

/** Null while the row still has an issue; see `issues`. */
export function toServiceInput(row: ServiceImportRow): ClinicServiceInput | null {
  if (row.issues.length || row.price === null || row.duration === null || !row.availability) {
    return null;
  }
  return {
    service_name: row.name,
    category: row.category,
    description: row.description,
    price: row.price,
    estimated_duration: row.duration,
    availability: row.availability,
  };
}
