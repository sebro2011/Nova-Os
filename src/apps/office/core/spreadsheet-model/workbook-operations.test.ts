import { describe, expect, it } from 'vitest';
import { createWorkbookDocument } from './workbook-model';
import { addWorkbookSheet, deleteWorkbookRow, duplicateWorkbookSheet, insertWorkbookRow, renameWorkbookSheet, sortWorkbookSheet } from './workbook-operations';
import { WorkbookFormulaEngine } from './formula-engine';

describe('workbook structure and reference remapping', () => {
  it('adjusts local and cross-sheet references on row insertion and deletion without rewriting strings', () => {
    const workbook = createWorkbookDocument();
    const sheet = workbook.sheets[0];
    sheet.cells = { A2: { value: '10' }, A3: { value: '20' }, B2: { value: '=A2*2' }, B3: { value: '=SUM(A2:A3)' }, C2: { value: '="A2"&A2' } };
    const other = addWorkbookSheet(workbook);
    other.sheets[1].cells.D1 = { value: "='Sheet 1'!A2" };
    const inserted = insertWorkbookRow(other, sheet.id, 2);
    expect(inserted.sheets[0].cells.A3.value).toBe('10');
    expect(inserted.sheets[0].cells.B3.value).toBe('=A3*2');
    expect(inserted.sheets[0].cells.B4.value).toBe('=SUM(A3:A4)');
    expect(inserted.sheets[0].cells.C3.value).toBe('="A2"&A3');
    expect(inserted.sheets[1].cells.D1.value).toBe("='Sheet 1'!A3");
    const restored = deleteWorkbookRow(inserted, sheet.id, 2);
    expect(restored.sheets[0].cells.B2.value).toBe('=A2*2');
    expect(restored.sheets[0].cells.B3.value).toBe('=SUM(A2:A3)');
    const deleted = deleteWorkbookRow(restored, sheet.id, 2);
    expect(deleted.sheets[0].cells.B3?.value).toBeUndefined();
    expect(deleted.sheets[0].cells.B2.value).toBe('=SUM(#REF!)');
    expect(new WorkbookFormulaEngine(deleted).getCell(sheet.id, 'B2')).toEqual({ type: 'error', code: '#REF!' });
  });

  it('sorts evaluated rows stably and remaps formulas to their new rows', () => {
    const workbook = createWorkbookDocument();
    const sheet = workbook.sheets[0];
    sheet.cells = {
      A1: { value: 'Name' }, B1: { value: 'Score' }, C1: { value: 'Double' },
      A2: { value: 'Twenty' }, B2: { value: '20' }, C2: { value: '=B2*2' },
      A3: { value: 'Ten' }, B3: { value: '10' }, C3: { value: '=B3*2' },
      A4: { value: 'Thirty' }, B4: { value: '30' }, C4: { value: '=B4*2' },
    };
    const sorted = sortWorkbookSheet(workbook, sheet.id, 2, true);
    expect(sorted.sheets[0].cells.A2.value).toBe('Ten');
    expect(sorted.sheets[0].cells.A3.value).toBe('Twenty');
    expect(sorted.sheets[0].cells.A4.value).toBe('Thirty');
    expect(sorted.sheets[0].cells.C2.value).toBe('=B2*2');
    expect(new WorkbookFormulaEngine(sorted).getCell(sheet.id, 'C2')).toBe(20);
  });

  it('adds, renames, duplicates, and validates multiple sheets', () => {
    const workbook = createWorkbookDocument();
    const added = addWorkbookSheet(workbook);
    expect(added.sheets).toHaveLength(2);
    expect(added.activeSheetId).toBe(added.sheets[1].id);
    const renamed = renameWorkbookSheet(added, added.activeSheetId, 'Analysis');
    expect(renamed.sheets[1].name).toBe('Analysis');
    expect(() => renameWorkbookSheet(renamed, renamed.activeSheetId, 'Sheet 1')).toThrow('unique');
    const duplicated = duplicateWorkbookSheet(renamed, renamed.activeSheetId);
    expect(duplicated.sheets).toHaveLength(3);
    expect(duplicated.sheets[2].id).not.toBe(duplicated.sheets[1].id);
    expect(duplicated.sheets[2].name).toBe('Analysis copy');
  });
});
