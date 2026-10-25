import type { Rule } from '../labs/model.js';
const normalize = (value: string) =>
  value.normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
export function validateAnswer(rule: Rule, value: string, units: string): boolean {
  if (rule.kind === 'exact') return normalize(value) === normalize(rule.expected);
  if (!value.trim() || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim()))
    return false;
  const number = Number(value);
  return (
    Number.isFinite(number) &&
    normalize(units) === normalize(rule.units) &&
    Math.abs(number - rule.expected) <=
      rule.tolerance + Number.EPSILON * Math.max(1, Math.abs(rule.expected)) * 4
  );
}
