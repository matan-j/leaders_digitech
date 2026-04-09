import { describe, it, expect } from 'vitest';
import { getGradient, COURSE_COLORS, DEFAULT_COURSE_COLOR } from './gradientUtils';

describe('getGradient', () => {
  it('returns a valid CSS linear-gradient string', () => {
    const result = getGradient('#574a7a');
    expect(result).toMatch(/^linear-gradient\(/);
  });

  it('contains the color in both stops', () => {
    const color = '#007e50';
    const result = getGradient(color);
    expect(result).toContain(color);
    expect(result).toContain(`${color}aa`);
  });

  it('works with all 6 predefined colors', () => {
    for (const color of COURSE_COLORS) {
      const result = getGradient(color);
      expect(result).toContain(color);
      expect(result).toContain(`${color}aa`);
    }
  });

  it('falls back correctly when called with the default color', () => {
    const result = getGradient(DEFAULT_COURSE_COLOR);
    expect(result).toBe(`linear-gradient(135deg, ${DEFAULT_COURSE_COLOR}, ${DEFAULT_COURSE_COLOR}aa)`);
  });

  it('uses 135deg angle', () => {
    expect(getGradient('#574a7a')).toContain('135deg');
  });
});
