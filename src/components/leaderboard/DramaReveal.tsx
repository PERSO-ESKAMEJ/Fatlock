import { useState, useEffect } from 'react';
import { MasterLeaderboard } from '../../types';
import { displayTier } from '../../lib/scoring';
import { getTierColor } from '../../constants/ranks';

interface DramaRevealProps {
  leaderboard: MasterLeaderboard;
  onClose: () => void;
}

export default function DramaReveal({ leaderboard, onClose }: DramaRevealProps) {
  const [phase, setPhase] = useState<'countdown' | 'reveal' | 'highlights'>('countdown');
  const [countdown, setCountdown] = useState(3);
  const [visibleCount, setVisibleCount] = useState(0);

  const sorted = [...leaderboard.entries].sort((a, b) => a.currentRank - b.currentRank).reverse();

  useEffect(() => {
    if (phase === 'countdown' && countdown > 0) {
      const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
    if (phase === 'countdown' && countdown === 0) {
      setTimeout(() => setPhase('reveal'), 600);
    }
  }, [phase, countdown]);

  useEffect(() => {
    if (phase === 'reveal') {
      const t = setInterval(() => {
        setVisibleCount((c) => {
          if (c >= sorted.length) {
            clearInterval(t);
            setTimeout(() => setPhase('highlights'), 800);
            return c;
          }
          return c + 1;
        });
      }, 400);
      return () => clearInterval(t);
    }
  }, [phase, sorted.length]);

  const highlights = leaderboard.weeklyHighlights;
  const biggestMover = leaderboard.entries.find((e) => e.userId === highlights.biggestMover);
  const topStreak = leaderboard.entries.find((e) => e.userId === highlights.topStreak);
  const topCred = leaderboard.entries.find((e) => e.userId === highlights.topCredibility);

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-y-auto py-8"
      style={{ background: '#04070f', backgroundImage: 'radial-gradient(ellipse at top, rgba(47,123,255,0.15) 0%, transparent 60%)' }}
    >
      {/* Countdown */}
      {phase === 'countdown' && (
        <div className="text-center">
          <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-6">
            Révélation du classement
          </div>
          {countdown > 0 ? (
            <div
              key={countdown}
              className="font-display text-[160px] leading-none"
              style={{ color: 'var(--blue-bright)', animation: 'countdown-tick 0.5s ease forwards' }}
            >
              {countdown}
            </div>
          ) : (
            <div className="font-display text-6xl" style={{ color: 'var(--cyan)' }}>
              FATLOCK
            </div>
          )}
        </div>
      )}

      {/* Reveal */}
      {(phase === 'reveal' || phase === 'highlights') && (
        <div className="w-full max-w-lg px-4">
          <div className="text-center mb-6">
            <div className="font-display text-2xl uppercase tracking-widest" style={{ color: 'var(--blue-bright)' }}>
              Classement — Semaine {leaderboard.weekNumber}
            </div>
          </div>

          <div className="space-y-2">
            {sorted.slice(0, visibleCount).map((entry, i) => {
              const delta = entry.previousRank - entry.currentRank;
              const isFirst = entry.currentRank === 1;
              const isLast = entry.currentRank === sorted.length;
              const tierColor = getTierColor(entry.tier);

              return (
                <div
                  key={entry.userId}
                  className="animate-drama-reveal panel p-4 flex items-center gap-4"
                  style={{
                    animationDelay: `0ms`,
                    borderColor: isFirst ? 'var(--gold)' : isLast ? 'var(--red)' : undefined,
                    background: isFirst ? 'rgba(255,194,61,0.06)' : isLast ? 'rgba(255,77,94,0.05)' : undefined,
                  }}
                >
                  <div
                    className="font-display text-3xl w-12 text-center"
                    style={{ color: entry.currentRank <= 3 ? 'var(--gold)' : 'var(--muted)' }}
                  >
                    #{entry.currentRank}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--ink)]">{entry.name}</span>
                      {isFirst && (
                        <span className="text-xs px-2 py-0.5 rounded font-bold uppercase" style={{ background: 'var(--gold)', color: 'var(--bg)' }}>
                          EGO DOMINANT
                        </span>
                      )}
                    </div>
                    <div className="text-xs" style={{ color: tierColor }}>
                      {displayTier(entry.tier, entry.sex)}
                    </div>
                    {isLast && (
                      <div className="text-xs font-bold mt-0.5" style={{ color: 'var(--red)' }}>
                        ⚠ DANGER ZONE —{' '}
                        {entry.sex === 'M'
                          ? 'Le mur FATLOCK approche. Réagis.'
                          : 'Tu es plus forte que ça. Réagis.'}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    {delta > 0 && <div className="text-sm font-bold" style={{ color: 'var(--green)' }}>▲{delta}</div>}
                    {delta < 0 && <div className="text-sm font-bold" style={{ color: 'var(--red)' }}>▼{Math.abs(delta)}</div>}
                    {delta === 0 && <div className="text-sm text-[var(--muted2)]">—</div>}
                    <div className="font-mono text-xs text-[var(--muted)]">{Math.round(entry.compositeScore)} pts</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Highlights */}
          {phase === 'highlights' && (
            <div className="mt-6 space-y-2 animate-fade-in">
              <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">
                Faits marquants
              </div>
              {biggestMover && (
                <div className="panel2 p-3 flex items-center gap-3">
                  <span className="text-xl">📈</span>
                  <div>
                    <div className="text-xs text-[var(--muted)]">Plus grande progression</div>
                    <div className="font-bold text-sm">{biggestMover.name}</div>
                  </div>
                </div>
              )}
              {topStreak && (
                <div className="panel2 p-3 flex items-center gap-3">
                  <span className="text-xl">🔥</span>
                  <div>
                    <div className="text-xs text-[var(--muted)]">Streak le plus long</div>
                    <div className="font-bold text-sm">{topStreak.name} — {topStreak.currentStreak} jours</div>
                  </div>
                </div>
              )}
              {topCred && (
                <div className="panel2 p-3 flex items-center gap-3">
                  <span className="text-xl">🤖</span>
                  <div>
                    <div className="text-xs text-[var(--muted)]">Meilleur score crédibilité IA</div>
                    <div className="font-bold text-sm">{topCred.name} — {topCred.weeklyCredibilityScore}/100</div>
                  </div>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full mt-4 py-3 rounded-lg font-bold uppercase tracking-widest text-sm transition-all"
                style={{ background: 'var(--blue)', color: 'white' }}
              >
                Fermer la révélation
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}