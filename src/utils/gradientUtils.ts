export const COURSE_COLORS = [
  '#574a7a',
  '#cd7dff',
  '#007e50',
  '#00d0ff',
  '#575dd9',
  '#6730ff',
] as const;

export const DEFAULT_COURSE_COLOR = '#574a7a';

export const getGradient = (color: string): string =>
  `linear-gradient(135deg, ${color}, ${color}aa)`;
