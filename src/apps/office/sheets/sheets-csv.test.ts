import { describe, expect, it } from 'vitest';
import { WorkbookFormulaEngine } from '../core/spreadsheet-model/formula-engine';
import { createWorkbookDocument, createWorkbookSheet } from '../core/spreadsheet-model/workbook-model';
import { parseDelimited, pasteIntoSheet, selectionToClipboard, sheetFromCsv, sheetToCsv } from './sheets-csv';

describe('Sheets CSV and clipboard compatibility', () => {
  it('parses quoted delimiters, escaped quotes, CRLF, and formulas into a bounded new sheet', () => {
    const sheet = sheetFromCsv('Name,Note,Total\r\n"Alpha, one","said ""hello""",10\r\nBeta,plain,=SUM(C2:C2)\r\n', 'Imported');
    expect(sheet.name).toBe('Imported');
    expect(sheet.cells.A2.value).toBe('Alpha, one');
    expect(sheet.cells.B2.value).toBe('said "hello"');
    expect(sheet.cells.C3.value).toBe('=SUM(C2:C2)');
    expect(parseDelimited('"a\tb"\r\n"c""d"')).toEqual([['a\tb'], ['c"d']]);
    expect(() => parseDelimited(`"${'x'.repeat(20)}`)).toThrow('unclosed');
    expect(() => parseDelimited(Array.from({ length: 53 }, () => 'x').join(','))).toThrow('52 columns');
  });

  it('exports evaluated values and escapes dangerous text prefixes instead of exporting formula source', () => {
    const workbook = createWorkbookDocument();
    const sheet = workbook.sheets[0];
    sheet.cells = {
      A1: { value: 'Value' }, B1: { value: 'Text' },
      A2: { value: '10' }, B2: { value: '+cmd' },
      A3: { value: '=A2*2' }, B3: { value: '@mention' },
      A4: { value: '=SUM(A2:A3)' }, B4: { value: '-not-a-number' },
    };
    const csv = sheetToCsv(sheet, new WorkbookFormulaEngine(workbook));
    expect(csv).not.toContain('=A2*2');
    expect(parseDelimited(csv)).toEqual([
      ['Value', 'Text'], ['10', "'+cmd"], ['20', "'@mention"], ['30', "'-not-a-number"],
    ]);
  });

  it('round-trips raw clipboard values and preserves target formatting on paste', () => {
    const sheet = createWorkbookSheet();
    sheet.cells.A1 = { value: 'Alpha' };
    sheet.cells.B1 = { value: 'Line 1\nLine 2' };
    sheet.cells.A2 = { value: 'old', format: { bold: true } };
    const clipboard = selectionToClipboard(sheet, { anchor: { row: 1, column: 1 }, active: { row: 1, column: 2 } });
    expect(parseDelimited(clipboard, '\t')).toEqual([['Alpha', 'Line 1\nLine 2']]);
    const pasted = pasteIntoSheet(sheet, clipboard, { row: 2, column: 1 });
    expect(pasted.cells.A2).toEqual({ value: 'Alpha', format: { bold: true } });
    expect(pasted.cells.B2.value).toBe('Line 1\nLine 2');
    expect(() => pasteIntoSheet(sheet, '1\t2', { row: 1, column: 26 })).toThrow('beyond');
  });
});
