/**
 * Small recursive-descent arithmetic parser. It deliberately accepts numbers and
 * arithmetic operators only; expressions are never passed to eval or Function.
 */
export function evaluateExpression(source: string): number {
  if (!source.trim()) throw new Error('Enter a calculation.');
  if (source.length > 200) throw new Error('Calculation is too long.');

  let position = 0;

  const skipSpaces = () => {
    while (/\s/.test(source[position] ?? '')) position += 1;
  };

  const parsePrimary = (): number => {
    skipSpaces();
    if (source[position] === '(') {
      position += 1;
      const value = parseExpression();
      skipSpaces();
      if (source[position] !== ')') throw new Error('Missing closing parenthesis.');
      position += 1;
      return value;
    }

    const start = position;
    let dots = 0;
    while (/[0-9.]/.test(source[position] ?? '')) {
      if (source[position] === '.') dots += 1;
      if (dots > 1) throw new Error('Invalid decimal number.');
      position += 1;
    }
    if (start === position || source.slice(start, position) === '.') {
      throw new Error('Expected a number.');
    }
    const value = Number(source.slice(start, position));
    if (!Number.isFinite(value)) throw new Error('Number is not finite.');
    return value;
  };

  const parseUnary = (): number => {
    skipSpaces();
    if (source[position] === '+') {
      position += 1;
      return parseUnary();
    }
    if (source[position] === '-') {
      position += 1;
      return -parseUnary();
    }
    return parsePrimary();
  };

  const parseTerm = (): number => {
    let value = parseUnary();
    while (true) {
      skipSpaces();
      const operator = source[position];
      if (!['*', '/', '%'].includes(operator)) return value;
      position += 1;
      const right = parseUnary();
      if ((operator === '/' || operator === '%') && right === 0) {
        throw new Error('Cannot divide by zero.');
      }
      if (operator === '*') value *= right;
      if (operator === '/') value /= right;
      if (operator === '%') value %= right;
    }
  };

  const parseExpression = (): number => {
    let value = parseTerm();
    while (true) {
      skipSpaces();
      const operator = source[position];
      if (operator !== '+' && operator !== '-') return value;
      position += 1;
      const right = parseTerm();
      value = operator === '+' ? value + right : value - right;
    }
  };

  const result = parseExpression();
  skipSpaces();
  if (position !== source.length) throw new Error('Unexpected character in calculation.');
  if (!Number.isFinite(result)) throw new Error('Result is not finite.');
  return result;
}

export function formatCalculation(value: number): string {
  if (!Number.isFinite(value)) return 'Error';
  const rounded = Number.parseFloat(value.toPrecision(12));
  return String(rounded);
}
