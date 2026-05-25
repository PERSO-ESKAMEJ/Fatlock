import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfileStore } from '../store/useProfileStore';
import { useLogStore } from '../store/useLogStore';
import { getCurrentWeek } from '../store/useChallengeStore';
import { calculateTargets } from '../lib/nutrition';
import { getPhotosByWeek } from '../lib/db';
import { WeeklyPhoto } from '../types';
import PageWrapper from '../components/layout/PageWrapper';
import AIAnalysisCard from '../components/weekly/AIAnalysisCard';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, BarChart, Bar,
} from 'recharts';

export default function Progress() {
  const profile = useProfileStore((s) => s.profile)!;
  const challenge = useProfileStore((s) => s.challenge)!;
  const bodyComps = useLogStore((s) => s.bodyCompositions).filter((c) => c.userId === profile.id);
  const aiResults = useLogStore((s) => s.aiResults).filter((r) => r.userId === profile.id);
  const navigate = useNavigate();
  const currentWeek = getCurrentWeek(challenge.startDate);
  const checkinDue = currentWeek >= 1 && !bodyComps.some((c) => c.weekNumber === currentWeek);
  const [photos, setPhotos] = useState<(WeeklyPhoto | null)[]>([]);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'weight' | 'body' | 'photos' | 'ai'>('weight');

  const totalWeeks = challenge.customSettings?.durationWeeks ?? 8;

  useEffect(() => {
    async function loadPhotos() {
      const loaded: (WeeklyPhoto | null)[] = [];
      for (let w = 0; w <= totalWeeks; w++) {
        const p = await getPhotosByWeek(profile.id, w);
        loaded.push(p);
      }
      setPhotos(loaded);
    }
    loadPhotos();
  }, [profile.id, totalWeeks]);

  const targets = calculateTargets(profile, profile.startWeight);

  // Weight chart
  const weightData = [
    { label: 'S0', weight: profile.startWeight, target: profile.startWeight },
    ...bodyComps.sort((a, b) => a.weekNumber - b.weekNumber).map((c) => ({
      label: `S${c.weekNumber}`,
      weight: c.weightKg,
      target: +(profile.startWeight - targets.weeklyLossKg * c.weekNumber).toFixed(1),
    })),
  ];

  // Body comp chart
  const bodyData = bodyComps.sort((a, b) => a.weekNumber - b.weekNumber).map((c) => ({
    label: `S${c.weekNumber}`,
    muscle: c.muscleMassKg,
    fat: c.fatMassKg,
  }));

  // AI credibility chart
  const aiData = aiResults.sort((a, b) => a.weekNumber - b.weekNumber).map((r) => ({
    label: `S${r.weekNumber}`,
    score: r.credibilityScore,
  }));

  const tabs = [
    { id: 'weight', label: 'Poids' },
    { id: 'body', label: 'Compo' },
    { id: 'photos', label: 'Photos' },
    { id: 'ai', label: 'IA' },
  ] as const;

  return (
    <PageWrapper title="Progression">
      {/* Check-in CTA */}
      {checkinDue && (
        <div
          className="mb-4 p-4 rounded-xl flex items-center justify-between gap-3 cursor-pointer hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg, rgba(47,123,255,0.15), rgba(0,212,255,0.1))', border: '1px solid var(--blue)' }}
          onClick={() => navigate('/checkin')}
        >
          <div>
            <div className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--blue-bright)' }}>
              Check-in Semaine {currentWeek} disponible
            </div>
            <div className="text-sm text-[var(--muted)]">Photos · Composition corporelle · Analyse IA</div>
          </div>
          <span className="text-2xl flex-shrink-0">📸</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: 'var(--panel)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
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

      {/* Weight chart */}
      {activeTab === 'weight' && (
        <div className="panel p-4">
          <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">Courbe de poids</div>
          {weightData.length < 2 ? (
            <p className="text-sm text-[var(--muted)] text-center py-8">
              Pas encore assez de données. Complète ton premier check-in.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={weightData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid stroke="rgba(27,41,74,0.4)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8 }} />
                <Line type="monotone" dataKey="weight" name="Poids réel" stroke="var(--blue-bright)" strokeWidth={2} dot={{ fill: 'var(--blue-bright)', r: 4 }} />
                <Line type="monotone" dataKey="target" name="Trajectoire cible" stroke="var(--green)" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Body comp chart */}
      {activeTab === 'body' && (
        <div className="panel p-4">
          <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">Composition corporelle</div>
          {bodyData.length < 1 ? (
            <p className="text-sm text-[var(--muted)] text-center py-8">Pas encore de données.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={bodyData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid stroke="rgba(27,41,74,0.4)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8 }} />
                <Area type="monotone" dataKey="muscle" name="Masse musculaire" stroke="var(--blue-bright)" fill="rgba(47,123,255,0.15)" strokeWidth={2} />
                <Area type="monotone" dataKey="fat" name="Masse grasse" stroke="var(--red)" fill="rgba(255,77,94,0.1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
          {bodyComps.length > 0 && (
            <div className="mt-4 space-y-2">
              {bodyComps.sort((a, b) => b.weekNumber - a.weekNumber).map((c) => (
                <div key={c.weekNumber} className="panel2 p-3 flex items-center justify-between text-sm">
                  <span className="font-mono font-bold text-[var(--muted)]">S{c.weekNumber}</span>
                  <span className="text-[var(--ink)]">{c.weightKg} kg</span>
                  <span style={{ color: 'var(--blue-bright)' }}>{c.muscleMassKg} kg muscle</span>
                  <span style={{ color: 'var(--red)' }}>{c.fatMassKg} kg graisse</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Photos gallery */}
      {activeTab === 'photos' && (
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">
            Galerie hebdomadaire
          </div>
          <div className="grid grid-cols-4 gap-2">
            {photos.map((photo, w) => (
              photo ? (
                <div
                  key={w}
                  className="aspect-square relative cursor-pointer rounded-lg overflow-hidden"
                  style={{ border: '1px solid var(--border)' }}
                  onClick={() => setExpandedWeek(expandedWeek === w ? null : w)}
                >
                  <img src={photo.frontBase64} alt={`S${w}`} className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 text-center text-[10px] font-bold py-0.5" style={{ background: 'rgba(4,7,15,0.7)', color: 'var(--muted)' }}>
                    S{w}
                  </div>
                </div>
              ) : (
                <div key={w} className="aspect-square rounded-lg flex items-center justify-center text-xs text-[var(--muted2)]" style={{ border: '1px dashed var(--border)' }}>
                  S{w}
                </div>
              )
            ))}
          </div>

          {expandedWeek !== null && photos[expandedWeek] && (
            <div className="mt-4 panel p-3">
              <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">
                Semaine {expandedWeek}
              </div>
              <div className="flex gap-2">
                {photos[expandedWeek]!.frontBase64 && (
                  <img src={photos[expandedWeek]!.frontBase64} alt="Face" className="flex-1 rounded-lg object-cover max-h-64" />
                )}
                {photos[expandedWeek]!.sideBase64 && (
                  <img src={photos[expandedWeek]!.sideBase64} alt="Profil" className="flex-1 rounded-lg object-cover max-h-64" />
                )}
                {photos[expandedWeek]!.backBase64 && (
                  <img src={photos[expandedWeek]!.backBase64} alt="Dos" className="flex-1 rounded-lg object-cover max-h-64" />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI history */}
      {activeTab === 'ai' && (
        <div className="space-y-4">
          {aiData.length > 0 && (
            <div className="panel p-4">
              <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">Scores de crédibilité</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={aiData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <CartesianGrid stroke="rgba(27,41,74,0.4)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'var(--muted)', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8 }} />
                  <Bar dataKey="score" name="Crédibilité" fill="var(--blue)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {aiResults.length === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-8">
              Aucune analyse IA disponible. L'admin déclenche l'analyse lors du sync hebdomadaire.
            </p>
          ) : (
            aiResults.sort((a, b) => b.weekNumber - a.weekNumber).map((result) => (
              <AIAnalysisCard key={result.weekNumber} result={result} showPrivate />
            ))
          )}
        </div>
      )}
    </PageWrapper>
  );
}