import { describe, expect, it, vi } from 'vitest';
import { WorkbookFormulaEngine, formulaDisplayValue } from './formula-engine';
import { createWorkbookDocument, createWorkbookSheet } from './workbook-model';

describe('safe Sheets formula engine', () => {
  it('evaluates references, ranges, requested functions, and cross-sheet formulas', () => {
    const workbook = createWorkbookDocument();
    const sheet = workbook.sheets[0];
    sheet.cells = {
      A1: { value: '10' }, A2: { value: '20' }, A3: { value: '30' }, A4: { value: 'text' },
      B1: { value: '=SUM(A1:A3)' }, B2: { value: '=AVERAGE(A1:A3)' }, B3: { value: '=MIN(A1:A3)' }, B4: { value: '=MAX(A1:A3)' },
      B5: { value: '=COUNT(A1:A4)' }, B6: { value: '=COUNTA(A1:A5)' }, B7: { value: '=IF(A1>5,"yes",1/0)' },
      B8: { value: '=SUM(A1:A3)/3' }, B9: { value: '=A1&A4' }, B10: { value: '=50%' }, B11: { value: '=2^3^2' }, B12: { value: '=-2^2' },
      B13: { value: '=$A$1+$A$2' }, B14: { value: '=SUM(\'Data 2\'!A1:A2)' },
    };
    const data = createWorkbookSheet('Data 2');
    data.cells = { A1: { value: '5' }, A2: { value: '10' } };
    workbook.sheets.push(data);
    const engine = new WorkbookFormulaEngine(workbook);
    const expected: Record<string, unknown> = { B1: 60, B2: 20, B3: 10, B4: 30, B5: 3, B6: 4, B7: 'yes', B8: 20, B9: '10text', B10: 0.5, B11: 512, B12: -4, B13: 30, B14: 15 };
    for (const [address, value] of Object.entries(expected)) expect(engine.getCell(sheet.id, address), address).toEqual(value);
  });

  it('returns explicit errors for cycles, division by zero, unsupported names, and bounds', () => {
    const workbook = createWorkbookDocument();
    const sheet = workbook.sheets[0];
    sheet.cells = {
      A1: { value: '1' }, A2: { value: '0' }, C1: { value: '=C2' }, C2: { value: '=C1' },
      D1: { value: '=1/0' }, D2: { value: '=WEBSERVICE("https://example.com")' }, D3: { value: '=A1:A3' },
      D4: { value: '=SUM(A1:AZ500)' }, D5: { value: '=Missing!A1' }, D6: { value: '=IF(FALSE,1/0,"safe")' },
    };
    const engine = new WorkbookFormulaEngine(workbook);
    expect(formulaDisplayValue(engine.getCell(sheet.id, 'C1'))).toBe('#CYCLE!');
    expect(formulaDisplayValue(engine.getCell(sheet.id, 'C2'))).toBe('#CYCLE!');
    expect(formulaDisplayValue(engine.getCell(sheet.id, 'D1'))).toBe('#DIV/0!');
    expect(formulaDisplayValue(engine.getCell(sheet.id, 'D2'))).toBe('#NAME?');
    expect(formulaDisplayValue(engine.getCell(sheet.id, 'D3'))).toBe('#VALUE!');
    expect(formulaDisplayValue(engine.getCell(sheet.id, 'D4'))).toBe('#LIMIT!');
    expect(formulaDisplayValue(engine.getCell(sheet.id, 'D5'))).toBe('#REF!');
    expect(engine.getCell(sheet.id, 'D6')).toBe('safe');
  });

  it('never executes JavaScript-like formula content', () => {
    const alert = vi.fn();
    Object.assign(globalThis, { alert });
    const workbook = createWorkbookDocument();
    const sheet = workbook.sheets[0];
    sheet.cells.A1 = { value: '=constructor.constructor("alert(1)")()' };
    const engine = new WorkbookFormulaEngine(workbook);
    expect(formulaDisplayValue(engine.getCell(sheet.id, 'A1'))).toBe('#VALUE!');
    expect(alert).not.toHaveBeenCalled();
  });
});
