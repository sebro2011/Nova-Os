import { useState, type SetStateAction } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SheetsWorkspace from './SheetsWorkspace';
import { LocalizationProvider } from '../../../context/LocalizationContext';
import { PreferencesProvider } from '../../../context/PreferencesContext';
import type { FileNode } from '../../../types';
import { createWorkbookDocument, type WorkbookDocument } from '../core/spreadsheet-model/workbook-model';
import { addWorkbookSheet } from '../core/spreadsheet-model/workbook-operations';
import { parseDelimited } from './sheets-csv';

const mocks = vi.hoisted(() => ({ downloadText: vi.fn() }));
vi.mock('../services/download', () => ({ downloadText: mocks.downloadText }));

const now = new Date().toISOString();
const file: FileNode = { id: 'sheets-ui', parentId: 'documents', name: 'Book.nwsheet', kind: 'file', content: '', mimeType: 'application/x-nova-sheets+json', createdAt: now, updatedAt: now, trashed: false };

function renderWorkspace(initialData: WorkbookDocument) {
  const flush = vi.fn(async () => undefined);
  function Harness() {
    const [data, setData] = useState(initialData);
    const updateData = (update: SetStateAction<WorkbookDocument>) => setData(update);
    return <PreferencesProvider><LocalizationProvider><SheetsWorkspace file={file} data={data} status="saved" error="" updateData={updateData} rename={vi.fn()} flush={flush} createNew={vi.fn(async () => undefined)} /></LocalizationProvider></PreferencesProvider>;
  }
  const view = render(<Harness />);
  return { ...view, flush, sheetId: initialData.sheets[0].id };
}

function cell(sheetId: string, address: string): HTMLElement {
  const element = document.getElementById(`sheet-${sheetId}-${address}`);
  if (!element) throw new Error(`Cell ${address} is not rendered.`);
  return element;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('NOVA Sheets workspace', () => {
  it('recalculates formulas, applies formatting, and supports bounded undo and redo', () => {
    const data = createWorkbookDocument();
    data.sheets[0].cells = { A1: { value: '10' }, A2: { value: '20' }, A3: { value: '=SUM(A1:A2)' } };
    const { sheetId } = renderWorkspace(data);
    expect(cell(sheetId, 'A3')).toHaveTextContent('30');

    fireEvent.change(screen.getByLabelText('Formula'), { target: { value: '15' } });
    expect(cell(sheetId, 'A3')).toHaveTextContent('35');
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByLabelText('Number format'), { target: { value: 'currency' } });
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'USD' } });
    expect(cell(sheetId, 'A1')).toHaveTextContent('$15.00');

    const undo = screen.getByRole('button', { name: 'Undo' });
    fireEvent.click(undo);
    fireEvent.click(undo);
    fireEvent.click(undo);
    fireEvent.click(undo);
    expect(cell(sheetId, 'A1')).toHaveTextContent('10');
    expect(cell(sheetId, 'A3')).toHaveTextContent('30');
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(cell(sheetId, 'A1')).toHaveTextContent('15');
    expect(cell(sheetId, 'A3')).toHaveTextContent('35');
  });

  it('copies, pastes, filters, and sorts real grid selections', () => {
    const data = createWorkbookDocument();
    data.sheets[0].cells = { A1: { value: 'Name' }, B1: { value: 'Score' }, A2: { value: 'Beta' }, B2: { value: '20' }, A3: { value: 'Alpha' }, B3: { value: '10' } };
    const { sheetId } = renderWorkspace(data);
    const clipboard = {
      text: '',
      setData: vi.fn((_type: string, value: string) => { clipboard.text = value; }),
      getData: vi.fn(() => clipboard.text),
    };
    fireEvent.mouseDown(cell(sheetId, 'A2'));
    fireEvent.mouseDown(cell(sheetId, 'B3'), { shiftKey: true });
    fireEvent.copy(screen.getByRole('grid', { name: 'Spreadsheet grid' }), { clipboardData: clipboard });
    expect(parseDelimited(clipboard.text, '\t')).toEqual([['Beta', '20'], ['Alpha', '10']]);

    fireEvent.mouseDown(cell(sheetId, 'A5'));
    fireEvent.paste(screen.getByRole('grid', { name: 'Spreadsheet grid' }), { clipboardData: clipboard });
    expect(cell(sheetId, 'A5')).toHaveTextContent('Beta');
    expect(cell(sheetId, 'B6')).toHaveTextContent('10');

    fireEvent.change(screen.getByLabelText('Filter'), { target: { value: 'Alpha' } });
    expect(document.getElementById(`sheet-${sheetId}-A2`)).toBeNull();
    expect(cell(sheetId, 'A3')).toHaveTextContent('Alpha');
    expect(cell(sheetId, 'A6')).toHaveTextContent('Alpha');
    fireEvent.change(screen.getByLabelText('Filter'), { target: { value: '' } });

    fireEvent.click(screen.getByRole('columnheader', { name: 'B' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sort A to Z' }));
    expect(cell(sheetId, 'A2')).toHaveTextContent('Alpha');
    expect(cell(sheetId, 'A4')).toHaveTextContent('Beta');
  });

  it('renames formulas across sheets, manages tabs, and creates a chart from the active selection', () => {
    const base = createWorkbookDocument();
    base.sheets[0].cells.A1 = { value: '12' };
    const data = addWorkbookSheet(base);
    data.sheets[1].cells.B1 = { value: "='Sheet 1'!A1*2" };
    data.activeSheetId = base.sheets[0].id;
    const { sheetId } = renderWorkspace(data);

    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    const renameDialog = screen.getByRole('dialog', { name: 'Rename sheet' });
    fireEvent.change(within(renameDialog).getByRole('textbox'), { target: { value: 'Sales Data' } });
    fireEvent.click(within(renameDialog).getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Sheet 2' }));
    fireEvent.mouseDown(cell(data.sheets[1].id, 'B1'));
    expect(screen.getByLabelText('Formula')).toHaveValue("='Sales Data'!A1*2");
    expect(cell(data.sheets[1].id, 'B1')).toHaveTextContent('24');

    fireEvent.click(screen.getByRole('button', { name: 'Add sheet' }));
    expect(screen.getByRole('tab', { name: 'Sheet 3' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(screen.getByRole('tab', { name: 'Sheet 3 copy' })).toHaveAttribute('aria-selected', 'true');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.queryByRole('tab', { name: 'Sheet 3 copy' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Sales Data' }));
    fireEvent.mouseDown(cell(sheetId, 'A1'));
    fireEvent.click(screen.getByRole('button', { name: 'Charts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add chart' }));
    const chartDialog = screen.getByRole('dialog', { name: 'Add chart' });
    fireEvent.click(within(chartDialog).getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('img', { name: 'Sales Data chart' })).toBeInTheDocument();
  });

  it('virtualizes late-row navigation and clamps the active cell after row deletion', async () => {
    const data = createWorkbookDocument();
    const { sheetId } = renderWorkspace(data);
    expect(screen.getAllByRole('row').length).toBeLessThan(60);
    const nameBox = screen.getByLabelText('Cell address');
    fireEvent.change(nameBox, { target: { value: 'A200' } });
    const form = nameBox.closest('form');
    if (!form) throw new Error('Cell address form is missing.');
    fireEvent.submit(form);
    await waitFor(() => expect(cell(sheetId, 'A200')).toBeInTheDocument());
    expect(nameBox).toHaveValue('A200');

    fireEvent.click(screen.getByText('Grid'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete row' }));
    expect(nameBox).toHaveValue('A199');
    fireEvent.keyDown(screen.getByRole('grid', { name: 'Spreadsheet grid' }), { key: 'a', ctrlKey: true });
    expect(screen.getByText('A1:Z199')).toBeInTheDocument();
  });

  it('imports CSV as a new sheet and exports evaluated CSV through the File menu', async () => {
    const data = createWorkbookDocument();
    data.sheets[0].cells.A1 = { value: '10' };
    const { container, flush } = renderWorkspace(data);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error('Workbook import input is missing.');
    const csv = new File([''], 'budget.csv', { type: 'text/csv' });
    Object.defineProperty(csv, 'text', { value: async () => 'Name,Amount\nFood,25\nTotal,=SUM(B2:B2)' });
    fireEvent.change(input, { target: { files: [csv] } });

    expect(await screen.findByRole('tab', { name: 'budget' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Sheet 1' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByRole('button', { name: 'Export active sheet as CSV' }));
    await waitFor(() => expect(mocks.downloadText).toHaveBeenCalled());
    expect(flush).toHaveBeenCalled();
    const [content, name, mime] = mocks.downloadText.mock.calls[0] as [string, string, string];
    expect(name).toBe('Book-budget.csv');
    expect(mime).toBe('text/csv');
    expect(parseDelimited(content)).toEqual([['Name', 'Amount'], ['Food', '25'], ['Total', '25']]);
  });
});
