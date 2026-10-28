import { useState, type KeyboardEvent } from 'react';
import { Delete, History, ShieldCheck } from 'lucide-react';
import { evaluateExpression, formatCalculation } from '../lib/calculator';

const keys = [
  ['C', '(', ')', '⌫'],
  ['7', '8', '9', '/'],
  ['4', '5', '6', '*'],
  ['1', '2', '3', '-'],
  ['0', '.', '%', '+'],
];

export default function CalculatorApp() {
  const [expression, setExpression] = useState('');
  const [display, setDisplay] = useState('0');
  const [error, setError] = useState('');
  const [history, setHistory] = useState<string[]>([]);

  const calculate = () => {
    try {
      const value = evaluateExpression(expression);
      const formatted = formatCalculation(value);
      setDisplay(formatted);
      setHistory((current) => [`${expression} = ${formatted}`, ...current].slice(0, 6));
      setExpression(formatted);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Invalid calculation.');
      setDisplay('Error');
    }
  };

  const press = (key: string) => {
    if (key === 'C') {
      setExpression(''); setDisplay('0'); setError(''); return;
    }
    if (key === '⌫') {
      setExpression((current) => current.slice(0, -1));
      setDisplay('0'); setError(''); return;
    }
    if (key === '=') { calculate(); return; }
    setExpression((current) => `${current}${key}`.slice(0, 200));
    setDisplay('0'); setError('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (/^[0-9.+\-*/()%]$/.test(event.key)) { event.preventDefault(); press(event.key); }
    if (event.key === 'Enter' || event.key === '=') { event.preventDefault(); calculate(); }
    if (event.key === 'Backspace') { event.preventDefault(); press('⌫'); }
    if (event.key === 'Escape') { event.preventDefault(); press('C'); }
  };

  return (
    <div className="app-scroll h-full overflow-y-auto bg-gradient-to-b from-white/[0.02] to-transparent p-4 outline-none" onKeyDown={onKeyDown} tabIndex={0}>
      <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center">
        <div className="rounded-2xl border border-ink/[0.07] bg-black/20 p-4 text-right shadow-inner">
          <div className="flex items-center justify-between text-left"><span className="eyebrow">CALCULATOR</span><ShieldCheck size={13} className="text-emerald-300/50" /></div>
          <p className="mt-4 min-h-5 truncate text-xs text-ink/35" title={expression}>{expression || 'Ready'}</p>
          <output className={`mt-1 block overflow-x-auto whitespace-nowrap py-1 text-4xl font-light tabular-nums ${error ? 'text-red-300' : 'text-ink/90'}`} aria-live="polite">{display}</output>
          <p className={`mt-2 min-h-4 text-left text-[10px] ${error ? 'text-red-300/80' : 'text-ink/25'}`}>{error || 'Arithmetic only · % means modulo'}</p>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {keys.flat().map((key) => (
            <button
              key={key}
              className={`flex h-12 items-center justify-center rounded-xl border text-sm font-medium transition-colors ${key === 'C' || key === '⌫' ? 'border-ink/[0.06] bg-ink/[0.035] text-ink/55 hover:bg-ink/[0.07]' : ['/', '*', '-', '+', '%'].includes(key) ? 'border-[rgba(var(--accent-rgb),0.15)] bg-[rgba(var(--accent-rgb),0.09)] accent-text hover:bg-[rgba(var(--accent-rgb),0.16)]' : 'border-ink/[0.07] bg-ink/[0.045] text-ink/80 hover:bg-ink/[0.085]'}`}
              onClick={() => press(key)}
              aria-label={key === '⌫' ? 'Backspace' : key === 'C' ? 'Clear calculator' : key}
            >{key === '⌫' ? <Delete size={17} /> : key}</button>
          ))}
          <button className="nova-button col-span-4 h-12 text-base" onClick={calculate}>=</button>
        </div>
        {history.length > 0 && <details className="mt-3 rounded-xl border border-ink/[0.055] px-3 py-2 text-[10px] text-ink/35"><summary className="flex cursor-pointer items-center gap-2"><History size={12} /> Recent calculations</summary><div className="mt-2 space-y-1.5">{history.map((item, index) => <button key={`${item}-${index}`} className="block w-full truncate text-right hover:text-ink/60" onClick={() => { const result = item.split(' = ').pop() ?? ''; setExpression(result); setDisplay(result); }}>{item}</button>)}</div></details>}
        <p className="mt-3 text-center text-[9px] text-ink/20">Keyboard supported · no eval or code execution</p>
      </div>
    </div>
  );
}
