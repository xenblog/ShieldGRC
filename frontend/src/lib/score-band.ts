import { ScoreBand } from './types';

export const BAND_BG_CLASS: Record<ScoreBand, string> = {
  LOW: 'bg-emerald-500',
  MEDIUM: 'bg-amber-500',
  HIGH: 'bg-orange-500',
  CRITICAL: 'bg-red-600',
};

export const BAND_TEXT_CLASS: Record<ScoreBand, string> = {
  LOW: 'text-emerald-700',
  MEDIUM: 'text-amber-700',
  HIGH: 'text-orange-700',
  CRITICAL: 'text-red-700',
};

export const BAND_LABEL: Record<ScoreBand, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};
