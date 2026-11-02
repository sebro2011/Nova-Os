import { cellAddressToCoords, coordsToCellAddress } from '../core/spreadsheet-model/cell-address';
import { formulaDisplayValue, WorkbookFormulaEngine } from '../core/spreadsheet-model/formula-engine';
import type { SheetChart, WorkbookSheet } from '../core/spreadsheet-model/workbook-model';

export interface ChartPoint { label: string; value: number }

export function getChartPoints(sheet: WorkbookSheet, chart: SheetChart, engine: WorkbookFormulaEngine): ChartPoint[] {
  const start = cellAddressToCoords(chart.startCell);
  const end = cellAddressToCoords(chart.endCell);
  const startRow = Math.min(start.row, end.row);
  const endRow = Math.max(start.row, end.row);
  const startColumn = Math.min(start.column, end.column);
  const endColumn = Math.max(start.column, end.column);
  const hasLabels = endColumn > startColumn;
  const points: ChartPoint[] = [];
  for (let row = startRow; row <= endRow && points.length < 50; row += 1) {
    const value = engine.getCell(sheet.id, coordsToCellAddress(row, hasLabels ? startColumn + 1 : startColumn));
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    const rawLabel = hasLabels ? engine.getCell(sheet.id, coordsToCellAddress(row, startColumn)) : row;
    const label = typeof rawLabel === 'number' ? String(rawLabel) : typeof rawLabel === 'string' && rawLabel ? rawLabel : formulaDisplayValue(rawLabel) || `Row ${row}`;
    points.push({ label: label.slice(0, 80), value });
  }
  return points;
}

const colors = ['#63a8ff', '#b39afa', '#55e6e0', '#f6ad55', '#f472b6', '#4ade80'];

function emptyChart(title: string) {
  return <p className="sheets-chart-empty" role="status">No numeric values in {title}.</p>;
}

function BarChart({ points, title }: { points: ChartPoint[]; title: string }) {
  if (!points.length) return emptyChart(title);
  const minimum = Math.min(0, ...points.map((point) => point.value));
  const maximum = Math.max(0, ...points.map((point) => point.value));
  const range = maximum - minimum || 1;
  const y = (value: number) => 128 - (value - minimum) / range * 112;
  const slot = 300 / points.length;
  return <svg className="sheets-chart-svg" viewBox="0 0 320 150" role="img" aria-label={title}>
    <title>{title}</title>
    <line x1="10" x2="310" y1={y(0)} y2={y(0)} className="sheets-chart-axis" />
    {points.map((point, index) => {
      const top = Math.min(y(0), y(point.value));
      const height = Math.max(1, Math.abs(y(0) - y(point.value)));
      return <rect key={`${point.label}-${index}`} x={12 + index * slot} y={top} width={Math.max(2, slot - 4)} height={height} rx="2" fill={colors[index % colors.length]}><title>{point.label}: {point.value}</title></rect>;
    })}
  </svg>;
}

function LineChart({ points, title }: { points: ChartPoint[]; title: string }) {
  if (!points.length) return emptyChart(title);
  const minimum = Math.min(...points.map((point) => point.value));
  const maximum = Math.max(...points.map((point) => point.value));
  const range = maximum - minimum || 1;
  const coordinates = points.map((point, index) => ({
    x: points.length === 1 ? 160 : 14 + index / (points.length - 1) * 292,
    y: 132 - (point.value - minimum) / range * 116,
  }));
  return <svg className="sheets-chart-svg" viewBox="0 0 320 150" role="img" aria-label={title}>
    <title>{title}</title>
    <polyline points={coordinates.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={colors[0]} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    {coordinates.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="3" fill={colors[2]}><title>{points[index].label}: {points[index].value}</title></circle>)}
  </svg>;
}

function PieChart({ points, title }: { points: ChartPoint[]; title: string }) {
  const visible = points.filter((point) => point.value > 0);
  const total = visible.reduce((sum, point) => sum + point.value, 0);
  if (!visible.length || !total) return emptyChart(title);
  let offset = 0;
  return <svg className="sheets-chart-svg" viewBox="0 0 320 150" role="img" aria-label={title}>
    <title>{title}</title>
    <g transform="translate(75 75)">
      {visible.length === 1 ? <circle r="54" fill={colors[0]}><title>{visible[0].label}: {visible[0].value}</title></circle> : visible.map((point, index) => {
        const start = offset / total * Math.PI * 2 - Math.PI / 2;
        offset += point.value;
        const end = offset / total * Math.PI * 2 - Math.PI / 2;
        const large = end - start > Math.PI ? 1 : 0;
        const path = `M 0 0 L ${Math.cos(start) * 54} ${Math.sin(start) * 54} A 54 54 0 ${large} 1 ${Math.cos(end) * 54} ${Math.sin(end) * 54} Z`;
        return <path key={`${point.label}-${index}`} d={path} fill={colors[index % colors.length]} stroke="var(--editor-bg)" strokeWidth="1"><title>{point.label}: {point.value}</title></path>;
      })}
    </g>
    {visible.slice(0, 6).map((point, index) => <g key={point.label} transform={`translate(150 ${32 + index * 18})`}><rect width="8" height="8" rx="2" fill={colors[index % colors.length]} /><text x="13" y="7" className="sheets-chart-label">{point.label.slice(0, 18)}</text></g>)}
  </svg>;
}

export default function SheetChartView({ sheet, chart, engine }: { sheet: WorkbookSheet; chart: SheetChart; engine: WorkbookFormulaEngine }) {
  const points = getChartPoints(sheet, chart, engine);
  return <div className="sheets-chart-canvas">
    {chart.type === 'bar' ? <BarChart points={points} title={chart.title} /> : chart.type === 'line' ? <LineChart points={points} title={chart.title} /> : <PieChart points={points} title={chart.title} />}
    <p>{chart.startCell}:{chart.endCell} · {points.length} numeric values</p>
  </div>;
}
