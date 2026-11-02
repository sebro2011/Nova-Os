import { cellAddressToCoords, coordsToCellAddress, columnNumberToName } from './cell-address';
import { WorkbookFormulaEngine, formulaDisplayValue, isFormulaError } from './formula-engine';
import { createWorkbookSheet, validateWorkbookDocument, type SheetChart, type WorkbookDocument, type WorkbookSheet } from './workbook-model';

interface ReferenceChange {
  sheetId: string;
  axis: 'row' | 'column';
  position?: number;
  offset?: 1 | -1;
  map?: Record<number, number>;
  resize?: boolean;
}

function mappedCoordinate(value: number, change: ReferenceChange): number | null {
  if (change.map) return change.map[value] ?? value;
  if (change.offset === -1 && value === change.position) return null;
  if (change.position !== undefined && change.offset && value >= change.position) return value + change.offset;
  return value;
}

function mappedAddress(address: string, change: ReferenceChange): string | null {
  const coords = cellAddressToCoords(address);
  const next = mappedCoordinate(change.axis === 'row' ? coords.row : coords.column, change);
  if (next === null) return null;
  return coordsToCellAddress(change.axis === 'row' ? next : coords.row, change.axis === 'column' ? next : coords.column);
}

function formulaSheetName(prefix: string | undefined, currentSheet: string): string {
  if (!prefix) return currentSheet;
  const raw = prefix.slice(0, -1);
  return raw.startsWith("'") ? raw.slice(1, -1).replace(/''/g, "'") : raw;
}

function remapFormula(value: string, currentSheet: string, targetSheet: string, change: ReferenceChange): string {
  if (!value.startsWith('=')) return value;
  const strings: string[] = [];
  const protectedFormula = value.replace(/"(?:[^"]|"")*"/g, (text) => {
    strings.push(text);
    return `\uE000${strings.length - 1}\uE001`;
  });
  const reference = /(^|[^A-Za-z0-9_])((?:'(?:[^']|'')+'|[A-Za-z_][A-Za-z0-9_.]*)!)?(\$?)([A-Z]{1,2})(\$?)([1-9]\d{0,2})(?![A-Za-z0-9_])/g;
  const remapped = protectedFormula.replace(reference, (_match, leading: string, prefix: string | undefined, dollarColumn: string, column: string, dollarRow: string, row: string) => {
    if (formulaSheetName(prefix, currentSheet).toLocaleLowerCase() !== targetSheet.toLocaleLowerCase()) return _match;
    const oldValue = Number(change.axis === 'row' ? row : column);
    const nextValue = mappedCoordinate(oldValue, change);
    if (nextValue === null) return `${leading}#REF!`;
    const nextColumn = change.axis === 'column' ? columnNumberToName(nextValue) : column;
    const nextRow = change.axis === 'row' ? nextValue : Number(row);
    return `${leading}${prefix ?? ''}${dollarColumn}${nextColumn}${dollarRow}${nextRow}`;
  });
  return remapped
    .replace(/#REF!:\$?[A-Z]{1,2}\$?[1-9]\d{0,2}|\$?[A-Z]{1,2}\$?[1-9]\d{0,2}:#REF!/g, '#REF!')
    .replace(/\uE000(\d+)\uE001/g, (_match, index: string) => strings[Number(index)]);
}

function remapIndexRecord(record: Record<string, number>, change: ReferenceChange): Record<string, number> {
  const output: Record<string, number> = {};
  for (const [key, value] of Object.entries(record)) {
    const oldIndex = Number(change.axis === 'row' ? key : cellAddressToCoords(`${key}1`).column);
    const nextIndex = mappedCoordinate(oldIndex, change);
    if (nextIndex === null) continue;
    output[change.axis === 'row' ? String(nextIndex) : columnNumberToName(nextIndex)] = value;
  }
  return output;
}

function remapChart(chart: SheetChart, change: ReferenceChange): SheetChart | null {
  const startCell = mappedAddress(chart.startCell, change);
  const endCell = mappedAddress(chart.endCell, change);
  return startCell && endCell ? { ...chart, startCell, endCell } : null;
}

function remapWorkbook(workbook: WorkbookDocument, change: ReferenceChange): WorkbookDocument {
  const next = structuredClone(workbook);
  const target = next.sheets.find((sheet) => sheet.id === change.sheetId);
  const originalTarget = workbook.sheets.find((sheet) => sheet.id === change.sheetId);
  if (!target || !originalTarget) throw new Error('The selected sheet no longer exists.');
  const remappedCells: WorkbookSheet['cells'] = {};
  for (const [address, cell] of Object.entries(target.cells)) {
    const nextAddress = mappedAddress(address, change);
    if (nextAddress) remappedCells[nextAddress] = cell;
  }
  target.cells = remappedCells;
  if (change.axis === 'row') {
    target.rowHeights = remapIndexRecord(target.rowHeights, change);
    if (change.resize && change.offset) target.rowCount += change.offset;
  } else {
    target.columnWidths = remapIndexRecord(target.columnWidths, change);
    if (change.resize && change.offset) target.columnCount += change.offset;
  }
  target.charts = target.charts.map((chart) => remapChart(chart, change)).filter((chart): chart is SheetChart => chart !== null);
  for (const sheet of next.sheets) {
    for (const cell of Object.values(sheet.cells)) cell.value = remapFormula(cell.value, sheet.name, originalTarget.name, change);
  }
  return next;
}

export function insertWorkbookRow(workbook: WorkbookDocument, sheetId: string, position: number): WorkbookDocument {
  const sheet = workbook.sheets.find((item) => item.id === sheetId);
  if (!sheet || sheet.rowCount >= 500 || !Number.isInteger(position) || position < 1 || position > sheet.rowCount + 1) throw new Error('The row cannot be inserted within the bounded grid.');
  return remapWorkbook(workbook, { sheetId, axis: 'row', position, offset: 1, resize: true });
}

export function deleteWorkbookRow(workbook: WorkbookDocument, sheetId: string, position: number): WorkbookDocument {
  const sheet = workbook.sheets.find((item) => item.id === sheetId);
  if (!sheet || sheet.rowCount <= 1 || !Number.isInteger(position) || position < 1 || position > sheet.rowCount) throw new Error('The row cannot be deleted.');
  return remapWorkbook(workbook, { sheetId, axis: 'row', position, offset: -1, resize: true });
}

export function insertWorkbookColumn(workbook: WorkbookDocument, sheetId: string, position: number): WorkbookDocument {
  const sheet = workbook.sheets.find((item) => item.id === sheetId);
  if (!sheet || sheet.columnCount >= 52 || !Number.isInteger(position) || position < 1 || position > sheet.columnCount + 1) throw new Error('The column cannot be inserted within the bounded grid.');
  return remapWorkbook(workbook, { sheetId, axis: 'column', position, offset: 1, resize: true });
}

export function deleteWorkbookColumn(workbook: WorkbookDocument, sheetId: string, position: number): WorkbookDocument {
  const sheet = workbook.sheets.find((item) => item.id === sheetId);
  if (!sheet || sheet.columnCount <= 1 || !Number.isInteger(position) || position < 1 || position > sheet.columnCount) throw new Error('The column cannot be deleted.');
  return remapWorkbook(workbook, { sheetId, axis: 'column', position, offset: -1, resize: true });
}

export function sortWorkbookSheet(workbook: WorkbookDocument, sheetId: string, column: number, ascending: boolean, headerRows = 1): WorkbookDocument {
  const sheet = workbook.sheets.find((item) => item.id === sheetId);
  if (!sheet || column < 1 || column > sheet.columnCount || headerRows < 0 || headerRows > 5) throw new Error('The selected sort is invalid.');
  const populatedRows = Object.keys(sheet.cells).map((address) => cellAddressToCoords(address).row);
  const maxRow = Math.max(0, ...populatedRows);
  if (maxRow <= headerRows + 1) return structuredClone(workbook);
  const engine = new WorkbookFormulaEngine(workbook);
  const rows = Array.from({ length: maxRow - headerRows }, (_, index) => headerRows + index + 1);
  const valueFor = (row: number) => engine.getCell(sheet.id, coordsToCellAddress(row, column));
  rows.sort((left, right) => {
    const a = valueFor(left);
    const b = valueFor(right);
    let comparison: number;
    if (typeof a === 'number' && typeof b === 'number') comparison = a - b;
    else if (a === null && b !== null) comparison = 1;
    else if (b === null && a !== null) comparison = -1;
    else comparison = formulaDisplayValue(a).toLocaleLowerCase().localeCompare(formulaDisplayValue(b).toLocaleLowerCase());
    if (isFormulaError(a) || isFormulaError(b)) comparison = formulaDisplayValue(a).localeCompare(formulaDisplayValue(b));
    return comparison * (ascending ? 1 : -1) || left - right;
  });
  const map: Record<number, number> = {};
  rows.forEach((sourceRow, index) => { map[sourceRow] = headerRows + index + 1; });
  return remapWorkbook(workbook, { sheetId, axis: 'row', map });
}

export function addWorkbookSheet(workbook: WorkbookDocument): WorkbookDocument {
  if (workbook.sheets.length >= 20) throw new Error('Workbooks are limited to 20 sheets.');
  let index = workbook.sheets.length + 1;
  while (workbook.sheets.some((sheet) => sheet.name.toLocaleLowerCase() === `sheet ${index}`)) index += 1;
  const sheet = createWorkbookSheet(`Sheet ${index}`);
  return { sheets: [...workbook.sheets, sheet], activeSheetId: sheet.id };
}

function renameFormulaSheet(value: string, previousName: string, nextName: string): string {
  if (!value.startsWith('=')) return value;
  const strings: string[] = [];
  const protectedFormula = value.replace(/"(?:[^"]|"")*"/g, (text) => {
    strings.push(text);
    return `\uE000${strings.length - 1}\uE001`;
  });
  const nextPrefix = /^[A-Za-z_][A-Za-z0-9_.]*$/.test(nextName) ? `${nextName}!` : `'${nextName.replace(/'/g, "''")}'!`;
  const reference = /(^|[^A-Za-z0-9_])((?:'(?:[^']|'')+'|[A-Za-z_][A-Za-z0-9_.]*)!)(?=\$?[A-Z]{1,2}\$?[1-9]\d{0,2}(?![A-Za-z0-9_]))/g;
  return protectedFormula.replace(reference, (match, leading: string, prefix: string) => (
    formulaSheetName(prefix, '').toLocaleLowerCase() === previousName.toLocaleLowerCase() ? `${leading}${nextPrefix}` : match
  )).replace(/\uE000(\d+)\uE001/g, (_match, index: string) => strings[Number(index)]);
}

export function renameWorkbookSheet(workbook: WorkbookDocument, sheetId: string, name: string): WorkbookDocument {
  const trimmed = name.trim();
  const source = workbook.sheets.find((sheet) => sheet.id === sheetId);
  if (!source) throw new Error('The selected sheet no longer exists.');
  if (!trimmed || trimmed.length > 60 || workbook.sheets.some((sheet) => sheet.id !== sheetId && sheet.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) throw new Error('Sheet names must be unique and between 1 and 60 characters.');
  return {
    ...workbook,
    sheets: workbook.sheets.map((sheet) => ({
      ...(sheet.id === sheetId ? { ...sheet, name: trimmed } : sheet),
      cells: Object.fromEntries(Object.entries(sheet.cells).map(([address, cell]) => [address, { ...cell, value: renameFormulaSheet(cell.value, source.name, trimmed) }])),
    })),
  };
}

export function deleteWorkbookSheet(workbook: WorkbookDocument, sheetId: string): WorkbookDocument {
  if (workbook.sheets.length <= 1) throw new Error('A workbook must contain at least one sheet.');
  const sheets = workbook.sheets.filter((sheet) => sheet.id !== sheetId);
  if (sheets.length === workbook.sheets.length) return structuredClone(workbook);
  return { sheets, activeSheetId: workbook.activeSheetId === sheetId ? sheets[0].id : workbook.activeSheetId };
}

export function duplicateWorkbookSheet(workbook: WorkbookDocument, sheetId: string): WorkbookDocument {
  if (workbook.sheets.length >= 20) throw new Error('Workbooks are limited to 20 sheets.');
  const source = workbook.sheets.find((sheet) => sheet.id === sheetId);
  if (!source) throw new Error('The selected sheet no longer exists.');
  const copy = structuredClone(source);
  copy.id = createWorkbookSheet().id;
  let index = 2;
  const base = `${source.name} copy`;
  copy.name = base;
  while (workbook.sheets.some((sheet) => sheet.name.toLocaleLowerCase() === copy.name.toLocaleLowerCase())) copy.name = `${base} ${index++}`;
  copy.charts = copy.charts.map((chart) => ({ ...chart, id: createWorkbookSheet().id }));
  const sheets = [...workbook.sheets, copy];
  return validateWorkbookDocument({ sheets, activeSheetId: copy.id });
}
