import { describe, expect, it } from 'vitest';
import { forEachSelectedCell, formatCellValue, selectionLabel } from './cell-utils';

const selection = { anchor: { row: 3, column: 2 }, active: { row: 1, column: 1 } };

describe('Sheets selection and cell display', () => {
  it('normalizes range labels and enforces bounded bulk actions', () => {
    expect(selectionLabel(selection)).toBe('A1:B3');
    let count = 0;
    forEachSelectedCell(selection, () => { count += 1; });
    expect(count).toBe(6);
    expect(() => forEachSelectedCell(selection, () => undefined, 5)).toThrow('limited');
  });

  it('formats numbers, currency, percentages, dates, and formula errors without changing raw values', () => {
    expect(formatCellValue(1234.5, { numberFormat: 'number' })).toBe('1,234.5');
    expect(formatCellValue(1200, { numberFormat: 'currency', currencyCode: 'USD' })).toBe('$1,200.00');
    expect(formatCellValue(0.125, { numberFormat: 'percent' })).toBe('12.5%');
    expect(formatCellValue('2026-11-02', { numberFormat: 'date' })).toBe('Nov 2, 2026');
    expect(formatCellValue(45292, { numberFormat: 'date' })).toBe('Jan 1, 2024');
    expect(formatCellValue({ type: 'error', code: '#DIV/0!' }, { numberFormat: 'currency' })).toBe('#DIV/0!');
  });
});
