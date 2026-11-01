export function columnNameToNumber(name: string): number {
  if (!/^[A-Z]{1,2}$/.test(name)) throw new Error('Invalid column name.');
  return name.split('').reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0);
}

export function columnNumberToName(column: number): string {
  if (!Number.isInteger(column) || column < 1 || column > 52) throw new Error('Column is outside the supported range.');
  let value = column;
  let name = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

export function cellAddressToCoords(address: string): { row: number; column: number } {
  const match = /^([A-Z]{1,2})([1-9]\d{0,2})$/.exec(address);
  if (!match) throw new Error(`Invalid cell address: ${address}`);
  const row = Number(match[2]);
  const column = columnNameToNumber(match[1]);
  if (row > 500 || column > 52) throw new Error(`Cell is outside the supported grid: ${address}`);
  return { row, column };
}

export function coordsToCellAddress(row: number, column: number): string {
  if (!Number.isInteger(row) || row < 1 || row > 500) throw new Error('Row is outside the supported range.');
  return `${columnNumberToName(column)}${row}`;
}
