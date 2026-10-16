import { describe, expect, it } from 'vitest';
import { autoConvertToLatex, getQuickTypeHints } from './latexAutoConvert';

describe('autoConvertToLatex', () => {
  it('returns empty string for falsy or non-string input', () => {
    expect(autoConvertToLatex('')).toBe('');
    expect(autoConvertToLatex(null)).toBe('');
    expect(autoConvertToLatex(undefined)).toBe('');
    expect(autoConvertToLatex(42)).toBe(42);
  });

  it('converts parenthesized fractions', () => {
    expect(autoConvertToLatex('(x+1)/2')).toBe('\\frac{x+1}{2}');
    expect(autoConvertToLatex('1/(x+2)')).toBe('\\frac{1}{x+2}');
    expect(autoConvertToLatex('(x+1)/(x-1)')).toBe('\\frac{x+1}{x-1}');
  });

  it('converts simple word fractions', () => {
    expect(autoConvertToLatex('a/b')).toBe('\\frac{a}{b}');
  });

  it('converts square roots', () => {
    expect(autoConvertToLatex('sqrt(x)')).toBe('\\sqrt{x}');
    expect(autoConvertToLatex('sqrt(x+1)')).toBe('\\sqrt{x+1}');
  });

  it('converts powers and subscripts with braces', () => {
    expect(autoConvertToLatex('x^2')).toBe('x^{2}');
    expect(autoConvertToLatex('x_n')).toBe('x_{n}');
    expect(autoConvertToLatex('x^10')).toBe('x^{10}');
  });

  it('converts comparison and logic operators', () => {
    expect(autoConvertToLatex('x >= 3')).toBe('x \\geq 3');
    expect(autoConvertToLatex('x <= 3')).toBe('x \\leq 3');
    expect(autoConvertToLatex('x != 0')).toBe('x \\neq 0');
    expect(autoConvertToLatex('x <> 0')).toBe('x \\neq 0');
    expect(autoConvertToLatex('x == y')).toBe('x = y');
  });

  it('converts arrow and infinity operators', () => {
    expect(autoConvertToLatex('x ->_ y')).toBe('x \\rightarrow y');
    expect(autoConvertToLatex('x <-_ y')).toBe('x \\leftarrow y');
    expect(autoConvertToLatex('x -> oo')).toBe('x \\to \\infty');
    expect(autoConvertToLatex('n -> ...')).toBe('n \\to \\ldots');
  });

  it('converts plus-minus and multiplication operators', () => {
    expect(autoConvertToLatex('5 +/- 2')).toBe('5 \\pm 2');
    expect(autoConvertToLatex('x xx y')).toBe('x \\times y');
  });

  it('converts trig and log functions before parentheses', () => {
    expect(autoConvertToLatex('sin(x)')).toBe('\\sin(x)');
    expect(autoConvertToLatex('log(x)')).toBe('\\log(x)');
    expect(autoConvertToLatex('ln(x)')).toBe('\\ln(x)');
  });

  it('converts greek letter words', () => {
    expect(autoConvertToLatex('alpha + beta')).toBe('\\alpha + \\beta');
    expect(autoConvertToLatex('Omega')).toBe('\\Omega');
    expect(autoConvertToLatex('theta')).toBe('\\theta');
  });

  it('leaves ordinary words untouched', () => {
    expect(autoConvertToLatex('solve for x')).toBe('solve for x');
    expect(autoConvertToLatex('factor the polynomial')).toBe('factor the polynomial');
  });

  it('does not double-convert existing latex operators', () => {
    expect(autoConvertToLatex('x \\leq 3')).toBe('x \\leq 3');
    expect(autoConvertToLatex('\\frac{a}{b}')).toBe('\\frac{a}{b}');
  });

  it('converts absolute value bars', () => {
    expect(autoConvertToLatex('|x|')).toBe('\\left|x\\right|');
  });

  it('handles a combined realistic expression', () => {
    const result = autoConvertToLatex('sqrt(x^2 + y^2) >= 5');
    expect(result).toBe('\\sqrt{x^{2} + y^{2}} \\geq 5');
  });
});

describe('getQuickTypeHints', () => {
  it('returns a non-empty array of label/example/becomes hints', () => {
    const hints = getQuickTypeHints();
    expect(Array.isArray(hints)).toBe(true);
    expect(hints.length).toBeGreaterThan(0);
    for (const hint of hints) {
      expect(hint).toHaveProperty('label');
      expect(hint).toHaveProperty('example');
      expect(hint).toHaveProperty('becomes');
    }
  });

  it('examples convert as documented', () => {
    for (const { example, becomes } of getQuickTypeHints()) {
      expect(autoConvertToLatex(example)).toBe(becomes);
    }
  });
});
