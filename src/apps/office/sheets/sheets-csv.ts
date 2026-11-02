import { cellAddressToCoords, coordsToCellAddress } from '../core/spreadsheet-model/cell-address';
import { formulaDisplayValue, WorkbookFormulaEngine, type FormulaValue } from '../core/spreadsheet-model/formula-engine';
import { createWorkbookSheet, type SheetCell, type WorkbookSheet } from '../core/spreadsheet-model/workbook-model';
import { forEachSelectedCell, type CellPosition, type CellSelection } from './cell-utils';

export const MAX_DELIMITED_TEXT_CHARS = 2_000_000;
const MAX_IMPORT_ROWS = 500;
const MAX_IMPORT_COLUMNS = 52;
const MAX_IMPORT_CELLS = 20_000;

function pushField(row: string[], field: string): void {
  if (field.length > 20_000) throw new Error('A delimited cell exceeds the 20,000 character limit.');
  row.push(field);
}

/** Parses CSV/TSV with quoted delimiters, escaped quotes, and bounded dimensions. */
export function parseDelimited(text: string, delimiter: ',' | '\t' = ','): string[][] {
  if (text.length > MAX_DELIMITED_TEXT_CHARS) throw new Error('Delimited imports are limited to 2 million characters.');
  const input = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let cells = 0;

  const finishField = () => {
    pushField(row, field);
    cells += 1;
    if (cells > MAX_IMPORT_CELLS) throw new Error('Delimited imports are limited to 20,000 cells.');
    field = '';
  };
  const finishRow = () => {
    finishField();
    rows.push(row);
    if (rows.length > MAX_IMPORT_ROWS) throw new Error('Delimited imports are limited to 500 rows.');
    if (row.length > MAX_IMPORT_COLUMNS) throw new Error('Delimited imports are limited to 52 columns.');
    row = [];
  };

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') { field += '"'; index += 1; }
        else quoted = false;
      } else field += character;
      if (field.length > 20_000) throw new Error('A delimited cell exceeds the 20,000 character limit.');
      continue;
    }
    if (character === '"') {
      if (field) throw new Error('A quoted value must start at the beginning of a delimited cell.');
      quoted = true;
    } else if (character === delimiter) finishField();
    else if (character === '\n' || character === '\r') {
      if (character === '\r' && input[index + 1] === '\n') index += 1;
      finishRow();
    } else {
      field += character;
      if (field.length > 20_000) throw new Error('A delimited cell exceeds the 20,000 character limit.');
    }
  }
  if (quoted) throw new Error('The delimited file contains an unclosed quoted value.');
  if (field || row.length || !rows.length) finishRow();
  return rows;
}

function escapeRawField(value: string, delimiter: ',' | '\t'): string {
  if (value.includes('"') || value.includes(delimiter) || /[\r\n]/.test(value) || /^\s|\s$/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function serializeRows(rows: string[][], delimiter: ',' | '\t'): string {
  return rows.map((row) => row.map((value) => escapeRawField(value, delimiter)).join(delimiter)).join('\r\n');
}

function safeCsvValue(value: FormulaValue): string {
  const text = formulaDisplayValue(value);
  // CSV has no formula/type metadata. Escape dangerous text prefixes for external spreadsheets.
  return typeof value === 'string' && /^\s*[=+\-@]/.test(text) ? `'${text}` : text;
}

/** Exports the active sheet's evaluated used range, not executable formula source. */
export function sheetToCsv(sheet: WorkbookSheet, engine: WorkbookFormulaEngine): string {
  let maxRow = 0;
  let maxColumn = 0;
  for (const address of Object.keys(sheet.cells)) {
    const coords = cellAddressToCoords(address);
    maxRow = Math.max(maxRow, coords.row);
    maxColumn = Math.max(maxColumn, coords.column);
  }
  if (!maxRow || !maxColumn) return '';
  const rows: string[][] = [];
  for (let row = 1; row <= maxRow; row += 1) {
    const values: string[] = [];
    for (let column = 1; column <= maxColumn; column += 1) {
      values.push(escapeRawField(safeCsvValue(engine.getCell(sheet.id, coordsToCellAddress(row, column))), ','));
    }
    rows.push(values);
  }
  return rows.map((row) => row.join(',')).join('\r\n');
}

export function sheetFromCsv(text: string, name: string): WorkbookSheet {
  const rows = parseDelimited(text);
  const sheet = createWorkbookSheet(name.trim().slice(0, 60) || 'Imported CSV');
  sheet.rowCount = Math.max(sheet.rowCount, rows.length);
  sheet.columnCount = Math.max(sheet.columnCount, ...rows.map((row) => row.length));
  rows.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
    if (!value) return;
    sheet.cells[coordsToCellAddress(rowIndex + 1, columnIndex + 1)] = { value };
  }));
  return sheet;
}

export function selectionToClipboard(sheet: WorkbookSheet, selection: CellSelection): string {
  const rows: string[][] = [];
  let currentRow = -1;
  let values: string[] = [];
  forEachSelectedCell(selection, (row, column) => {
    if (row !== currentRow) {
      if (values.length) rows.push(values);
      values = [];
      currentRow = row;
    }
    values.push(sheet.cells[coordsToCellAddress(row, column)]?.value ?? '');
  });
  if (values.length) rows.push(values);
  return serializeRows(rows, '\t');
}

export function pasteIntoSheet(sheet: WorkbookSheet, text: string, position: CellPosition): WorkbookSheet {
  const rows = parseDelimited(text, '\t');
  if (rows.length * Math.max(0, ...rows.map((row) => row.length)) > 20_000) throw new Error('Clipboard paste is limited to 20,000 cells.');
  const cells: Record<string, SheetCell> = { ...sheet.cells };
  rows.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
    const rowNumber = position.row + rowIndex;
    const columnNumber = position.column + columnIndex;
    if (rowNumber > sheet.rowCount || columnNumber > sheet.columnCount) throw new Error('The pasted cells extend beyond this sheet. Insert rows or columns first.');
    const address = coordsToCellAddress(rowNumber, columnNumber);
    const format = cells[address]?.format;
    if (!value && !format) delete cells[address];
    else cells[address] = { value, ...(format ? { format } : {}) };
  }));
  if (Object.keys(cells).length > MAX_IMPORT_CELLS) throw new Error('Sheets are limited to 20,000 populated cells.');
  return { ...sheet, cells };
}
