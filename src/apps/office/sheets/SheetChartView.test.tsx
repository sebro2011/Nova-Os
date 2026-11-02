import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SheetChartView, { getChartPoints } from './SheetChartView';
import { WorkbookFormulaEngine } from '../core/spreadsheet-model/formula-engine';
import { createWorkbookDocument } from '../core/spreadsheet-model/workbook-model';

describe('Sheets chart data', () => {
  it('uses the first range column for labels and skips non-numeric headers', () => {
    const workbook = createWorkbookDocument();
    const sheet = workbook.sheets[0];
    sheet.cells = { A1: { value: 'Category' }, B1: { value: 'Amount' }, A2: { value: 'Food' }, B2: { value: '20' }, A3: { value: 'Travel' }, B3: { value: '=B2/2' } };
    const chart = { id: 'chart-test', type: 'pie' as const, title: 'Expenses', startCell: 'A1', endCell: 'B3' };
    const engine = new WorkbookFormulaEngine(workbook);
    expect(getChartPoints(sheet, chart, engine)).toEqual([{ label: 'Food', value: 20 }, { label: 'Travel', value: 10 }]);
    render(<SheetChartView sheet={sheet} chart={chart} engine={engine} />);
    expect(screen.getByRole('img', { name: 'Expenses' })).toBeInTheDocument();
    expect(screen.getByText('A1:B3 · 2 numeric values')).toBeInTheDocument();
  });
});
