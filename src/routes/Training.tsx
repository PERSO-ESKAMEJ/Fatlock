import { useState } from 'react';
import { useProfileStore } from '../store/useProfileStore';
import { WORKOUTS } from '../constants/workouts';
import { DayType } from '../types';
import PageWrapper from '../components/layout/PageWrapper';

const CARDIO_GUIDANCE = `35-45 min de cardio à intensité modérée (zone 2 : tu peux parler mais c'est difficile).
Alternatives : vélo, elliptique, natation, HIIT 20 min (30s effort max / 30s repos × 20 séries).`;

export default function Training() {
  const profile = useProfileStore((s) => s.profile)!;
  const [activeTab, setActiveTab] = useState<'muscu_j1' | 'muscu_j2' | 'muscu_j3' | 'cardio'>('muscu_j1');
  const [expandedHome, setExpandedHome] = useState<Set<string>>(new Set());

  const tabs: { id: DayType; label: string }[] = [
    { id: 'muscu_j1', label: 'J1' },
    { id: 'muscu_j2', label: 'J2' },
    { id: 'muscu_j3', label: 'J3' },
    { id: 'cardio', label: 'Cardio' },
  ];

  const workout = WORKOUTS.find((w) => w.id === activeTab);

  return (
    <PageWrapper title="Entraînement">
      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: 'var(--panel)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className="flex-1 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all"
            style={{
              background: activeTab === tab.id ? 'var(--blue)' : 'transparent',
              color: activeTab === tab.id ? 'white' : 'var(--muted)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Cardio */}
      {activeTab === 'cardio' && (
        <div className="panel p-5">
          <h2 className="font-display text-xl uppercase tracking-wide mb-3" style={{ color: 'var(--cyan)' }}>
            Séance Cardio
          </h2>
          <p className="text-sm text-[var(--ink)] leading-relaxed whitespace-pre-line">{CARDIO_GUIDANCE}</p>
        </div>
      )}

      {/* Workout day */}
      {workout && (
        <div>
          <div className="mb-4">
            <h2 className="font-display text-xl uppercase tracking-wide" style={{ color: 'var(--blue-bright)' }}>
              {workout.label}
            </h2>
            <p className="text-xs text-[var(--muted)] mt-1">{workout.focus}</p>
          </div>

          {/* Female note */}
          {profile.sex === 'F' && workout.femaleNote && (
            <div className="panel2 p-3 mb-4 text-xs" style={{ borderLeft: '3px solid var(--cyan)', color: 'var(--cyan)' }}>
              👩 {workout.femaleNote}
            </div>
          )}

          <div className="space-y-3">
            {workout.exercises.map((ex, i) => {
              const hasHome = !!ex.homeAlternative;
              const isExpanded = expandedHome.has(`${activeTab}-${i}`);

              return (
                <div key={i} className="panel2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-bold text-sm text-[var(--ink)]">{ex.name}</div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-[var(--muted)]">
                        <span className="font-mono" style={{ color: 'var(--blue-bright)' }}>
                          {ex.sets}×{ex.reps}
                        </span>
                        <span>Repos: {ex.rest}</span>
                      </div>
                      {ex.notes && (
                        <p className="text-xs text-[var(--muted2)] mt-1 italic">{ex.notes}</p>
                      )}
                    </div>
                    {hasHome && (
                      <button
                        onClick={() =>
                          setExpandedHome((prev) => {
                            const next = new Set(prev);
                            const key = `${activeTab}-${i}`;
                            next.has(key) ? next.delete(key) : next.add(key);
                            return next;
                          })
                        }
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-all flex-shrink-0"
                        style={{
                          background: isExpanded ? 'rgba(47,123,255,0.15)' : 'var(--panel)',
                          color: isExpanded ? 'var(--blue-bright)' : 'var(--muted)',
                          border: `1px solid ${isExpanded ? 'var(--blue)' : 'var(--border)'}`,
                        }}
                      >
                        Maison {isExpanded ? '▲' : '▼'}
                      </button>
                    )}
                  </div>
                  {hasHome && isExpanded && (
                    <div
                      className="mt-2 pt-2 text-xs leading-relaxed"
                      style={{ borderTop: '1px solid var(--border)', color: 'var(--muted)' }}
                    >
                      🏠 {ex.homeAlternative}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 panel2 p-3 text-xs text-[var(--muted)]">
            Progression : <span className="text-[var(--ink)]">3×10 → 3×8 → 3×6</span> avec charge croissante sur 3 semaines.
          </div>
        </div>
      )}
    </PageWrapper>
  );
}