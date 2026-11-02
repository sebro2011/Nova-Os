import { useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent, type SetStateAction } from 'react';
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDownAZ, ArrowUpZA, Bold, ChartColumn,
  Columns3, Copy, Download, FilePlus2, FileUp, Filter, History, Italic, PaintBucket,
  Pencil, Plus, Redo2, Rows3, Save, Settings2, Trash2, Undo2, X,
} from 'lucide-react';
import type { FileNode } from '../../../types';
import { createId, errorMessage } from '../../../lib/utils';
import { useI18n } from '../../../context/LocalizationContext';
import type { OfficeSaveStatus } from '../core/autosave/useOfficeDocument';
import { OFFICE_EXTENSION, OFFICE_MIME, type OfficeTemplate } from '../core/file-formats/constants';
import { parseOfficeData, serializeOfficeData } from '../core/file-formats/native';
import { cellAddressToCoords, columnNumberToName, coordsToCellAddress } from '../core/spreadsheet-model/cell-address';
import { WorkbookFormulaEngine } from '../core/spreadsheet-model/formula-engine';
import { validateWorkbookDocument, type CellFormat, type CurrencyCode, type NumberFormat, type SheetChart, type WorkbookDocument, type WorkbookSheet } from '../core/spreadsheet-model/workbook-model';
import {
  addWorkbookSheet, deleteWorkbookColumn, deleteWorkbookRow, deleteWorkbookSheet,
  duplicateWorkbookSheet, insertWorkbookColumn, insertWorkbookRow, renameWorkbookSheet,
  sortWorkbookSheet,
} from '../core/spreadsheet-model/workbook-operations';
import { OfficeDialog, OfficeMenu, OfficeSaveIndicator, OfficeToolbarButton, OfficeWarnings } from '../components/OfficeUI';
import OfficeRevisionDialog from '../components/OfficeRevisionDialog';
import { downloadText } from '../services/download';
import { forEachSelectedCell, formatCellValue, normalizeSelection, selectionLabel, type CellSelection } from './cell-utils';
import { pasteIntoSheet, selectionToClipboard, sheetFromCsv, sheetToCsv } from './sheets-csv';
import SheetsGrid from './SheetsGrid';
import SheetChartView from './SheetChartView';

interface SheetsWorkspaceProps {
  file: FileNode;
  data: WorkbookDocument;
  status: OfficeSaveStatus;
  error: string;
  updateData: (update: SetStateAction<WorkbookDocument>) => void;
  rename: (name: string) => void;
  flush: (forceRevision?: boolean) => Promise<void>;
  createNew: (name?: string, template?: OfficeTemplate) => Promise<void>;
}

const initialSelection: CellSelection = { anchor: { row: 1, column: 1 }, active: { row: 1, column: 1 } };
const numberFormats: NumberFormat[] = ['general', 'number', 'currency', 'percent', 'date', 'text'];
const currencyCodes: CurrencyCode[] = ['LKR', 'USD', 'EUR', 'GBP', 'INR'];

function withoutEmptyFormat(cell: WorkbookSheet['cells'][string]): WorkbookSheet['cells'][string] {
  if (!cell.format || !Object.keys(cell.format).length) {
    const { format: _format, ...rest } = cell;
    return rest;
  }
  return cell;
}

export default function SheetsWorkspace({ file, data, status, error, updateData, rename, flush, createNew }: SheetsWorkspaceProps) {
  const { t, language } = useI18n();
  const dataRef = useRef(data);
  dataRef.current = data;
  const pastRef = useRef<WorkbookDocument[]>([]);
  const redoRef = useRef<WorkbookDocument[]>([]);
  const editSessionRef = useRef(false);
  const importRef = useRef<HTMLInputElement>(null);
  const [, setHistoryVersion] = useState(0);
  const [selection, setSelection] = useState<CellSelection>(initialSelection);
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [scrollRequest, setScrollRequest] = useState({ row: 1, token: 0 });
  const [nameDraft, setNameDraft] = useState('A1');
  const [actionError, setActionError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [sheetNameDraft, setSheetNameDraft] = useState('');
  const [gridSettingsOpen, setGridSettingsOpen] = useState(false);
  const [columnWidthDraft, setColumnWidthDraft] = useState(96);
  const [rowHeightDraft, setRowHeightDraft] = useState(28);
  const [chartsOpen, setChartsOpen] = useState(false);
  const [chartDialogOpen, setChartDialogOpen] = useState(false);
  const [chartDraft, setChartDraft] = useState<{ title: string; type: SheetChart['type']; startCell: string; endCell: string }>({ title: 'Chart', type: 'bar', startCell: 'A1', endCell: 'B5' });

  const activeSheet = data.sheets.find((sheet) => sheet.id === data.activeSheetId) ?? data.sheets[0];
  const engine = useMemo(() => new WorkbookFormulaEngine(data), [data]);
  const activeAddress = coordsToCellAddress(selection.active.row, selection.active.column);
  const activeCell = activeSheet.cells[activeAddress];
  const activeFormat = activeCell?.format;
  const title = file.name.replace(/\.nwsheet$/i, '');

  const rowNumbers = useMemo(() => {
    const rows = Array.from({ length: activeSheet.rowCount }, (_, index) => index + 1);
    const query = activeSheet.filter.trim().toLocaleLowerCase();
    if (!query) return rows;
    const matching = new Set<number>([1]);
    for (const [address, cell] of Object.entries(activeSheet.cells)) {
      const value = engine.getCell(activeSheet.id, address);
      if (cell.value.toLocaleLowerCase().includes(query) || formatCellValue(value, cell.format, language).toLocaleLowerCase().includes(query)) matching.add(cellAddressToCoords(address).row);
    }
    return rows.filter((row) => matching.has(row));
  }, [activeSheet, engine, language]);

  const updateHistoryVersion = () => setHistoryVersion((current) => current + 1);
  const pushHistory = () => {
    pastRef.current.push(structuredClone(dataRef.current));
    if (pastRef.current.length > 50) pastRef.current.shift();
    redoRef.current = [];
    updateHistoryVersion();
  };
  const applyData = (next: WorkbookDocument, record = true) => {
    if (record) pushHistory();
    dataRef.current = next;
    updateData(next);
  };
  const mutate = (action: () => void) => {
    setActionError('');
    try { action(); } catch (caught) { setActionError(errorMessage(caught)); }
  };
  const runAction = async (action: () => Promise<void>) => {
    setBusy(true);
    setActionError('');
    try { await action(); } catch (caught) { setActionError(errorMessage(caught)); } finally { setBusy(false); }
  };
  const finishEdit = () => {
    setEditingAddress(null);
    editSessionRef.current = false;
  };
  const changeSelection = (next: CellSelection) => {
    setSelection(next);
    setNameDraft(coordsToCellAddress(next.active.row, next.active.column));
  };
  const updateActiveSheetDirect = (update: (sheet: WorkbookSheet) => WorkbookSheet) => {
    const current = dataRef.current;
    const next = { ...current, sheets: current.sheets.map((sheet) => sheet.id === current.activeSheetId ? update(sheet) : sheet) };
    dataRef.current = next;
    updateData(next);
  };
  const updateActiveSheet = (update: (sheet: WorkbookSheet) => WorkbookSheet, record = true) => {
    const current = dataRef.current;
    applyData({ ...current, sheets: current.sheets.map((sheet) => sheet.id === current.activeSheetId ? update(sheet) : sheet) }, record);
  };
  const applyGridOperation = (operation: () => WorkbookDocument) => {
    const next = operation();
    applyData(next);
    const sheet = next.sheets.find((item) => item.id === next.activeSheetId) ?? next.sheets[0];
    const constrain = (position: CellSelection['active']) => ({ row: Math.min(position.row, sheet.rowCount), column: Math.min(position.column, sheet.columnCount) });
    changeSelection({ anchor: constrain(selection.anchor), active: constrain(selection.active) });
  };

  const writeCell = (address: string, value: string) => {
    if (value.length > 20_000 || (value.startsWith('=') && value.length > 2_000)) {
      setActionError(value.startsWith('=') ? 'Formulas are limited to 2,000 characters.' : 'Cell values are limited to 20,000 characters.');
      return;
    }
    const currentSheet = dataRef.current.sheets.find((sheet) => sheet.id === dataRef.current.activeSheetId);
    if (currentSheet && !currentSheet.cells[address] && Object.keys(currentSheet.cells).length >= 20_000) {
      setActionError('Sheets are limited to 20,000 populated cells.');
      return;
    }
    if (!editSessionRef.current) {
      pushHistory();
      editSessionRef.current = true;
    }
    updateActiveSheet((sheet) => {
      const previous = sheet.cells[address];
      const cells = { ...sheet.cells };
      if (!value && !previous?.format) delete cells[address];
      else cells[address] = { ...previous, value };
      return { ...sheet, cells };
    }, false);
  };

  const startEdit = (address: string, replacement?: string) => {
    editSessionRef.current = false;
    setEditingAddress(address);
    if (replacement !== undefined) writeCell(address, replacement);
  };

  const clearSelection = () => mutate(() => {
    updateActiveSheet((sheet) => {
      const cells = { ...sheet.cells };
      forEachSelectedCell(selection, (row, column) => {
        const address = coordsToCellAddress(row, column);
        if (!cells[address]) return;
        if (cells[address].format) cells[address] = { ...cells[address], value: '' };
        else delete cells[address];
      });
      return { ...sheet, cells };
    });
  });

  const applyFormat = (patch: Partial<CellFormat>) => mutate(() => {
    updateActiveSheet((sheet) => {
      const cells = { ...sheet.cells };
      forEachSelectedCell(selection, (row, column) => {
        const address = coordsToCellAddress(row, column);
        const previous = cells[address] ?? { value: '' };
        const format = { ...previous.format, ...patch };
        Object.keys(format).forEach((key) => { if (format[key as keyof CellFormat] === undefined) delete format[key as keyof CellFormat]; });
        const next = withoutEmptyFormat({ ...previous, format });
        if (!next.value && !next.format) delete cells[address];
        else cells[address] = next;
      });
      if (Object.keys(cells).length > 20_000) throw new Error('Sheets are limited to 20,000 populated cells.');
      return { ...sheet, cells };
    });
  });

  const undo = () => {
    const previous = pastRef.current.pop();
    if (!previous) return;
    finishEdit();
    redoRef.current.push(structuredClone(dataRef.current));
    dataRef.current = previous;
    updateData(previous);
    changeSelection(initialSelection);
    updateHistoryVersion();
  };
  const redo = () => {
    const next = redoRef.current.pop();
    if (!next) return;
    finishEdit();
    pastRef.current.push(structuredClone(dataRef.current));
    dataRef.current = next;
    updateData(next);
    changeSelection(initialSelection);
    updateHistoryVersion();
  };

  const copySelection = (event: ClipboardEvent<HTMLTableElement>, cut: boolean) => {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    mutate(() => {
      event.clipboardData.setData('text/plain', selectionToClipboard(activeSheet, selection));
      if (cut) clearSelection();
    });
  };
  const pasteSelection = (event: ClipboardEvent<HTMLTableElement>) => {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain');
    if (!text) return;
    mutate(() => {
      const current = dataRef.current;
      const next = { ...current, sheets: current.sheets.map((sheet) => sheet.id === current.activeSheetId ? pasteIntoSheet(sheet, text, selection.active) : sheet) };
      applyData(validateWorkbookDocument(next));
    });
  };

  const jumpToCell = () => mutate(() => {
    const address = nameDraft.trim().toUpperCase();
    const coords = cellAddressToCoords(address);
    if (coords.row > activeSheet.rowCount || coords.column > activeSheet.columnCount) throw new Error('The cell is outside this sheet.');
    changeSelection({ anchor: coords, active: coords });
    setScrollRequest((current) => ({ row: coords.row, token: current.token + 1 }));
  });

  const addChart = () => mutate(() => {
    const chart: SheetChart = { id: createId('chart'), title: chartDraft.title.trim() || 'Chart', type: chartDraft.type, startCell: chartDraft.startCell.trim().toUpperCase(), endCell: chartDraft.endCell.trim().toUpperCase() };
    updateActiveSheet((sheet) => {
      if (sheet.charts.length >= 10) throw new Error('Sheets are limited to 10 charts.');
      return validateWorkbookDocument({ sheets: [{ ...sheet, charts: [...sheet.charts, chart] }], activeSheetId: sheet.id }).sheets[0];
    });
    setChartDialogOpen(false);
    setChartsOpen(true);
  });

  const importWorkbook = (selected?: File) => {
    if (!selected) return;
    void runAction(async () => {
      const extension = selected.name.split('.').pop()?.toLocaleLowerCase();
      if (extension === 'nwsheet') {
        if (selected.size > 12_000_000) throw new Error('NOVA workbook imports are limited to 12 MB.');
        const imported = parseOfficeData('sheets', await selected.text());
        applyData(imported);
        setWarnings(['The imported NOVA workbook replaced the current workbook. Use undo or revision history to recover the previous state.']);
      } else if (extension === 'csv') {
        if (selected.size > 2_000_000) throw new Error('CSV imports are limited to 2 MB.');
        const current = dataRef.current;
        if (current.sheets.length >= 20) throw new Error('Workbooks are limited to 20 sheets.');
        const base = selected.name.replace(/\.csv$/i, '').trim().slice(0, 54) || 'Imported CSV';
        let name = base;
        let suffix = 2;
        while (current.sheets.some((sheet) => sheet.name.toLocaleLowerCase() === name.toLocaleLowerCase())) name = `${base} ${suffix++}`;
        const imported = sheetFromCsv(await selected.text(), name);
        const next = validateWorkbookDocument({ sheets: [...current.sheets, imported], activeSheetId: imported.id });
        applyData(next);
        setWarnings(['CSV was added as a new sheet. Existing sheets were not replaced.']);
      } else throw new Error('Choose a CSV or .nwsheet file.');
      changeSelection(initialSelection);
    });
  };

  const exportNative = () => runAction(async () => {
    await flush();
    downloadText(serializeOfficeData('sheets', dataRef.current), `${title}${OFFICE_EXTENSION.sheets}`, OFFICE_MIME.sheets);
  });
  const exportCsv = () => runAction(async () => {
    await flush();
    const current = dataRef.current;
    const sheet = current.sheets.find((item) => item.id === current.activeSheetId) ?? current.sheets[0];
    const safeSheetName = sheet.name.replace(/[\\/:*?"<>|]/g, '-');
    downloadText(sheetToCsv(sheet, new WorkbookFormulaEngine(current)), `${title}-${safeSheetName}.csv`, 'text/csv');
  });

  const handleKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
    event.preventDefault();
    void flush(true);
  };

  return <div className="office-app sheets-app" onKeyDown={handleKeyboard}>
    <header className="office-app-header">
      <input className="office-title-input" aria-label={t('common.name')} value={title} maxLength={120} onChange={(event) => rename(event.target.value)} />
      <OfficeSaveIndicator status={status} />
      <button type="button" className="office-primary-button" onClick={() => void flush(true)} disabled={busy}><Save size={14} />{t('common.save')}</button>
    </header>
    <div className="office-toolbar" role="toolbar" aria-label={t('sheets.tools')}>
      <OfficeMenu label={t('common.file')}>
        <button className="office-menu-item" onClick={() => void createNew(undefined, 'blank')}><FilePlus2 size={14} />{t('office.newSpreadsheet')}</button>
        <button className="office-menu-item" onClick={() => void createNew(undefined, 'budget')}><FilePlus2 size={14} />{t('sheets.newBudget')}</button>
        <button className="office-menu-item" onClick={() => importRef.current?.click()}><FileUp size={14} />{t('sheets.importWorkbook')}</button>
        <button className="office-menu-item" onClick={() => setRevisionsOpen(true)}><History size={14} />{t('office.revisionHistory')}</button>
        <button className="office-menu-item" onClick={() => void exportNative()} disabled={busy}><Download size={14} />{t('sheets.exportNative')}</button>
        <button className="office-menu-item" onClick={() => void exportCsv()} disabled={busy}><Download size={14} />{t('sheets.exportCsv')}</button>
      </OfficeMenu>
      <span className="office-toolbar-divider" />
      <OfficeToolbarButton label={t('common.undo')} onClick={undo} disabled={!pastRef.current.length}><Undo2 size={15} /></OfficeToolbarButton>
      <OfficeToolbarButton label={t('common.redo')} onClick={redo} disabled={!redoRef.current.length}><Redo2 size={15} /></OfficeToolbarButton>
      <OfficeToolbarButton label={t('writer.bold')} active={activeFormat?.bold} onClick={() => applyFormat({ bold: !activeFormat?.bold })}><Bold size={15} /></OfficeToolbarButton>
      <OfficeToolbarButton label={t('writer.italic')} active={activeFormat?.italic} onClick={() => applyFormat({ italic: !activeFormat?.italic })}><Italic size={15} /></OfficeToolbarButton>
      {(['left', 'center', 'right'] as const).map((align) => {
        const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight;
        const key = align === 'left' ? 'writer.alignLeft' : align === 'center' ? 'writer.alignCenter' : 'writer.alignRight';
        return <OfficeToolbarButton key={align} label={t(key)} active={activeFormat?.align === align} onClick={() => applyFormat({ align })}><Icon size={15} /></OfficeToolbarButton>;
      })}
      <OfficeToolbarButton label={t('sheets.borders')} active={activeFormat?.border} onClick={() => applyFormat({ border: !activeFormat?.border })}><Columns3 size={15} /></OfficeToolbarButton>
      <label className="office-color-control" title={t('sheets.fillColor')}><PaintBucket size={13} /><span className="sr-only">{t('sheets.fillColor')}</span><input type="color" aria-label={t('sheets.fillColor')} value={activeFormat?.background ?? '#dbeafe'} onChange={(event) => applyFormat({ background: event.target.value })} /></label>
      <label className="office-color-control" title={t('writer.textColor')}><span className="sheets-text-color-icon">A</span><span className="sr-only">{t('writer.textColor')}</span><input type="color" aria-label={t('writer.textColor')} value={activeFormat?.color ?? '#172033'} onChange={(event) => applyFormat({ color: event.target.value })} /></label>
      <select className="office-select sheets-format-select" aria-label={t('sheets.numberFormat')} value={activeFormat?.numberFormat ?? 'general'} onChange={(event) => applyFormat({ numberFormat: event.target.value as NumberFormat, ...(event.target.value === 'currency' ? { currencyCode: activeFormat?.currencyCode ?? 'LKR' } : {}) })}>{numberFormats.map((format) => <option key={format} value={format}>{format === 'percent' ? t('sheets.percentage') : format === 'currency' ? t('sheets.currency') : format === 'date' ? t('sheets.date') : format[0].toUpperCase() + format.slice(1)}</option>)}</select>
      {activeFormat?.numberFormat === 'currency' && <select className="office-select sheets-currency-select" aria-label={t('sheets.currency')} value={activeFormat.currencyCode ?? 'LKR'} onChange={(event) => applyFormat({ currencyCode: event.target.value as CurrencyCode })}>{currencyCodes.map((currency) => <option key={currency}>{currency}</option>)}</select>}
      <OfficeToolbarButton label={t('sheets.clearFormatting')} onClick={() => applyFormat({ bold: undefined, italic: undefined, align: undefined, background: undefined, color: undefined, border: undefined, numberFormat: undefined, currencyCode: undefined })}><X size={15} /></OfficeToolbarButton>
      <span className="office-toolbar-divider" />
      <OfficeMenu label={t('sheets.grid')}>
        <button className="office-menu-item" onClick={() => mutate(() => applyGridOperation(() => insertWorkbookRow(dataRef.current, activeSheet.id, selection.active.row)))}><Rows3 size={14} />{t('writer.addRow')}</button>
        <button className="office-menu-item" onClick={() => mutate(() => applyGridOperation(() => insertWorkbookColumn(dataRef.current, activeSheet.id, selection.active.column)))}><Columns3 size={14} />{t('writer.addColumn')}</button>
        <button className="office-menu-item danger" onClick={() => mutate(() => applyGridOperation(() => deleteWorkbookRow(dataRef.current, activeSheet.id, selection.active.row)))}><Trash2 size={14} />{t('sheets.deleteRow')}</button>
        <button className="office-menu-item danger" onClick={() => mutate(() => applyGridOperation(() => deleteWorkbookColumn(dataRef.current, activeSheet.id, selection.active.column)))}><Trash2 size={14} />{t('sheets.deleteColumn')}</button>
        <button className="office-menu-item" onClick={() => { setColumnWidthDraft(activeSheet.columnWidths[columnNumberToName(selection.active.column)] ?? 96); setRowHeightDraft(activeSheet.rowHeights[String(selection.active.row)] ?? 28); setGridSettingsOpen(true); }}><Settings2 size={14} />{t('sheets.cellSize')}</button>
        <button className="office-menu-item danger" onClick={clearSelection}><Trash2 size={14} />{t('sheets.clearContents')}</button>
      </OfficeMenu>
      <OfficeToolbarButton label={t('sheets.sortAscending')} onClick={() => mutate(() => applyGridOperation(() => sortWorkbookSheet(dataRef.current, activeSheet.id, selection.active.column, true)))}><ArrowDownAZ size={15} /></OfficeToolbarButton>
      <OfficeToolbarButton label={t('sheets.sortDescending')} onClick={() => mutate(() => applyGridOperation(() => sortWorkbookSheet(dataRef.current, activeSheet.id, selection.active.column, false)))}><ArrowUpZA size={15} /></OfficeToolbarButton>
      <OfficeToolbarButton label={t('sheets.charts')} active={chartsOpen} onClick={() => setChartsOpen((current) => !current)}><ChartColumn size={15} /></OfficeToolbarButton>
    </div>
    <div className="sheets-formula-bar">
      <form onSubmit={(event) => { event.preventDefault(); jumpToCell(); }}><input className="sheets-name-box" aria-label="Cell address" value={nameDraft} maxLength={7} onChange={(event) => setNameDraft(event.target.value)} /></form>
      <span className="sheets-fx">fx</span>
      <input className="sheets-formula-input" aria-label={t('sheets.formula')} value={activeCell?.value ?? ''} maxLength={20_000} spellCheck={false} placeholder="Value or =SUM(A1:B2)" onFocus={() => { editSessionRef.current = false; }} onBlur={() => { editSessionRef.current = false; }} onChange={(event) => writeCell(activeAddress, event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }} />
      <label className="sheets-filter-control"><Filter size={13} /><span className="sr-only">{t('sheets.filter')}</span><input aria-label={t('sheets.filter')} value={activeSheet.filter} maxLength={200} placeholder={t('sheets.filter')} onChange={(event) => updateActiveSheetDirect((sheet) => ({ ...sheet, filter: event.target.value }))} /></label>
    </div>
    {(error || actionError || busy) && <div className={`office-action-banner ${error || actionError ? 'is-error' : ''}`} role={error || actionError ? 'alert' : 'status'}>{error || actionError || t('common.loading')}</div>}
    <OfficeWarnings warnings={warnings} onDismiss={() => setWarnings([])} />
    <div className="sheets-main">
      <SheetsGrid sheet={activeSheet} engine={engine} language={language} selection={selection} rowNumbers={rowNumbers} editingAddress={editingAddress} scrollRequest={scrollRequest} onSelectionChange={changeSelection} onStartEdit={startEdit} onEditChange={(value) => { if (editingAddress) writeCell(editingAddress, value); }} onFinishEdit={finishEdit} onClear={clearSelection} onSave={() => void flush(true)} onUndo={undo} onRedo={redo} onBold={() => applyFormat({ bold: !activeFormat?.bold })} onItalic={() => applyFormat({ italic: !activeFormat?.italic })} onCopy={copySelection} onPaste={pasteSelection} />
      {chartsOpen && <aside className="office-side-panel sheets-charts-panel app-scroll" aria-label={t('sheets.charts')}>
        <div className="office-panel-heading"><h2>{t('sheets.charts')}</h2><OfficeToolbarButton label={t('common.close')} onClick={() => setChartsOpen(false)}><X size={14} /></OfficeToolbarButton></div>
        <button className="office-secondary-button sheets-add-chart" onClick={() => { const range = normalizeSelection(selection); setChartDraft({ title: `${activeSheet.name} chart`, type: 'bar', startCell: coordsToCellAddress(range.startRow, range.startColumn), endCell: coordsToCellAddress(range.endRow, range.endColumn) }); setChartDialogOpen(true); }}><Plus size={14} />{t('sheets.addChart')}</button>
        <p className="office-panel-note">{t('sheets.chartNote')}</p>
        {activeSheet.charts.map((chart) => <section className="sheets-chart-card" key={chart.id}><div><h3>{chart.title}</h3><OfficeToolbarButton label={t('common.delete')} onClick={() => mutate(() => updateActiveSheet((sheet) => ({ ...sheet, charts: sheet.charts.filter((item) => item.id !== chart.id) })))}><Trash2 size={13} /></OfficeToolbarButton></div><SheetChartView sheet={activeSheet} chart={chart} engine={engine} /></section>)}
      </aside>}
    </div>
    <div className="sheets-tabbar">
      <OfficeToolbarButton label={t('sheets.addSheet')} onClick={() => mutate(() => { applyData(addWorkbookSheet(dataRef.current)); changeSelection(initialSelection); })}><Plus size={15} /></OfficeToolbarButton>
      <div className="sheets-tabs app-scroll" role="tablist" aria-label={t('sheets.sheet')}>{data.sheets.map((sheet) => <button key={sheet.id} role="tab" aria-selected={sheet.id === activeSheet.id} className={sheet.id === activeSheet.id ? 'is-active' : ''} onClick={() => { finishEdit(); updateData({ ...dataRef.current, activeSheetId: sheet.id }); changeSelection(initialSelection); }}>{sheet.name}</button>)}</div>
      <OfficeToolbarButton label={t('common.rename')} onClick={() => { setSheetNameDraft(activeSheet.name); setRenameOpen(true); }}><Pencil size={14} /></OfficeToolbarButton>
      <OfficeToolbarButton label={t('common.duplicate')} onClick={() => mutate(() => { applyData(duplicateWorkbookSheet(dataRef.current, activeSheet.id)); changeSelection(initialSelection); })}><Copy size={15} /></OfficeToolbarButton>
      <OfficeToolbarButton label={t('common.delete')} onClick={() => { if (window.confirm(`Delete sheet “${activeSheet.name}”?`)) mutate(() => { applyData(deleteWorkbookSheet(dataRef.current, activeSheet.id)); changeSelection(initialSelection); }); }} disabled={data.sheets.length <= 1}><Trash2 size={14} /></OfficeToolbarButton>
    </div>
    <footer className="office-statusbar"><span>{selectionLabel(selection)}</span><span>{rowNumbers.length} / {activeSheet.rowCount} rows</span><span className="office-statusbar-right">{t('office.localOffline')}</span></footer>
    <input ref={importRef} type="file" className="hidden" accept=".nwsheet,.csv,application/x-nova-sheets+json,text/csv" onChange={(event) => { importWorkbook(event.target.files?.[0]); event.target.value = ''; }} />
    {revisionsOpen && <OfficeRevisionDialog fileId={file.id} kind="sheets" onClose={() => setRevisionsOpen(false)} onRestore={(revision) => { applyData(validateWorkbookDocument(revision)); changeSelection(initialSelection); }} />}
    {renameOpen && <OfficeDialog title={t('sheets.renameSheet')} onClose={() => setRenameOpen(false)} footer={<><button className="office-secondary-button" onClick={() => setRenameOpen(false)}>{t('common.cancel')}</button><button className="office-primary-button" onClick={() => mutate(() => { applyData(renameWorkbookSheet(dataRef.current, activeSheet.id, sheetNameDraft)); setRenameOpen(false); })}>{t('common.save')}</button></>}><label className="office-field"><span>{t('common.name')}</span><input className="office-input" value={sheetNameDraft} maxLength={60} onChange={(event) => setSheetNameDraft(event.target.value)} /></label></OfficeDialog>}
    {gridSettingsOpen && <OfficeDialog title={t('sheets.cellSize')} onClose={() => setGridSettingsOpen(false)} footer={<button className="office-primary-button" onClick={() => mutate(() => { if (!Number.isInteger(columnWidthDraft) || columnWidthDraft < 40 || columnWidthDraft > 320 || !Number.isInteger(rowHeightDraft) || rowHeightDraft < 20 || rowHeightDraft > 160) throw new Error('Use whole-pixel sizes within the displayed limits.'); updateActiveSheet((sheet) => ({ ...sheet, columnWidths: { ...sheet.columnWidths, [columnNumberToName(selection.active.column)]: columnWidthDraft }, rowHeights: { ...sheet.rowHeights, [String(selection.active.row)]: rowHeightDraft } })); setGridSettingsOpen(false); })}>{t('common.save')}</button>}>
      <label className="office-field"><span>{t('sheets.columnWidth')}</span><input className="office-input" type="number" min={40} max={320} value={columnWidthDraft} onChange={(event) => setColumnWidthDraft(Number(event.target.value))} /></label>
      <label className="office-field"><span>{t('sheets.rowHeight')}</span><input className="office-input" type="number" min={20} max={160} value={rowHeightDraft} onChange={(event) => setRowHeightDraft(Number(event.target.value))} /></label>
    </OfficeDialog>}
    {chartDialogOpen && <OfficeDialog title={t('sheets.addChart')} onClose={() => setChartDialogOpen(false)} footer={<><button className="office-secondary-button" onClick={() => setChartDialogOpen(false)}>{t('common.cancel')}</button><button className="office-primary-button" onClick={addChart}>{t('common.create')}</button></>}>
      <label className="office-field"><span>{t('sheets.chartTitle')}</span><input className="office-input" value={chartDraft.title} maxLength={120} onChange={(event) => setChartDraft((current) => ({ ...current, title: event.target.value }))} /></label>
      <label className="office-field"><span>{t('sheets.chartType')}</span><select className="office-input" value={chartDraft.type} onChange={(event) => setChartDraft((current) => ({ ...current, type: event.target.value as SheetChart['type'] }))}><option value="bar">Bar</option><option value="line">Line</option><option value="pie">Pie</option></select></label>
      <div className="sheets-chart-range-fields"><label className="office-field"><span>{t('sheets.startCell')}</span><input className="office-input" value={chartDraft.startCell} maxLength={7} onChange={(event) => setChartDraft((current) => ({ ...current, startCell: event.target.value }))} /></label><label className="office-field"><span>{t('sheets.endCell')}</span><input className="office-input" value={chartDraft.endCell} maxLength={7} onChange={(event) => setChartDraft((current) => ({ ...current, endCell: event.target.value }))} /></label></div>
    </OfficeDialog>}
  </div>;
}
