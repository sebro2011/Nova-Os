import { cellAddressToCoords, coordsToCellAddress } from './cell-address';
import type { WorkbookDocument, WorkbookSheet } from './workbook-model';

export type FormulaErrorCode = '#DIV/0!' | '#REF!' | '#NAME?' | '#VALUE!' | '#CYCLE!' | '#LIMIT!' | '#NUM!';
export interface FormulaError { type: 'error'; code: FormulaErrorCode }
export type FormulaValue = number | string | boolean | null | FormulaError;

const error = (code: FormulaErrorCode): FormulaError => ({ type: 'error', code });
export const isFormulaError = (value: FormulaValue): value is FormulaError => typeof value === 'object' && value !== null && 'type' in value && value.type === 'error';

interface Token { type: 'number' | 'string' | 'word' | 'sheet' | 'cell' | 'error' | 'operator' | 'left' | 'right' | 'comma' | 'colon' | 'bang' | 'end'; value: string }
type Node =
  | { kind: 'literal'; value: number | string | boolean }
  | { kind: 'error'; code: FormulaErrorCode }
  | { kind: 'reference'; sheet?: string; address: string }
  | { kind: 'range'; sheet?: string; start: string; end: string }
  | { kind: 'function'; name: string; args: Node[] }
  | { kind: 'unary'; operator: string; value: Node }
  | { kind: 'binary'; operator: string; left: Node; right: Node }
  | { kind: 'percent'; value: Node };

function lex(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < input.length) {
    const rest = input.slice(index);
    const whitespace = /^\s+/.exec(rest);
    if (whitespace) { index += whitespace[0].length; continue; }
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(rest);
    if (number) { tokens.push({ type: 'number', value: number[0] }); index += number[0].length; continue; }
    const cell = /^(\$?[A-Za-z]{1,2}\$?[1-9]\d{0,2})(?![A-Za-z0-9_])/.exec(rest);
    if (cell) { tokens.push({ type: 'cell', value: cell[1].replace(/\$/g, '').toUpperCase() }); index += cell[1].length; continue; }
    const word = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(rest);
    if (word) { tokens.push({ type: 'word', value: word[0] }); index += word[0].length; continue; }
    const formulaError = /^#(?:DIV\/0!|REF!|NAME\?|VALUE!|CYCLE!|LIMIT!|NUM!)/.exec(rest);
    if (formulaError) { tokens.push({ type: 'error', value: formulaError[0] }); index += formulaError[0].length; continue; }
    const char = input[index];
    if (char === '"') {
      let value = '';
      let end = index + 1;
      let closed = false;
      while (end < input.length) {
        if (input[end] === '"') {
          if (input[end + 1] === '"') { value += '"'; end += 2; continue; }
          closed = true;
          end += 1;
          break;
        }
        value += input[end];
        end += 1;
      }
      if (!closed) throw new Error('Unclosed string');
      tokens.push({ type: 'string', value });
      index = end;
      continue;
    }
    if (char === "'") {
      let value = '';
      let end = index + 1;
      let closed = false;
      while (end < input.length) {
        if (input[end] === "'") {
          if (input[end + 1] === "'") { value += "'"; end += 2; continue; }
          closed = true;
          end += 1;
          break;
        }
        value += input[end];
        end += 1;
      }
      if (!closed) throw new Error('Unclosed sheet name');
      tokens.push({ type: 'sheet', value });
      index = end;
      continue;
    }
    const two = input.slice(index, index + 2);
    if (['<>', '<=', '>='].includes(two)) { tokens.push({ type: 'operator', value: two }); index += 2; continue; }
    if ('+-*/^=<>&%'.includes(char)) { tokens.push({ type: 'operator', value: char }); index += 1; continue; }
    if (char === '(') tokens.push({ type: 'left', value: char });
    else if (char === ')') tokens.push({ type: 'right', value: char });
    else if (char === ',') tokens.push({ type: 'comma', value: char });
    else if (char === ':') tokens.push({ type: 'colon', value: char });
    else if (char === '!') tokens.push({ type: 'bang', value: char });
    else throw new Error(`Unsupported formula character: ${char}`);
    index += 1;
  }
  tokens.push({ type: 'end', value: '' });
  return tokens;
}

class Parser {
  private index = 0;
  private readonly tokens: Token[];
  constructor(input: string) { this.tokens = lex(input); }
  private peek(type?: Token['type'], value?: string): boolean {
    const token = this.tokens[this.index];
    return (!type || token.type === type) && (!value || token.value.toUpperCase() === value.toUpperCase());
  }
  private take(): Token { return this.tokens[this.index++]; }
  private expect(type: Token['type'], value?: string): Token {
    if (!this.peek(type, value)) throw new Error('Invalid formula syntax');
    return this.take();
  }
  parse(): Node {
    const result = this.comparison();
    if (!this.peek('end')) throw new Error('Unexpected formula content');
    return result;
  }
  private comparison(): Node {
    let left = this.concat();
    while (this.peek('operator') && ['=', '<>', '<', '<=', '>', '>='].includes(this.tokens[this.index].value)) {
      const operator = this.take().value;
      left = { kind: 'binary', operator, left, right: this.concat() };
    }
    return left;
  }
  private concat(): Node {
    let left = this.additive();
    while (this.peek('operator', '&')) {
      this.take();
      left = { kind: 'binary', operator: '&', left, right: this.additive() };
    }
    return left;
  }
  private additive(): Node {
    let left = this.multiplicative();
    while (this.peek('operator') && ['+', '-'].includes(this.tokens[this.index].value)) {
      const operator = this.take().value;
      left = { kind: 'binary', operator, left, right: this.multiplicative() };
    }
    return left;
  }
  private multiplicative(): Node {
    let left = this.unary();
    while (this.peek('operator') && ['*', '/'].includes(this.tokens[this.index].value)) {
      const operator = this.take().value;
      left = { kind: 'binary', operator, left, right: this.unary() };
    }
    return left;
  }
  private power(): Node {
    let left = this.postfix();
    if (this.peek('operator', '^')) {
      this.take();
      left = { kind: 'binary', operator: '^', left, right: this.unary() };
    }
    return left;
  }
  private unary(): Node {
    if (this.peek('operator', '+') || this.peek('operator', '-')) return { kind: 'unary', operator: this.take().value, value: this.unary() };
    return this.power();
  }
  private postfix(): Node {
    let value = this.primary();
    while (this.peek('operator', '%')) {
      this.take();
      value = { kind: 'percent', value };
    }
    return value;
  }
  private reference(sheet?: string): Node {
    const start = this.expect('cell').value;
    cellAddressToCoords(start);
    if (this.peek('colon')) {
      this.take();
      const end = this.expect('cell').value;
      cellAddressToCoords(end);
      return { kind: 'range', sheet, start, end };
    }
    return { kind: 'reference', sheet, address: start };
  }
  private primary(): Node {
    if (this.peek('number')) return { kind: 'literal', value: Number(this.take().value) };
    if (this.peek('string')) return { kind: 'literal', value: this.take().value };
    if (this.peek('error')) return { kind: 'error', code: this.take().value as FormulaErrorCode };
    if (this.peek('cell')) return this.reference();
    if (this.peek('sheet')) {
      const sheet = this.take().value;
      this.expect('bang');
      return this.reference(sheet);
    }
    if (this.peek('word')) {
      const word = this.take().value;
      if (this.peek('bang')) {
        this.take();
        return this.reference(word);
      }
      if (word.toUpperCase() === 'TRUE') return { kind: 'literal', value: true };
      if (word.toUpperCase() === 'FALSE') return { kind: 'literal', value: false };
      this.expect('left');
      const args: Node[] = [];
      if (!this.peek('right')) {
        do {
          args.push(this.comparison());
          if (!this.peek('comma')) break;
          this.take();
        } while (true);
      }
      this.expect('right');
      return { kind: 'function', name: word.toUpperCase(), args };
    }
    if (this.peek('left')) {
      this.take();
      const value = this.comparison();
      this.expect('right');
      return value;
    }
    throw new Error('Expected a formula value');
  }
}

function scalarNumber(value: FormulaValue): number | FormulaError {
  if (isFormulaError(value)) return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : error('#NUM!');
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value === null) return 0;
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())) return Number(value);
  return error('#VALUE!');
}

function scalarText(value: FormulaValue): string | FormulaError {
  if (isFormulaError(value)) return value;
  if (value === null) return '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return String(value);
}

function scalarBoolean(value: FormulaValue): boolean | FormulaError {
  if (isFormulaError(value)) return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (value === null) return false;
  if (/^(TRUE|FALSE)$/i.test(value)) return value.toUpperCase() === 'TRUE';
  return error('#VALUE!');
}

function compareValues(left: FormulaValue, right: FormulaValue, operator: string): FormulaValue {
  if (isFormulaError(left)) return left;
  if (isFormulaError(right)) return right;
  let a: string | number | boolean = left ?? '';
  let b: string | number | boolean = right ?? '';
  if (typeof a === 'string' && typeof b === 'string') { a = a.toLocaleLowerCase(); b = b.toLocaleLowerCase(); }
  if (operator === '=') return a === b;
  if (operator === '<>') return a !== b;
  if (operator === '<') return a < b;
  if (operator === '<=') return a <= b;
  if (operator === '>') return a > b;
  return a >= b;
}

export class WorkbookFormulaEngine {
  private readonly cache = new Map<string, FormulaValue>();
  private readonly stack = new Set<string>();
  private readonly sheetsById = new Map<string, WorkbookSheet>();
  constructor(private readonly workbook: WorkbookDocument) {
    workbook.sheets.forEach((sheet) => this.sheetsById.set(sheet.id, sheet));
  }

  getCell(sheetId: string, address: string): FormulaValue {
    const key = `${sheetId}!${address}`;
    const cached = this.cache.get(key);
    if (cached !== undefined || this.cache.has(key)) return cached!;
    if (this.stack.has(key)) return error('#CYCLE!');
    if (this.stack.size > 500) return error('#LIMIT!');
    const sheet = this.sheetsById.get(sheetId);
    if (!sheet) return error('#REF!');
    let coords: { row: number; column: number };
    try { coords = cellAddressToCoords(address); } catch { return error('#REF!'); }
    if (coords.row > sheet.rowCount || coords.column > sheet.columnCount) return error('#REF!');
    const raw = sheet.cells[address]?.value ?? '';
    this.stack.add(key);
    let value: FormulaValue;
    try {
      if (raw.startsWith('=')) value = this.scalar(this.evaluateNode(new Parser(raw.slice(1)).parse(), sheetId));
      else if (raw === '') value = null;
      else if (/^(#DIV\/0!|#REF!|#NAME\?|#VALUE!|#CYCLE!|#LIMIT!|#NUM!)$/.test(raw)) value = error(raw as FormulaErrorCode);
      else if (/^(TRUE|FALSE)$/i.test(raw)) value = raw.toUpperCase() === 'TRUE';
      else if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw.trim())) value = Number(raw);
      else if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)%$/.test(raw.trim())) value = Number(raw.trim().slice(0, -1)) / 100;
      else value = raw;
    } catch {
      value = error('#VALUE!');
    }
    this.stack.delete(key);
    this.cache.set(key, value);
    return value;
  }

  evaluateFormula(sheetId: string, formula: string): FormulaValue {
    try { return this.scalar(this.evaluateNode(new Parser(formula.startsWith('=') ? formula.slice(1) : formula).parse(), sheetId)); } catch { return error('#VALUE!'); }
  }

  private sheetForReference(currentSheetId: string, name?: string): WorkbookSheet | undefined {
    if (!name) return this.sheetsById.get(currentSheetId);
    return this.workbook.sheets.find((sheet) => sheet.name.toLocaleLowerCase() === name.toLocaleLowerCase());
  }

  private evaluateNode(node: Node, currentSheetId: string): FormulaValue | FormulaValue[] {
    if (node.kind === 'literal') return node.value;
    if (node.kind === 'error') return error(node.code);
    if (node.kind === 'reference') {
      const sheet = this.sheetForReference(currentSheetId, node.sheet);
      return sheet ? this.getCell(sheet.id, node.address) : error('#REF!');
    }
    if (node.kind === 'range') {
      const sheet = this.sheetForReference(currentSheetId, node.sheet);
      if (!sheet) return error('#REF!');
      const start = cellAddressToCoords(node.start);
      const end = cellAddressToCoords(node.end);
      const minRow = Math.min(start.row, end.row);
      const maxRow = Math.max(start.row, end.row);
      const minColumn = Math.min(start.column, end.column);
      const maxColumn = Math.max(start.column, end.column);
      if ((maxRow - minRow + 1) * (maxColumn - minColumn + 1) > 5_000) return error('#LIMIT!');
      const values: FormulaValue[] = [];
      for (let row = minRow; row <= maxRow; row += 1) {
        for (let column = minColumn; column <= maxColumn; column += 1) values.push(this.getCell(sheet.id, coordsToCellAddress(row, column)));
      }
      return values;
    }
    if (node.kind === 'function') return this.evaluateFunction(node, currentSheetId);
    if (node.kind === 'percent') {
      const value = scalarNumber(this.scalar(this.evaluateNode(node.value, currentSheetId)));
      return isFormulaError(value) ? value : value / 100;
    }
    if (node.kind === 'unary') {
      const value = scalarNumber(this.scalar(this.evaluateNode(node.value, currentSheetId)));
      if (isFormulaError(value)) return value;
      return node.operator === '-' ? -value : value;
    }
    if (node.operator === '&') {
      const left = scalarText(this.scalar(this.evaluateNode(node.left, currentSheetId)));
      const right = scalarText(this.scalar(this.evaluateNode(node.right, currentSheetId)));
      return isFormulaError(left) ? left : isFormulaError(right) ? right : `${left}${right}`;
    }
    if (['=', '<>', '<', '<=', '>', '>='].includes(node.operator)) return compareValues(this.scalar(this.evaluateNode(node.left, currentSheetId)), this.scalar(this.evaluateNode(node.right, currentSheetId)), node.operator);
    const left = scalarNumber(this.scalar(this.evaluateNode(node.left, currentSheetId)));
    const right = scalarNumber(this.scalar(this.evaluateNode(node.right, currentSheetId)));
    if (isFormulaError(left)) return left;
    if (isFormulaError(right)) return right;
    if (node.operator === '+') return left + right;
    if (node.operator === '-') return left - right;
    if (node.operator === '*') return left * right;
    if (node.operator === '/') return right === 0 ? error('#DIV/0!') : left / right;
    const result = Math.pow(left, right);
    return Number.isFinite(result) ? result : error('#NUM!');
  }

  private scalar(value: FormulaValue | FormulaValue[]): FormulaValue {
    return Array.isArray(value) ? error('#VALUE!') : value;
  }

  private evaluateFunction(node: Extract<Node, { kind: 'function' }>, sheetId: string): FormulaValue {
    if (!['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'COUNTA', 'IF'].includes(node.name)) return error('#NAME?');
    if (node.name === 'IF') {
      if (node.args.length !== 3) return error('#VALUE!');
      const condition = scalarBoolean(this.scalar(this.evaluateNode(node.args[0], sheetId)));
      if (isFormulaError(condition)) return condition;
      return this.scalar(this.evaluateNode(node.args[condition ? 1 : 2], sheetId));
    }
    if (node.args.length < 1 || node.args.length > 30) return error('#VALUE!');
    const values: FormulaValue[] = [];
    for (const argument of node.args) {
      const value = this.evaluateNode(argument, sheetId);
      if (Array.isArray(value)) values.push(...value);
      else values.push(value);
    }
    if (node.name === 'COUNTA') return values.filter((value) => value !== null && value !== '').length;
    if (node.name === 'COUNT') return values.filter((value) => typeof value === 'number' && Number.isFinite(value)).length;
    const failure = values.find(isFormulaError);
    if (failure) return failure;
    const numbers = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    if (node.name === 'SUM') return numbers.reduce((total, value) => total + value, 0);
    if (node.name === 'AVERAGE') return numbers.length ? numbers.reduce((total, value) => total + value, 0) / numbers.length : error('#DIV/0!');
    if (node.name === 'MIN') return numbers.length ? Math.min(...numbers) : 0;
    return numbers.length ? Math.max(...numbers) : 0;
  }
}

export function formulaDisplayValue(value: FormulaValue): string {
  if (value === null) return '';
  if (isFormulaError(value)) return value.code;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return String(value);
}
