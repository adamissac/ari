import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(path.resolve(import.meta.dirname, '../../app/globals.css'), 'utf8');

const token = (name: string) => {
  const m = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token ${name} missing`);
  return m[1]!;
};
const lum = (hex: string) => {
  const c = [1, 3, 5]
    .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const over = (opacity: number, fg: string, bg: string) =>
  '#' +
  [1, 3, 5]
    .map(i => Math.round(opacity * parseInt(fg.slice(i, i + 2), 16) + (1 - opacity) * parseInt(bg.slice(i, i + 2), 16)))
    .map(v => v.toString(16).padStart(2, '0'))
    .join('');

describe('WCAG contrast of design tokens', () => {
  it('theme text and controls meet contrast on obsidian and slate', () => {
    for (const surface of [token('bg'), token('panel'), token('panel-2')]) {
      expect(ratio(token('ink'), surface)).toBeGreaterThanOrEqual(7);
      expect(ratio(token('muted'), surface)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(token('faint'), surface)).toBeGreaterThanOrEqual(4.5);
    }
    expect(ratio(token('control'), token('panel'))).toBeGreaterThanOrEqual(3);
    expect(ratio(token('on-brand'), token('brand'))).toBeGreaterThanOrEqual(7);
  });

  it('night tokens (every page but the landing) keep text and controls readable', () => {
    const block = css.slice(css.indexOf(':root:not(:has(.hero-full)) {'));
    const night = (name: string) => {
      const m = block.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
      if (!m) throw new Error(`night token ${name} missing`);
      return m[1]!;
    };
    for (const surface of [night('bg'), night('panel'), night('panel-2')]) {
      expect(ratio(night('ink'), surface)).toBeGreaterThanOrEqual(7);
      expect(ratio(night('muted'), surface)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(night('faint'), surface)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(night('ember'), surface)).toBeGreaterThanOrEqual(4.5);
      for (const status of ['ok', 'warn', 'bad', 'info']) expect(ratio(night(status), surface)).toBeGreaterThanOrEqual(4.5);
    }
    expect(ratio(night('control'), night('panel'))).toBeGreaterThanOrEqual(3);
    expect(lum(night('faint'))).toBeLessThan(lum(night('muted')));
    // The landing keeps its own palette: night applies only where there is no full hero.
    expect(css).toContain(':root:not(:has(.hero-full)) {');
  });

  it('disables animate-pulse under prefers-reduced-motion', () => {
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{[^}]*\.animate-pulse\s*\{\s*animation:\s*none/);
  });

  it('keeps the headline core above 4.5:1 on the hero background', () => {
    const rule = [...css.matchAll(/\.hero-headline \.hero-line\s*\{([^}]*)\}/g)]
      .map(match => match[1]!)
      .find(declarations => declarations.includes('color: #edf3f5;'));
    expect(rule).toContain('color: #edf3f5;');
    expect(ratio('#edf3f5', token('bg'))).toBeGreaterThanOrEqual(4.5);
    expect(rule).not.toContain('text-shadow');
  });
});

it('keeps the second-line headline readable on obsidian', () => {
  const color = css.match(/\.hero-headline \.hero-line-dim \{[^}]*color:\s*(#[0-9a-f]{6})/i)![1]!;
  expect(ratio(color, token('bg'))).toBeGreaterThanOrEqual(4.5);
});
