import { ScoreBand } from '@/lib/types';
import { BAND_BG_CLASS, BAND_LABEL } from '@/lib/score-band';

export function BandBadge({ band }: { band: ScoreBand }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white ${BAND_BG_CLASS[band]}`}
    >
      {BAND_LABEL[band]}
    </span>
  );
}
