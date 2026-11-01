import { createId } from '../../../../lib/utils';
import { cellAddressToCoords } from './cell-address';
import { officeArray, officeColor, officeId, officeNumber, officeRecord, officeText } from '../file-formats/validation';

export type NumberFormat = 'general' | 'number' | 'currency' | 'percent' | 'date' | 'text';
export type CurrencyCode = 'LKR' | 'USD' | 'EUR' | 'GBP' | 'INR';
export interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  background?: string;
  color?: string;
  border?: boolean;
  numberFormat?: NumberFormat;
  currencyCode?: CurrencyCode;
}

export interface SheetCell {
  value: string;
  format?: CellFormat;
}

export interface SheetChart {
  id: string;
  type: 'bar' | 'line' | 'pie';
  title: string;
  startCell: string;
  endCell: string;
}

export interface WorkbookSheet {
  id: string;
  name: string;
  rowCount: number;
  columnCount: number;
  cells: Record<string, SheetCell>;
  filter: string;
  columnWidths: Record<string, number>;
  rowHeights: Record<string, number>;
  charts: SheetChart[];
}

export interface WorkbookDocument {
  sheets: WorkbookSheet[];
  activeSheetId: string;
}

const numberFormats = new Set<NumberFormat>(['general', 'number', 'currency', 'percent', 'date', 'text']);
const currencyCodes = new Set<CurrencyCode>(['LKR', 'USD', 'EUR', 'GBP', 'INR']);
const alignments = new Set(['left', 'center', 'right']);

function validateCellFormat(value: unknown): CellFormat | undefined {
  if (value === undefined) return undefined;
  const input = officeRecord(value, 'Cell format');
  const output: CellFormat = {};
  if (input.bold !== undefined) output.bold = input.bold === true;
  if (input.italic !== undefined) output.italic = input.italic === true;
  if (input.border !== undefined) output.border = input.border === true;
  if (input.align !== undefined) {
    if (typeof input.align !== 'string' || !alignments.has(input.align)) throw new Error('Invalid cell alignment.');
    output.align = input.align as CellFormat['align'];
  }
  if (input.background !== undefined) output.background = officeColor(input.background, 'Cell background');
  if (input.color !== undefined) output.color = officeColor(input.color, 'Cell text color');
  if (input.numberFormat !== undefined) {
    if (typeof input.numberFormat !== 'string' || !numberFormats.has(input.numberFormat as NumberFormat)) throw new Error('Invalid number format.');
    output.numberFormat = input.numberFormat as NumberFormat;
  }
  if (input.currencyCode !== undefined) {
    if (typeof input.currencyCode !== 'string' || !currencyCodes.has(input.currencyCode as CurrencyCode)) throw new Error('Invalid currency code.');
    output.currencyCode = input.currencyCode as CurrencyCode;
  }
  return output;
}

function validateColumnWidths(value: unknown, columnCount: number): Record<string, number> {
  const entries = Object.entries(officeRecord(value ?? {}, 'Column widths'));
  if (entries.length > 52) throw new Error('Too many custom column widths.');
  const output: Record<string, number> = {};
  for (const [column, width] of entries) {
    if (!/^[A-Z]{1,2}$/.test(column) || cellAddressToCoords(`${column}1`).column > columnCount) throw new Error('Invalid custom column width.');
    const value = officeNumber(width, 'Column width', 40, 320);
    if (!Number.isInteger(value)) throw new Error('Column widths must be whole pixels.');
    output[column] = value;
  }
  return output;
}

function validateRowHeights(value: unknown, rowCount: number): Record<string, number> {
  const entries = Object.entries(officeRecord(value ?? {}, 'Row heights'));
  if (entries.length > 500) throw new Error('Too many custom row heights.');
  const output: Record<string, number> = {};
  for (const [row, height] of entries) {
    if (!/^[1-9]\d{0,2}$/.test(row) || Number(row) > rowCount) throw new Error('Invalid custom row height.');
    const value = officeNumber(height, 'Row height', 20, 160);
    if (!Number.isInteger(value)) throw new Error('Row heights must be whole pixels.');
    output[row] = value;
  }
  return output;
}

function validateCharts(value: unknown, rowCount: number, columnCount: number): SheetChart[] {
  return officeArray(value ?? [], 'Sheet charts', 10).map((item): SheetChart => {
    const chart = officeRecord(item, 'Chart');
    const type = officeText(chart.type, 'Chart type', 10, false);
    if (!['bar', 'line', 'pie'].includes(type)) throw new Error('Unsupported chart type.');
    const startCell = officeText(chart.startCell, 'Chart start cell', 7, false).toUpperCase();
    const endCell = officeText(chart.endCell, 'Chart end cell', 7, false).toUpperCase();
    const start = cellAddressToCoords(startCell);
    const end = cellAddressToCoords(endCell);
    if (start.row > rowCount || end.row > rowCount || start.column > columnCount || end.column > columnCount) throw new Error('Chart range is outside the sheet.');
    const rows = Math.abs(start.row - end.row) + 1;
    const columns = Math.abs(start.column - end.column) + 1;
    if (rows * columns > 200) throw new Error('Chart ranges are limited to 200 cells.');
    return { id: officeId(chart.id, 'Chart ID'), type: type as SheetChart['type'], title: officeText(chart.title, 'Chart title', 120), startCell, endCell };
  });
}

export function validateWorkbookDocument(value: unknown): WorkbookDocument {
  const input = officeRecord(value, 'Workbook');
  const ids = new Set<string>();
  const names = new Set<string>();
  const sheets = officeArray(input.sheets, 'Workbook sheets', 20).map((item, index): WorkbookSheet => {
    const sheet = officeRecord(item, `Sheet ${index + 1}`);
    const id = officeId(sheet.id, `Sheet ${index + 1} ID`);
    if (ids.has(id)) throw new Error('Workbook contains duplicate sheet IDs.');
    ids.add(id);
    const name = officeText(sheet.name, `Sheet ${index + 1} name`, 60, false).trim();
    if (names.has(name.toLowerCase())) throw new Error('Workbook sheet names must be unique.');
    names.add(name.toLowerCase());
    const rowCount = officeNumber(sheet.rowCount ?? 200, 'Sheet row count', 1, 500);
    const columnCount = officeNumber(sheet.columnCount ?? 26, 'Sheet column count', 1, 52);
    if (!Number.isInteger(rowCount) || !Number.isInteger(columnCount)) throw new Error('Sheet dimensions must be whole numbers.');
    const cellsInput = officeRecord(sheet.cells ?? {}, 'Sheet cells');
    const entries = Object.entries(cellsInput);
    if (entries.length > 20_000) throw new Error('Sheets are limited to 20,000 populated cells.');
    let characters = 0;
    const cells: Record<string, SheetCell> = {};
    for (const [address, cellValue] of entries) {
      const coords = cellAddressToCoords(address);
      if (coords.row > rowCount || coords.column > columnCount) throw new Error(`Cell ${address} is outside the sheet dimensions.`);
      const cell = officeRecord(cellValue, `Cell ${address}`);
      const cellText = officeText(cell.value, `Cell ${address} value`, 20_000);
      if (cellText.startsWith('=') && cellText.length > 2_000) throw new Error(`Formula in ${address} is too long.`);
      characters += cellText.length;
      if (characters > 2_000_000) throw new Error('Sheets are limited to 2 million populated characters.');
      const format = validateCellFormat(cell.format);
      cells[address] = { value: cellText, ...(format ? { format } : {}) };
    }
    return {
      id, name, rowCount, columnCount, cells,
      filter: officeText(sheet.filter ?? '', 'Sheet filter', 200),
      columnWidths: validateColumnWidths(sheet.columnWidths, columnCount),
      rowHeights: validateRowHeights(sheet.rowHeights, rowCount),
      charts: validateCharts(sheet.charts, rowCount, columnCount),
    };
  });
  if (!sheets.length) throw new Error('A workbook must contain at least one sheet.');
  const activeSheetId = officeId(input.activeSheetId, 'Active sheet ID');
  if (!ids.has(activeSheetId)) throw new Error('The active sheet does not exist.');
  return { sheets, activeSheetId };
}

export function createWorkbookSheet(name = 'Sheet 1'): WorkbookSheet {
  return { id: createId('sheet'), name, rowCount: 200, columnCount: 26, cells: {}, filter: '', columnWidths: {}, rowHeights: {}, charts: [] };
}

export function createWorkbookDocument(template: 'blank' | 'budget' = 'blank'): WorkbookDocument {
  const sheet = createWorkbookSheet(template === 'budget' ? 'Budget' : 'Sheet 1');
  if (template === 'budget') {
    sheet.cells = {
      A1: { value: 'Category', format: { bold: true, background: '#dbeafe' } },
      B1: { value: 'Amount', format: { bold: true, background: '#dbeafe' } },
      A2: { value: 'Housing' }, B2: { value: '1200', format: { numberFormat: 'currency' } },
      A3: { value: 'Food' }, B3: { value: '450', format: { numberFormat: 'currency' } },
      A4: { value: 'Transport' }, B4: { value: '180', format: { numberFormat: 'currency' } },
      A5: { value: 'Total', format: { bold: true } }, B5: { value: '=SUM(B2:B4)', format: { bold: true, numberFormat: 'currency' } },
    };
  }
  return { sheets: [sheet], activeSheetId: sheet.id };
}
