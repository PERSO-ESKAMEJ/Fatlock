import { useState, useEffect } from 'react';
import { useProfileStore } from '../store/useProfileStore';
import { useLeaderboardStore } from '../store/useLeaderboardStore';
import { getCurrentWeek } from '../store/useChallengeStore';
import { getPhotosByWeek } from '../lib/db';
import { generateAnonymousName, distributePrizes, calculatePrizePool } from '../lib/cagnotte';
import { LeaderboardEntry, WeeklyPhoto } from '../types';
import PageWrapper from '../components/layout/PageWrapper';
import Button from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';

interface VoteCard {
  entry: LeaderboardEntry;
  anonymousName: string;
  s0Photo: WeeklyPhoto | null;
  s8Photo: WeeklyPhoto | null;
  voteRank: number | null;
}

export default function FinalVote() {
  const profile = useProfileStore((s) => s.profile)!;
  const challenge = useProfileStore((s) => s.challenge)!;
  const masterLeaderboard = useLeaderboardStore((s) => s.masterLeaderboard);
  const { showToast } = useToast();

  const currentWeek = getCurrentWeek(challenge.startDate);
  const [cards, setCards] = useState<VoteCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<ReturnType<typeof distributePrizes> | null>(null);

  useEffect(() => {
    async function buildCards() {
      if (!masterLeaderboard) { setLoading(false); return; }
      const built: VoteCard[] = [];
      masterLeaderboard.entries.forEach(async (entry, i) => {
        const s0 = await getPhotosByWeek(entry.userId, 0);
        const s8 = await getPhotosByWeek(entry.userId, 8);
        built.push({ entry, anonymousName: generateAnonymousName(i), s0Photo: s0, s8Photo: s8, voteRank: null });
        if (built.length === masterLeaderboard.entries.length) {
          setCards([...built]);
          setLoading(false);
        }
      });
      if (masterLeaderboard.entries.length === 0) setLoading(false);
    }
    buildCards();
  }, [masterLeaderboard]);

  function setVoteRank(userId: string, rank: number) {
    setCards((prev) =>
      prev.map((c) => {
        if (c.entry.userId === userId) return { ...c, voteRank: rank };
        if (c.voteRank === rank && c.entry.userId !== userId) return { ...c, voteRank: null };
        return c;
      })
    );
  }

  function handleSubmitVotes() {
    const withoutSelf = cards.filter((c) => c.entry.userId !== profile.id);
    const allRanked = withoutSelf.every((c) => c.voteRank !== null);
    if (!allRanked) { showToast('Classe tous les participants', 'error'); return; }

    const voteBlob = {
      voterId: profile.id,
      votes: withoutSelf.map((c) => ({ userId: c.entry.userId, rank: c.voteRank! })),
    };
    const blob = new Blob([JSON.stringify(voteBlob)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fatlock-vote-${profile.name.toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSubmitted(true);
    showToast('Vote exporté ! Envoie-le à l\'admin.', 'success');
  }

  function handleTallyVotes(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    Promise.all(files.map((f) => f.text().then(JSON.parse))).then((votes) => {
      // Tally: sum vote ranks per userId (lower = better)
      const tally: Record<string, number> = {};
      const entries = masterLeaderboard?.entries ?? [];
      entries.forEach((e) => { tally[e.userId] = 0; });

      for (const vote of votes) {
        for (const v of vote.votes ?? []) {
          tally[v.userId] = (tally[v.userId] ?? 0) + v.rank;
        }
      }

      const ranked = entries
        .map((e, i) => ({ userId: e.userId, name: e.name, finalRank: 0, score: tally[e.userId] ?? 999 }))
        .sort((a, b) => a.score - b.score)
        .map((e, i) => ({ ...e, finalRank: i + 1 }));

      const prizes = distributePrizes(challenge.stakeAmount, ranked);
      setResults(prizes);
      showToast('Résultats calculés !', 'success');
    });
  }

  if (currentWeek < 8) {
    return (
      <PageWrapper title="Vote Final">
        <div className="panel p-6 text-center">
          <div className="text-4xl mb-3">🔒</div>
          <div className="font-bold text-[var(--ink)] mb-1">Vote disponible à la semaine 8</div>
          <p className="text-sm text-[var(--muted)]">
            Il reste <span className="font-bold text-[var(--ink)]">{8 - currentWeek} semaine(s)</span> avant le vote final.
          </p>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Vote Final">
      <p className="text-sm text-[var(--muted)] mb-5">
        Compare les transformations anonymisées et classe les participants du meilleur au moins bon.
        Tu ne peux pas voter pour toi-même.
      </p>

      {loading && <div className="text-center text-[var(--muted)] py-10">Chargement des photos...</div>}

      {!loading && cards.length === 0 && (
        <div className="panel p-6 text-center">
          <p className="text-[var(--muted)]">Aucun participant à comparer. Assure-toi que l'admin a synchronisé la semaine 8.</p>
        </div>
      )}

      {!submitted && !loading && cards.length > 0 && (
        <div className="space-y-4">
          {cards
            .filter((c) => c.entry.userId !== profile.id)
            .map((card, i) => (
              <div key={card.entry.userId} className="panel p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-bold text-[var(--ink)]">Participant {card.anonymousName}</div>
                  <select
                    value={card.voteRank ?? ''}
                    onChange={(e) => setVoteRank(card.entry.userId, parseInt(e.target.value))}
                    style={{ width: 80 }}
                  >
                    <option value="">Rang</option>
                    {cards.filter((c) => c.entry.userId !== profile.id).map((_, j) => (
                      <option key={j + 1} value={j + 1}>{j + 1}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3">
                  {card.s0Photo ? (
                    <div className="flex-1">
                      <div className="text-xs text-[var(--muted)] mb-1 text-center">Avant (S0)</div>
                      <img src={card.s0Photo.frontBase64} alt="S0" className="w-full aspect-square object-cover rounded-lg" style={{ border: '1px solid var(--border)' }} />
                    </div>
                  ) : (
                    <div className="flex-1 aspect-square rounded-lg flex items-center justify-center text-xs text-[var(--muted2)]" style={{ border: '1px dashed var(--border)' }}>S0 manquant</div>
                  )}
                  {card.s8Photo ? (
                    <div className="flex-1">
                      <div className="text-xs text-[var(--muted)] mb-1 text-center">Après (S8)</div>
                      <img src={card.s8Photo.frontBase64} alt="S8" className="w-full aspect-square object-cover rounded-lg" style={{ border: '1px solid var(--green)' }} />
                    </div>
                  ) : (
                    <div className="flex-1 aspect-square rounded-lg flex items-center justify-center text-xs text-[var(--muted2)]" style={{ border: '1px dashed var(--border)' }}>S8 manquant</div>
                  )}
                </div>
              </div>
            ))}

          <Button className="w-full" onClick={handleSubmitVotes}>
            Soumettre mon vote
          </Button>
        </div>
      )}

      {submitted && !results && (
        <div className="space-y-4">
          <div className="panel p-5 text-center">
            <div className="text-4xl mb-2">✅</div>
            <div className="font-bold">Vote soumis !</div>
            <p className="text-sm text-[var(--muted)] mt-1">Attends que l'admin collecte tous les votes pour révéler les résultats.</p>
          </div>
          {profile.isAdmin && (
            <div className="panel p-4">
              <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">Admin — Comptabiliser les votes</div>
              <input type="file" accept=".json" multiple onChange={handleTallyVotes} />
            </div>
          )}
        </div>
      )}

      {results && (
        <div className="panel p-5 space-y-3">
          <div className="font-display text-xl uppercase tracking-wide text-center" style={{ color: 'var(--gold)' }}>
            Résultats du vote
          </div>
          {results.sort((a, b) => a.rank - b.rank).map((r) => (
            <div key={r.userId} className="panel2 p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="font-display text-2xl" style={{ color: r.rank <= 3 ? 'var(--gold)' : 'var(--muted)' }}>
                  #{r.rank}
                </div>
                <div className="font-bold text-[var(--ink)]">{r.name}</div>
              </div>
              <div className="font-mono font-bold" style={{ color: r.prize > 0 ? 'var(--green)' : 'var(--muted)' }}>
                {r.prize > 0 ? `+${r.prize.toFixed(2)} €` : '—'}
              </div>
            </div>
          ))}
          <div className="text-xs text-center text-[var(--muted)] pt-2">
            {calculatePrizePool(challenge.stakeAmount, (masterLeaderboard?.entries.length ?? 1)).description}
          </div>
        </div>
      )}
    </PageWrapper>
  );
}