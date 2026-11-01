import { createId } from '../../../../lib/utils';
import { cellAddressToCoords } from './cell-address';
import { officeArray, officeColor, officeId, officeNumber, officeRecord, officeText } from '../file-formats/validation';

export type NumberFormat = 'general' | 'number' | 'currency' | 'percent';
export interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  background?: string;
  color?: string;
  border?: boolean;
  numberFormat?: NumberFormat;
}

export interface SheetCell {
  value: string;
  format?: CellFormat;
}

export interface WorkbookSheet {
  id: string;
  name: string;
  rowCount: number;
  columnCount: number;
  cells: Record<string, SheetCell>;
  filter: string;
}

export interface WorkbookDocument {
  sheets: WorkbookSheet[];
  activeSheetId: string;
}

const numberFormats = new Set<NumberFormat>(['general', 'number', 'currency', 'percent']);
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
  return output;
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
    return { id, name, rowCount, columnCount, cells, filter: officeText(sheet.filter ?? '', 'Sheet filter', 200) };
  });
  if (!sheets.length) throw new Error('A workbook must contain at least one sheet.');
  const activeSheetId = officeId(input.activeSheetId, 'Active sheet ID');
  if (!ids.has(activeSheetId)) throw new Error('The active sheet does not exist.');
  return { sheets, activeSheetId };
}

export function createWorkbookSheet(name = 'Sheet 1'): WorkbookSheet {
  return { id: createId('sheet'), name, rowCount: 200, columnCount: 26, cells: {}, filter: '' };
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
