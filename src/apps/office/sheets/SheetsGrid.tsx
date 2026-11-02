import { memo, useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent, type MouseEvent } from 'react';
import type { NovaLanguage } from '../../../types';
import { columnNumberToName, coordsToCellAddress } from '../core/spreadsheet-model/cell-address';
import { isFormulaError, WorkbookFormulaEngine } from '../core/spreadsheet-model/formula-engine';
import type { WorkbookSheet } from '../core/spreadsheet-model/workbook-model';
import { formatCellValue, isCellSelected, type CellPosition, type CellSelection } from './cell-utils';

interface SheetsGridProps {
  sheet: WorkbookSheet;
  engine: WorkbookFormulaEngine;
  language: NovaLanguage;
  selection: CellSelection;
  rowNumbers: number[];
  editingAddress: string | null;
  scrollRequest: { row: number; token: number };
  onSelectionChange: (selection: CellSelection) => void;
  onStartEdit: (address: string, replacement?: string) => void;
  onEditChange: (value: string) => void;
  onFinishEdit: () => void;
  onClear: () => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onBold: () => void;
  onItalic: () => void;
  onCopy: (event: ClipboardEvent<HTMLTableElement>, cut: boolean) => void;
  onPaste: (event: ClipboardEvent<HTMLTableElement>) => void;
}

function contrastingText(background: string | undefined): string | undefined {
  if (!background) return undefined;
  const red = Number.parseInt(background.slice(1, 3), 16);
  const green = Number.parseInt(background.slice(3, 5), 16);
  const blue = Number.parseInt(background.slice(5, 7), 16);
  return (red * 299 + green * 587 + blue * 114) / 255_000 > 0.58 ? '#172033' : '#f8fbff';
}

const CellEditor = memo(function CellEditor({ address, value, onChange, onFinish }: {
  address: string;
  value: string;
  onChange: (value: string) => void;
  onFinish: (move?: { row: number; column: number }) => void;
}) {
  const closed = useRef(false);
  const finish = (move?: { row: number; column: number }) => {
    if (closed.current) return;
    closed.current = true;
    onFinish(move);
  };
  return <input
    className="sheets-cell-editor"
    aria-label={`Edit ${address}`}
    value={value}
    maxLength={20_000}
    autoFocus
    onFocus={(event) => event.currentTarget.select()}
    onChange={(event) => onChange(event.target.value)}
    onBlur={() => finish()}
    onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); finish(); }
      else if (event.key === 'Enter') { event.preventDefault(); finish({ row: event.shiftKey ? -1 : 1, column: 0 }); }
      else if (event.key === 'Tab') { event.preventDefault(); finish({ row: 0, column: event.shiftKey ? -1 : 1 }); }
      else event.stopPropagation();
    }}
  />;
});

export default function SheetsGrid({
  sheet, engine, language, selection, rowNumbers, editingAddress, scrollRequest,
  onSelectionChange, onStartEdit, onEditChange, onFinishEdit, onClear, onSave,
  onUndo, onRedo, onBold, onItalic, onCopy, onPaste,
}: SheetsGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(480);
  const activeAddress = coordsToCellAddress(selection.active.row, selection.active.column);
  const activeCell = sheet.cells[activeAddress];

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const update = () => setViewportHeight(Math.max(160, element.clientHeight || 480));
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const rowOffsets = useMemo(() => {
    const offsets = [0];
    rowNumbers.forEach((row) => offsets.push(offsets[offsets.length - 1] + (sheet.rowHeights[String(row)] ?? 28)));
    return offsets;
  }, [rowNumbers, sheet.rowHeights]);

  useEffect(() => {
    const element = scrollRef.current;
    const index = rowNumbers.indexOf(scrollRequest.row);
    if (!element || index < 0 || !scrollRequest.token) return;
    element.scrollTop = Math.max(0, rowOffsets[index] - 32);
    setScrollTop(element.scrollTop);
  }, [scrollRequest, rowNumbers, rowOffsets]);

  useEffect(() => {
    const cell = document.getElementById(`sheet-${sheet.id}-${activeAddress}`);
    if (cell && typeof cell.scrollIntoView === 'function') cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeAddress, sheet.id]);

  const moveActive = (rowDelta: number, columnDelta: number, extend = false) => {
    const current = selection.active;
    const active = {
      row: Math.max(1, Math.min(sheet.rowCount, current.row + rowDelta)),
      column: Math.max(1, Math.min(sheet.columnCount, current.column + columnDelta)),
    };
    onSelectionChange({ anchor: extend ? selection.anchor : active, active });
  };

  const handleKeyboard = (event: KeyboardEvent<HTMLTableElement>) => {
    if (event.target !== event.currentTarget) return;
    const command = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (command && key === 'home') {
      event.preventDefault();
      onSelectionChange({ anchor: { row: 1, column: 1 }, active: { row: 1, column: 1 } });
      return;
    }
    if (command) {
      if (key === 's') { event.preventDefault(); onSave(); }
      else if (key === 'a') { event.preventDefault(); onSelectionChange({ anchor: { row: 1, column: 1 }, active: { row: sheet.rowCount, column: sheet.columnCount } }); }
      else if (key === 'z' && !event.shiftKey) { event.preventDefault(); onUndo(); }
      else if (key === 'y' || (key === 'z' && event.shiftKey)) { event.preventDefault(); onRedo(); }
      else if (key === 'b') { event.preventDefault(); onBold(); }
      else if (key === 'i') { event.preventDefault(); onItalic(); }
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      moveActive(event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0, event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0, event.shiftKey);
    } else if (event.key === 'Tab') {
      event.preventDefault();
      moveActive(0, event.shiftKey ? -1 : 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      const active = { row: command ? 1 : selection.active.row, column: 1 };
      onSelectionChange({ anchor: active, active });
    } else if (event.key === 'Enter' || event.key === 'F2') {
      event.preventDefault();
      onStartEdit(activeAddress);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      onClear();
    } else if (event.key.length === 1 && !event.altKey) {
      event.preventDefault();
      onStartEdit(activeAddress, event.key);
    }
  };

  const selectCell = (event: MouseEvent<HTMLTableCellElement>, position: CellPosition) => {
    if ((event.target as HTMLElement).closest('input, textarea, select')) return;
    event.preventDefault();
    tableRef.current?.focus({ preventScroll: true });
    onSelectionChange({ anchor: event.shiftKey ? selection.anchor : position, active: position });
  };

  const overscan = 180;
  let start = 0;
  while (start < rowNumbers.length && rowOffsets[start + 1] < scrollTop - overscan) start += 1;
  let end = start;
  while (end < rowNumbers.length && rowOffsets[end] < scrollTop + viewportHeight + overscan) end += 1;
  const visibleRows = rowNumbers.slice(start, end);
  const topSpace = rowOffsets[start] ?? 0;
  const bottomSpace = Math.max(0, rowOffsets[rowOffsets.length - 1] - (rowOffsets[end] ?? 0));
  const columns = Array.from({ length: sheet.columnCount }, (_, index) => index + 1);

  return <div ref={scrollRef} className="sheets-grid-scroll app-scroll" onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
    <table
      ref={tableRef}
      className="sheets-grid"
      role="grid"
      aria-label="Spreadsheet grid"
      aria-rowcount={sheet.rowCount + 1}
      aria-colcount={sheet.columnCount + 1}
      aria-activedescendant={`sheet-${sheet.id}-${activeAddress}`}
      tabIndex={0}
      onKeyDown={handleKeyboard}
      onCopy={(event) => onCopy(event, false)}
      onCut={(event) => onCopy(event, true)}
      onPaste={onPaste}
    >
      <colgroup><col className="sheets-row-header-column" />{columns.map((column) => <col key={column} style={{ width: sheet.columnWidths[columnNumberToName(column)] ?? 96 }} />)}</colgroup>
      <thead>
        <tr>
          <th className="sheets-corner-cell" aria-label="Select all cells" onClick={() => onSelectionChange({ anchor: { row: 1, column: 1 }, active: { row: sheet.rowCount, column: sheet.columnCount } })} />
          {columns.map((column) => <th key={column} scope="col" className={selection.active.column === column ? 'is-active-column' : ''} onClick={() => onSelectionChange({ anchor: { row: 1, column }, active: { row: sheet.rowCount, column } })}>{columnNumberToName(column)}</th>)}
        </tr>
      </thead>
      <tbody>
        {topSpace > 0 && <tr className="sheets-virtual-spacer" aria-hidden="true" style={{ height: topSpace }}><td colSpan={sheet.columnCount + 1} /></tr>}
        {visibleRows.map((row) => <tr key={row} style={{ height: sheet.rowHeights[String(row)] ?? 28 }}>
          <th scope="row" className={selection.active.row === row ? 'is-active-row' : ''} onClick={() => onSelectionChange({ anchor: { row, column: 1 }, active: { row, column: sheet.columnCount } })}>{row}</th>
          {columns.map((column) => {
            const address = coordsToCellAddress(row, column);
            const cell = sheet.cells[address];
            const value = engine.getCell(sheet.id, address);
            const format = cell?.format;
            const active = address === activeAddress;
            const selected = isCellSelected(selection, row, column);
            return <td
              id={`sheet-${sheet.id}-${address}`}
              key={address}
              aria-selected={selected}
              className={`${selected ? 'is-selected' : ''} ${active ? 'is-active' : ''} ${isFormulaError(value) ? 'has-error' : ''} ${format?.border ? 'has-border' : ''}`}
              style={{
                backgroundColor: format?.background,
                color: format?.color ?? contrastingText(format?.background),
                textAlign: format?.align ?? (typeof value === 'number' ? 'right' : 'left'),
                fontWeight: format?.bold ? 700 : undefined,
                fontStyle: format?.italic ? 'italic' : undefined,
              }}
              onMouseDown={(event) => selectCell(event, { row, column })}
              onMouseEnter={(event) => { if (!editingAddress && event.buttons === 1) onSelectionChange({ anchor: selection.anchor, active: { row, column } }); }}
              onDoubleClick={(event) => { if (!(event.target as HTMLElement).closest('input')) onStartEdit(address); }}
            >
              {editingAddress === address ? <CellEditor address={address} value={activeCell?.value ?? ''} onChange={onEditChange} onFinish={(move) => { onFinishEdit(); if (move) moveActive(move.row, move.column); }} /> : <span title={cell?.value.startsWith('=') ? cell.value : undefined}>{formatCellValue(value, format, language)}</span>}
            </td>;
          })}
        </tr>)}
        {bottomSpace > 0 && <tr className="sheets-virtual-spacer" aria-hidden="true" style={{ height: bottomSpace }}><td colSpan={sheet.columnCount + 1} /></tr>}
        {!rowNumbers.length && <tr className="sheets-no-filter-results"><td colSpan={sheet.columnCount + 1}>No rows match this filter.</td></tr>}
      </tbody>
    </table>
  </div>;
}
