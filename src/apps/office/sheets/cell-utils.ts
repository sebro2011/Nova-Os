import type { NovaLanguage } from '../../../types';
import { coordsToCellAddress } from '../core/spreadsheet-model/cell-address';
import { formulaDisplayValue, isFormulaError, type FormulaValue } from '../core/spreadsheet-model/formula-engine';
import type { CellFormat } from '../core/spreadsheet-model/workbook-model';

export interface CellPosition { row: number; column: number }
export interface CellSelection { anchor: CellPosition; active: CellPosition }
export interface CellRange { startRow: number; endRow: number; startColumn: number; endColumn: number }

export function normalizeSelection(selection: CellSelection): CellRange {
  return {
    startRow: Math.min(selection.anchor.row, selection.active.row),
    endRow: Math.max(selection.anchor.row, selection.active.row),
    startColumn: Math.min(selection.anchor.column, selection.active.column),
    endColumn: Math.max(selection.anchor.column, selection.active.column),
  };
}

export function selectionLabel(selection: CellSelection): string {
  const range = normalizeSelection(selection);
  const start = coordsToCellAddress(range.startRow, range.startColumn);
  const end = coordsToCellAddress(range.endRow, range.endColumn);
  return start === end ? start : `${start}:${end}`;
}

export function selectionSize(selection: CellSelection): number {
  const range = normalizeSelection(selection);
  return (range.endRow - range.startRow + 1) * (range.endColumn - range.startColumn + 1);
}

export function forEachSelectedCell(selection: CellSelection, callback: (row: number, column: number) => void, limit = 20_000): void {
  if (selectionSize(selection) > limit) throw new Error(`This action is limited to ${limit.toLocaleString('en-US')} cells.`);
  const range = normalizeSelection(selection);
  for (let row = range.startRow; row <= range.endRow; row += 1) {
    for (let column = range.startColumn; column <= range.endColumn; column += 1) callback(row, column);
  }
}

export function isCellSelected(selection: CellSelection, row: number, column: number): boolean {
  const range = normalizeSelection(selection);
  return row >= range.startRow && row <= range.endRow && column >= range.startColumn && column <= range.endColumn;
}

function dateForValue(value: FormulaValue): Date | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 2_958_465) {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(value * 86_400_000));
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value)) {
    const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function formatCellValue(value: FormulaValue, format: CellFormat | undefined, language: NovaLanguage = 'en'): string {
  if (value === null || isFormulaError(value)) return formulaDisplayValue(value);
  const numberFormat = format?.numberFormat ?? 'general';
  if (numberFormat === 'date') {
    const date = dateForValue(value);
    return date ? new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeZone: 'UTC' }).format(date) : formulaDisplayValue(value);
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || numberFormat === 'general' || numberFormat === 'text') return formulaDisplayValue(value);
  if (numberFormat === 'currency') {
    return new Intl.NumberFormat(language, { style: 'currency', currency: format?.currencyCode ?? 'LKR' }).format(value);
  }
  if (numberFormat === 'percent') return new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 2 }).format(value);
  return new Intl.NumberFormat(language, { maximumFractionDigits: 4 }).format(value);
}
