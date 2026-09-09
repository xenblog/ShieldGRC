import { ScoreBand } from '@/lib/types';
import { BAND_BADGE_CLASS, BAND_LABEL } from '@/lib/score-band';

/**
 * Score badge pill (see globals.css `.badge`). Mockups use it two ways:
 * a bare number in tables/lists (`score` only), or "score — Label" in
 * detail-page score rows (`score` + `showLabel`).
 */
export function BandBadge({ band, score, showLabel }: { band: ScoreBand; score: number; showLabel?: boolean }) {
  return <span className={`badge ${BAND_BADGE_CLASS[band]}`}>{showLabel ? `${score} — ${BAND_LABEL[band]}` : score}</span>;
}
