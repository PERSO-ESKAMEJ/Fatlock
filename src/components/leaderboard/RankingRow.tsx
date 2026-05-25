import { LeaderboardEntry } from '../../types';
import { displayTier } from '../../lib/scoring';
import { getTierColor } from '../../constants/ranks';

interface RankingRowProps {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
  animDelay?: number;
}

const INTENSITY_LABELS = { safe: 'SÛRE', standard: 'STANDARD', flow: 'FLOW' };
const INTENSITY_COLORS = { safe: 'var(--safe)', standard: 'var(--standard)', flow: 'var(--flow)' };

export default function RankingRow({ entry, isCurrentUser, animDelay = 0 }: RankingRowProps) {
  const delta = entry.previousRank - entry.currentRank;
  const tierColor = getTierColor(entry.tier);
  const tierName = displayTier(entry.tier, entry.sex);

  return (
    <div
      className={`panel2 p-3 flex items-center gap-3 transition-all ${isCurrentUser ? 'border-[var(--blue)]' : ''}`}
      style={{
        animationDelay: `${animDelay}ms`,
        borderColor: isCurrentUser ? 'var(--blue)' : undefined,
      }}
    >
      {/* Rank number */}
      <div
        className="font-display text-2xl w-10 text-center leading-none"
        style={{ color: entry.currentRank <= 3 ? 'var(--gold)' : 'var(--muted)' }}
      >
        #{entry.currentRank}
      </div>

      {/* Delta */}
      <div className="w-6 text-center">
        {delta > 0 && <span className="text-xs font-bold" style={{ color: 'var(--green)' }}>▲{delta}</span>}
        {delta < 0 && <span className="text-xs font-bold" style={{ color: 'var(--red)' }}>▼{Math.abs(delta)}</span>}
        {delta === 0 && <span className="text-xs text-[var(--muted2)]">—</span>}
      </div>

      {/* Name + tier */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold truncate ${isCurrentUser ? 'text-[var(--blue-bright)]' : 'text-[var(--ink)]'}`}>
            {entry.name}
            {isCurrentUser && <span className="text-xs text-[var(--muted)] ml-1">(toi)</span>}
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase"
            style={{ color: INTENSITY_COLORS[entry.intensity], border: `1px solid ${INTENSITY_COLORS[entry.intensity]}44` }}
          >
            {INTENSITY_LABELS[entry.intensity]}
          </span>
        </div>
        <div className="text-xs" style={{ color: tierColor }}>{tierName}</div>
      </div>

      {/* Score + streak */}
      <div className="text-right">
        <div className="font-mono text-sm font-bold text-[var(--ink)]">
          {Math.round(entry.compositeScore)}
        </div>
        <div className="flex items-center justify-end gap-1 text-xs">
          <span style={{ color: 'var(--gold)' }}>🔥</span>
          <span className="font-mono" style={{ color: 'var(--gold)' }}>{entry.currentStreak}</span>
          {entry.weeklyCredibilityScore != null && (
            <span
              className="ml-1 w-2 h-2 rounded-full inline-block"
              title={`Crédibilité: ${entry.weeklyCredibilityScore}`}
              style={{
                background:
                  entry.weeklyCredibilityScore >= 75
                    ? 'var(--green)'
                    : entry.weeklyCredibilityScore >= 50
                    ? 'var(--gold)'
                    : 'var(--red)',
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}