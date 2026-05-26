import { useState, useEffect } from 'react';
import { useProfileStore } from '../store/useProfileStore';
import { useLogStore } from '../store/useLogStore';
import { useLeaderboardStore } from '../store/useLeaderboardStore';
import { getCurrentWeek } from '../store/useChallengeStore';
import { getWeeklyPhoto } from '../lib/db';
import { runFinalAIAnalysis } from '../lib/aiAnalysis';
import { supabase } from '../lib/supabase';
import { generateAnonymousName, distributePrizes, calculatePrizePool } from '../lib/cagnotte';
import PageWrapper from '../components/layout/PageWrapper';
import Button from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import type {
  FinalVotePackage,
  FinalTransformationCard,
  FinalAIVerdict,
  FinalResult,
  WeeklyPhoto,
} from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function credibilityFactor(avg: number): number {
  if (avg >= 75) return 1.0;
  if (avg >= 50) return 0.75;
  if (avg >= 25) return 0.5;
  return 0.25;
}

function computeResults(
  pkg: FinalVotePackage,
  entries: { userId: string; name: string; sex: import('../types').Sex; compositeScore: number }[]
): FinalResult[] {
  const totalVoters = pkg.votes.length;
  const topN = Math.max(1, Math.ceil(entries.length * 0.25));
  const topIds = new Set(
    [...entries].sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, topN).map(e => e.userId)
  );

  return pkg.cards
    .map(card => {
      const entry = entries.find(e => e.userId === card.userId);
      const voteCount = pkg.votes.filter(v => v.voteeId === card.userId).length;
      const voteScore = totalVoters > 0 ? (voteCount / totalVoters) * 100 : 0;
      const verdict = pkg.aiVerdicts?.find(v => v.userId === card.userId);
      const aiBonus = verdict?.aiBonus ?? 0;
      const hebdoBonus = topIds.has(card.userId) ? 5 : 0;
      return {
        rank: 0,
        userId: card.userId,
        name: pkg.participantNames?.[card.userId] ?? entry?.name ?? '?',
        sex: entry?.sex ?? 'M' as import('../types').Sex,
        voteCount,
        voteScore: Math.round(voteScore * 10) / 10,
        aiBonus: Math.round(aiBonus * 10) / 10,
        hebdoBonus,
        finalScore: Math.round((voteScore + aiBonus + hebdoBonus) * 10) / 10,
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

// ── Transformation card (lazy-loads photos from Storage/IndexedDB) ─────────────

function TransformationCard({
  card,
  currentWeek,
  selected,
  onSelect,
  disabled,
}: {
  card: FinalTransformationCard;
  currentWeek: number;
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  const [s0, setS0] = useState<WeeklyPhoto | null | undefined>(undefined);
  const [s8, setS8] = useState<WeeklyPhoto | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getWeeklyPhoto(card.userId, 0), getWeeklyPhoto(card.userId, currentWeek)])
      .then(([p0, p8]) => { if (!cancelled) { setS0(p0); setS8(p8); } });
    return () => { cancelled = true; };
  }, [card.userId, currentWeek]);

  const loading = s0 === undefined || s8 === undefined;

  const PhotoSlot = ({ photo, label }: { photo: WeeklyPhoto | null | undefined; label: string }) => (
    <div className="flex-1">
      <div className="text-xs text-center mb-1" style={{ color: 'var(--muted)' }}>{label}</div>
      {photo ? (
        <img
          src={photo.frontBase64}
          alt={label}
          className="w-full rounded object-cover"
          style={{ maxHeight: 220, border: label === 'Final' ? '1px solid var(--green)' : '1px solid var(--border)' }}
        />
      ) : (
        <div
          className="w-full rounded flex items-center justify-center text-xs"
          style={{ height: 160, background: 'var(--panel2)', color: 'var(--muted)', border: '1px dashed var(--border)' }}
        >
          {loading ? '…' : 'Pas de photo'}
        </div>
      )}
    </div>
  );

  return (
    <div
      className="panel p-3 transition-all"
      style={{ border: `2px solid ${selected ? 'var(--blue)' : 'transparent'}` }}
    >
      <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
        {card.anonymousId}
      </div>
      <div className="flex gap-2 items-center mb-3">
        <PhotoSlot photo={s0} label="Départ" />
        <div style={{ color: 'var(--muted)', fontSize: 18 }}>→</div>
        <PhotoSlot photo={s8} label="Final" />
      </div>
      <button
        onClick={onSelect}
        disabled={disabled || loading}
        className="w-full py-2 rounded-lg text-sm font-bold transition-all"
        style={{
          background: selected ? 'var(--blue)' : 'var(--panel2)',
          color: selected ? 'white' : 'var(--ink)',
          opacity: disabled || loading ? 0.5 : 1,
        }}
      >
        {selected ? '✓ Sélectionné' : 'Choisir cette transformation'}
      </button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function FinalVote() {
  const profile = useProfileStore(s => s.profile)!;
  const challenge = useProfileStore(s => s.challenge)!;
  const { aiResults } = useLogStore();
  const masterLeaderboard = useLeaderboardStore(s => s.masterLeaderboard);
  const { showToast } = useToast();

  const [pkg, setPkg] = useState<FinalVotePackage | null>(null);
  const [loadingPkg, setLoadingPkg] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedVotee, setSelectedVotee] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProgress, setAiProgress] = useState({ done: 0, total: 0 });
  const [revealing, setRevealing] = useState(false);

  const entries = masterLeaderboard?.entries ?? [];
  const durationWeeks = challenge.durationWeeks ?? challenge.customSettings?.durationWeeks ?? 8;
  const currentWeek = getCurrentWeek(challenge.startDate, durationWeeks);
  const sb = supabase();

  useEffect(() => { fetchPackage(); }, []);

  // ── Supabase helpers ─────────────────────────────────────────────────────────

  async function fetchPackage() {
    setLoadingPkg(true);
    try {
      if (!sb) { setLoadingPkg(false); return; }
      const { data } = await sb
        .from('final_vote_packages')
        .select('data')
        .eq('challenge_id', challenge.id)
        .single();
      if (data) setPkg(data.data as FinalVotePackage);
    } catch { /* no package yet */ } finally {
      setLoadingPkg(false);
    }
  }

  async function pushPackage(updated: FinalVotePackage) {
    if (!sb) throw new Error('Supabase non configuré');
    const { error } = await sb.from('final_vote_packages').upsert(
      { challenge_id: challenge.id, data: updated },
      { onConflict: 'challenge_id' }
    );
    if (error) throw error;
  }

  // ── Admin : générer le package ───────────────────────────────────────────────

  async function handleGeneratePackage() {
    if (entries.length === 0) { showToast('Génère d\'abord le classement dans Sync hebdo', 'error'); return; }
    setGenerating(true);
    try {
      const shuffled = [...entries].sort(() => Math.random() - 0.5);
      const cards: FinalTransformationCard[] = shuffled.map((e, i) => ({
        userId: e.userId,
        anonymousId: generateAnonymousName(i),
      }));

      const credAvgs: Record<string, number> = {};
      for (const entry of entries) {
        const userAI = aiResults.filter(r => r.userId === entry.userId);
        if (userAI.length > 0) {
          credAvgs[entry.userId] = userAI.reduce((s, r) => s + r.credibilityScore, 0) / userAI.length;
        }
      }

      const newPkg: FinalVotePackage = {
        challengeId: challenge.id,
        status: 'open',
        cards,
        votes: [],
        weeklyCredibilityAvgs: credAvgs,
        createdAt: new Date().toISOString(),
      };

      await pushPackage(newPkg);
      setPkg(newPkg);
      showToast('Vote final lancé !', 'success');
    } catch (err) {
      showToast('Erreur lors de la génération', 'error');
      console.error(err);
    } finally {
      setGenerating(false);
    }
  }

  // ── Admin : analyse IA finale ────────────────────────────────────────────────

  async function handleRunFinalAI() {
    const apiKey = challenge.anthropicApiKey;
    if (!apiKey) { showToast('Clé API Anthropic manquante (Paramètres)', 'error'); return; }
    if (!pkg) return;

    setAiLoading(true);
    setAiProgress({ done: 0, total: pkg.cards.length });
    const verdicts: FinalAIVerdict[] = [];

    for (const card of pkg.cards) {
      try {
        const [s0, s8] = await Promise.all([
          getWeeklyPhoto(card.userId, 0),
          getWeeklyPhoto(card.userId, durationWeeks),
        ]);
        if (s0 && s8) {
          const result = await runFinalAIAnalysis({ userId: card.userId, s0Photo: s0, s8Photo: s8, apiKey });
          const avgCred = pkg.weeklyCredibilityAvgs[card.userId] ?? 50;
          const adjustedScore = Math.round(result.transformationScore * credibilityFactor(avgCred));
          verdicts.push({
            userId: card.userId,
            transformationScore: result.transformationScore,
            adjustedScore,
            aiBonus: Math.round((adjustedScore - 50) * 0.15 * 10) / 10,
            analysis: result.analysis,
            generatedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error(`Analyse IA échouée pour ${card.userId}:`, err);
      }
      setAiProgress(p => ({ ...p, done: p.done + 1 }));
    }

    const updated = { ...pkg, aiVerdicts: verdicts };
    setPkg(updated); // Sauvegarde locale avant push (les verdicts ne sont pas perdus si le réseau coupe)
    try {
      await pushPackage(updated);
      showToast(`IA terminée (${verdicts.length}/${pkg.cards.length})`, 'success');
    } catch {
      showToast('IA terminée — sync Supabase échouée, relance la révélation pour repusher', 'error');
    }
    setAiLoading(false);
  }

  // ── Admin : révéler ──────────────────────────────────────────────────────────

  async function handleReveal() {
    if (!pkg) return;
    setRevealing(true);
    try {
      const participantNames: Record<string, string> = {};
      entries.forEach(e => { participantNames[e.userId] = e.name; });
      const results = computeResults(pkg, entries);
      const updated: FinalVotePackage = {
        ...pkg,
        status: 'revealed',
        participantNames,
        finalResults: results,
        revealedAt: new Date().toISOString(),
      };
      await pushPackage(updated);
      setPkg(updated);
      showToast('Résultats révélés !', 'success');
    } catch {
      showToast('Erreur lors de la révélation', 'error');
    }
    setRevealing(false);
  }

  // ── Participant : soumettre vote ─────────────────────────────────────────────

  async function handleSubmitVote() {
    if (!selectedVotee || !pkg) return;
    setSubmitting(true);
    try {
      // Refetch pour éviter d'écraser un vote concurrent
      let latestPkg = pkg;
      if (sb) {
        const { data } = await sb.from('final_vote_packages').select('data').eq('challenge_id', challenge.id).single();
        if (data) latestPkg = data.data as FinalVotePackage;
      }
      if (latestPkg.votes.find(v => v.voterId === profile.id)) {
        showToast('Vote déjà enregistré', 'error');
        setPkg(latestPkg);
        return;
      }
      const updated = {
        ...latestPkg,
        votes: [...latestPkg.votes, { voterId: profile.id, voteeId: selectedVotee, submittedAt: new Date().toISOString() }],
      };
      if (sb) await pushPackage(updated);
      setPkg(updated);
      showToast('Vote enregistré !', 'success');
    } catch {
      showToast('Erreur lors de l\'envoi du vote', 'error');
    }
    setSubmitting(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loadingPkg) {
    return (
      <PageWrapper title="Vote Final">
        <div className="text-center py-12 text-sm" style={{ color: 'var(--muted)' }}>Chargement…</div>
      </PageWrapper>
    );
  }

  // Supabase requis
  if (!sb) {
    return (
      <PageWrapper title="Vote Final">
        <div className="panel p-6 text-center">
          <div className="text-3xl mb-3">⚠️</div>
          <div className="font-bold mb-2" style={{ color: 'var(--ink)' }}>Supabase requis</div>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Le vote final nécessite Supabase pour partager les transformations et collecter les votes. Configure-le dans Paramètres.
          </p>
        </div>
      </PageWrapper>
    );
  }

  // Pas encore de package
  if (!pkg) {
    return (
      <PageWrapper title="Vote Final">
        <div className="panel p-6 text-center">
          <div className="text-4xl mb-3">🏆</div>
          <div className="font-bold mb-2" style={{ color: 'var(--ink)' }}>
            {profile.isAdmin ? 'Lancer le vote final' : 'Vote non encore ouvert'}
          </div>
          {profile.isAdmin ? (
            <>
              <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
                Chaque participant choisira la transformation S0→S8 la plus marquante. Les noms sont masqués pendant le vote.
                Assure-toi d'avoir généré le classement d'abord.
              </p>
              <Button onClick={handleGeneratePackage} loading={generating} className="w-full">
                Lancer le vote final
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
                L'admin n'a pas encore lancé le vote final. Reviens plus tard.
              </p>
              <Button variant="ghost" onClick={fetchPackage}>↻ Rafraîchir</Button>
            </>
          )}
        </div>
      </PageWrapper>
    );
  }

  // Résultats révélés
  if (pkg.status === 'revealed' && pkg.finalResults) {
    const prizes = distributePrizes(
      challenge.stakeAmount,
      pkg.finalResults.map(r => ({ userId: r.userId, name: r.name, finalRank: r.rank }))
    );
    const prizeBreak = calculatePrizePool(challenge.stakeAmount, pkg.finalResults.length);
    const medals = ['🥇', '🥈', '🥉'];

    return (
      <PageWrapper title="🏆 Résultats Finaux">
        <div className="space-y-3 mb-6">
          {pkg.finalResults.map((r, i) => {
            const prize = prizes.find(p => p.userId === r.userId);
            return (
              <div key={r.userId} className="panel p-4 flex items-center gap-3">
                <div className="text-2xl w-10 text-center flex-shrink-0">{medals[i] ?? `#${r.rank}`}</div>
                <div className="flex-1 min-w-0">
                  <div className={`font-bold truncate ${r.userId === profile.id ? 'text-[var(--blue-bright)]' : 'text-[var(--ink)]'}`}>
                    {r.name}{r.userId === profile.id && <span className="text-xs text-[var(--muted)] ml-1">(toi)</span>}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    {r.voteCount} vote{r.voteCount > 1 ? 's' : ''}
                    {r.aiBonus !== 0 && ` · IA ${r.aiBonus > 0 ? '+' : ''}${r.aiBonus}`}
                    {r.hebdoBonus > 0 && ` · Hebdo +${r.hebdoBonus}`}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold" style={{ color: 'var(--gold)' }}>{r.finalScore.toFixed(1)} pts</div>
                  {prize && prize.prize > 0 && (
                    <div className="text-sm font-bold" style={{ color: 'var(--green)' }}>+{prize.prize.toFixed(2)} €</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="panel2 p-3 text-xs text-center mb-4" style={{ color: 'var(--muted)' }}>
          {prizeBreak.description}
        </div>

        {pkg.aiVerdicts && pkg.aiVerdicts.length > 0 && (
          <div>
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>
              Analyse IA des transformations
            </div>
            <div className="space-y-2">
              {pkg.aiVerdicts.map(v => (
                <div key={v.userId} className="panel2 p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
                      {pkg.participantNames?.[v.userId] ?? '?'}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      {v.transformationScore}/100 → ajusté {v.adjustedScore} · bonus {v.aiBonus > 0 ? '+' : ''}{v.aiBonus}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>{v.analysis}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </PageWrapper>
    );
  }

  // Admin : panneau de contrôle
  if (profile.isAdmin) {
    const votedCount = pkg.votes.length;
    const totalParticipants = pkg.cards.length;
    const aiDone = (pkg.aiVerdicts?.length ?? 0) > 0;
    const votedNames = pkg.votes
      .map(v => entries.find(e => e.userId === v.voterId)?.name ?? v.voterId.slice(0, 6))
      .join(', ');

    return (
      <PageWrapper title="Vote Final — Admin">
        {/* Étape 1 */}
        <div className="panel p-4 mb-4">
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>
            Étape 1 · Collecte des votes
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ color: 'var(--ink)' }}>
              {votedCount} / {totalParticipants} ont voté
            </span>
            <Button size="sm" variant="ghost" onClick={fetchPackage}>↻</Button>
          </div>
          <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: 'var(--border)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${(votedCount / totalParticipants) * 100}%`, background: 'var(--blue)' }} />
          </div>
          {votedNames && (
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Ont voté : {votedNames}</p>
          )}
        </div>

        {/* Étape 2 */}
        <div className="panel p-4 mb-4">
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--muted)' }}>
            Étape 2 · Analyse IA finale S0→S{durationWeeks}
          </div>
          {aiDone ? (
            <div className="text-sm" style={{ color: 'var(--green)' }}>✓ IA terminée ({pkg.aiVerdicts?.length} analyses)</div>
          ) : aiLoading ? (
            <div>
              <p className="text-sm mb-2" style={{ color: 'var(--muted)' }}>
                Analyse en cours… {aiProgress.done}/{aiProgress.total}
              </p>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${(aiProgress.done / Math.max(aiProgress.total, 1)) * 100}%`, background: 'var(--gold)' }} />
              </div>
            </div>
          ) : (
            <Button onClick={handleRunFinalAI} disabled={!challenge.anthropicApiKey} className="w-full">
              {challenge.anthropicApiKey ? 'Lancer l\'analyse IA finale' : 'Clé API Anthropic requise'}
            </Button>
          )}
        </div>

        {/* Étape 3 */}
        <div className="panel p-4">
          <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
            Étape 3 · Révéler les résultats
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
            Révèle les noms et le classement final à tout le groupe. Action irréversible.
          </p>
          <Button
            variant="danger"
            className="w-full"
            onClick={handleReveal}
            loading={revealing}
            disabled={votedCount === 0}
          >
            Révéler les résultats finaux
          </Button>
        </div>
      </PageWrapper>
    );
  }

  // Participant : déjà voté
  const myVote = pkg.votes.find(v => v.voterId === profile.id);
  if (myVote) {
    const votedCard = pkg.cards.find(c => c.userId === myVote.voteeId);
    return (
      <PageWrapper title="Vote Final">
        <div className="panel p-6 text-center">
          <div className="text-4xl mb-3">✅</div>
          <div className="font-bold mb-2" style={{ color: 'var(--ink)' }}>Vote enregistré</div>
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
            Tu as voté pour <span className="font-bold" style={{ color: 'var(--ink)' }}>{votedCard?.anonymousId}</span>.
            L'admin révèlera les résultats quand tous les votes seront collectés.
          </p>
          <Button variant="ghost" onClick={fetchPackage}>↻ Rafraîchir</Button>
        </div>
      </PageWrapper>
    );
  }

  // Participant : interface de vote
  const votableCards = pkg.cards.filter(c => c.userId !== profile.id);

  return (
    <PageWrapper title="Vote Final">
      <p className="text-sm mb-5" style={{ color: 'var(--muted)' }}>
        Qui a réalisé la transformation la plus marquante ? Les noms seront révélés après la clôture.
        Tu ne peux pas voter pour toi-même.
      </p>

      <div className="space-y-4 mb-6">
        {votableCards.map(card => (
          <TransformationCard
            key={card.anonymousId}
            card={card}
            currentWeek={currentWeek}
            selected={selectedVotee === card.userId}
            onSelect={() => setSelectedVotee(card.userId)}
            disabled={submitting}
          />
        ))}
      </div>

      <Button
        className="w-full"
        onClick={handleSubmitVote}
        disabled={!selectedVotee}
        loading={submitting}
      >
        {selectedVotee
          ? `Confirmer mon vote pour ${pkg.cards.find(c => c.userId === selectedVotee)?.anonymousId}`
          : 'Sélectionne une transformation'}
      </Button>
    </PageWrapper>
  );
}
