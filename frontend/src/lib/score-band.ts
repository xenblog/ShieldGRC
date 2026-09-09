import { ScoreBand } from './types';

export const BAND_LABEL: Record<ScoreBand, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

/** Maps to the `badge`/`status` pill classes in globals.css. */
export const BAND_BADGE_CLASS: Record<ScoreBand, string> = {
  LOW: 'badge-low',
  MEDIUM: 'badge-medium',
  HIGH: 'badge-high',
  CRITICAL: 'badge-critical',
};

/** Solid legend-dot colors (score-legend, matrix legend). */
export const BAND_DOT_COLOR: Record<ScoreBand, string> = {
  LOW: '#ACB0A2',
  MEDIUM: '#FED37A',
  HIGH: '#6B5849',
  CRITICAL: '#AD1922',
};

const BAND_RGB: Record<ScoreBand, string> = {
  LOW: '80,99,77', // Dagrofa Groent
  MEDIUM: '254,211,122', // Dagrofa Surt
  HIGH: '107,88,73', // Dagrofa Umami
  CRITICAL: '173,25,34', // Dagrofa Rod
};

const BAND_TEXT_COLOR: Record<ScoreBand, string> = {
  LOW: '#28331f',
  MEDIUM: '#6b5100',
  HIGH: '#3d2e1f',
  CRITICAL: '#ffffff',
};

/** Constant per-band tint for the Risk Register's static Likelihood x Impact matrix cells. */
const MATRIX_CELL_ALPHA: Record<ScoreBand, number> = {
  LOW: 0.15,
  MEDIUM: 0.3,
  HIGH: 0.22,
  CRITICAL: 0.18,
};

export function matrixCellBackground(band: ScoreBand): string {
  return `rgba(${BAND_RGB[band]},${MATRIX_CELL_ALPHA[band]})`;
}

/** Heat-grid cells scale tint intensity with count, matching the dashboard's org-unit x band heat map. */
export function heatCellStyle(band: ScoreBand, count: number, maxCount: number): { background: string; color: string } {
  if (count === 0) {
    return { background: '#F6F6F6', color: '#9ca3af' };
  }
  const ratio = maxCount > 0 ? count / maxCount : 0;
  const minAlpha = band === 'CRITICAL' ? 0.45 : 0.14;
  const maxAlpha = band === 'CRITICAL' ? 0.9 : 0.4;
  const alpha = minAlpha + ratio * (maxAlpha - minAlpha);
  return { background: `rgba(${BAND_RGB[band]},${alpha.toFixed(2)})`, color: BAND_TEXT_COLOR[band] };
}
