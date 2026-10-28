import { describe, expect, it } from 'vitest';
import { evaluateExpression, formatCalculation } from './calculator';

describe('safe arithmetic parser', () => {
  it('respects operator precedence and parentheses', () => {
    expect(evaluateExpression('2 + 3 * 4')).toBe(14);
    expect(evaluateExpression('(2 + 3) * 4')).toBe(20);
    expect(evaluateExpression('10 / 4')).toBe(2.5);
  });

  it('supports unary signs and modulo', () => {
    expect(evaluateExpression('5 * -3')).toBe(-15);
    expect(evaluateExpression('-2 + +5')).toBe(3);
    expect(evaluateExpression('10 % 3')).toBe(1);
  });

  it('rejects malformed or non-arithmetic input', () => {
    expect(() => evaluateExpression('2 +')).toThrow();
    expect(() => evaluateExpression('(2 + 3')).toThrow('closing parenthesis');
    expect(() => evaluateExpression('2; alert(1)')).toThrow();
    expect(() => evaluateExpression('window.location')).toThrow();
    expect(() => evaluateExpression('1 / 0')).toThrow('divide by zero');
  });

  it('formats floating point results without excessive precision', () => {
    expect(formatCalculation(evaluateExpression('0.1 + 0.2'))).toBe('0.3');
  });
});
