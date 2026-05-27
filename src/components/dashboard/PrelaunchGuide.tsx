import { useState } from 'react';
import { ChallengeConfig, UserProfile, Intensity } from '../../types';
import { getRitualsForDay } from '../../constants/rituals';
import { INTENSITY_MULTIPLIER } from '../../lib/nutrition';
import { INTENSITY_CEILING } from '../../lib/scoring';
import { useProfileStore } from '../../store/useProfileStore';

const INTENSITY_META: Record<Intensity, {
  label: string; color: string; bg: string; border: string;
  mult: string; tagline: string; dailyHabit: string;
}> = {
  safe: {
    label: 'SÛRE', color: 'var(--safe)', bg: 'rgba(47,227,154,0.07)', border: 'rgba(47,227,154,0.35)',
    mult: '×1.0', tagline: 'L\'essentiel sans excès — les bases de la transformation',
    dailyHabit: 'Sucre zéro, 2L d\'eau, 7h de sommeil, séances assurées.',
  },
  standard: {
    label: 'STANDARD', color: 'var(--standard)', bg: 'rgba(47,123,255,0.07)', border: 'rgba(47,123,255,0.35)',
    mult: '×1.4', tagline: 'Protocole complet — nutrition, discipline, zéro alcool',
    dailyHabit: 'Bases SÛRE + légumes, protéines, aucun grignotage, aucun alcool.',
  },
  flow: {
    label: 'FLOW', color: 'var(--flow)', bg: 'rgba(255,77,94,0.07)', border: 'rgba(255,77,94,0.35)',
    mult: '×2.0', tagline: 'Mode extrême — jeûne 16h, 10 000 pas, cardio quotidien',
    dailyHabit: 'Bases STANDARD + jeûne intermittent, 10k pas, dernier repas avant 20h.',
  },
};

const RITUAL_EMOJI: Record<string, string> = {
  no_refined_sugar: '🚫🍬',
  hydration_2L: '💧',
  sleep_7h: '😴',
  training_done: '💪',
  repos_active: '🚶',
  veggies_daily: '🥦',
  protein_target_met: '🥩',
  no_snacking: '🙅',
  no_alcohol: '🍷',
  no_lapse: '✅',
  intermittent_fasting: '⏰',
  no_simple_carbs_after_18: '🌙',
  steps_10k: '👟',
  last_meal_before_20: '🕗',
  cardio_extra: '🏃',
};

interface Props {
  challenge: ChallengeConfig;
  profile: UserProfile;
}

export default function PrelaunchGuide({ challenge, profile }: Props) {
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const [editingIntensity, setEditingIntensity] = useState(false);

  const durationWeeks = challenge.durationWeeks ?? challenge.customSettings?.durationWeeks ?? 8;
  const im = INTENSITY_META[profile.intensity];
  const mult = INTENSITY_MULTIPLIER[profile.intensity];
  const ceiling = INTENSITY_CEILING[profile.intensity];
  const isCustom = challenge.challengeType === 'custom';
  const customRituals = challenge.customSettings?.rituals ?? [];
  const aiEnabled = !isCustom || (challenge.customSettings?.aiAnalysisEnabled !== false);
  const trackPhotos = isCustom ? challenge.customSettings?.trackPhotos !== 'disabled' : true;

  const trainingRituals = isCustom
    ? customRituals.map(r => ({ id: r.id, label: r.label, points: r.points * 10, emoji: '•' }))
    : getRitualsForDay('muscu_j1', profile.intensity).map(r => ({
        id: r.id,
        label: profile.sex === 'F' ? r.labelF : r.labelM,
        points: r.points,
        emoji: RITUAL_EMOJI[r.id] ?? '•',
      }));

  const restRituals = isCustom ? [] : getRitualsForDay('repos', profile.intensity).map(r => ({
    id: r.id,
    label: profile.sex === 'F' ? r.labelF : r.labelM,
    points: r.points,
    emoji: RITUAL_EMOJI[r.id] ?? '•',
  }));

  const maxTrainingPts = Math.round(trainingRituals.reduce((s, r) => s + r.points, 0) * mult);
  const maxRestPts = Math.round(restRituals.reduce((s, r) => s + r.points, 0) * mult);

  return (
    <div className="space-y-4">

      {/* ── Principe ─────────────────────────────────────────────────────────── */}
      <div className="panel p-4">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">
          {isCustom ? challenge.customSettings?.description || 'Le challenge' : 'Le principe'}
        </div>
        <p className="text-sm text-[var(--ink)] leading-relaxed">
          {isCustom ? (
            <>
              <strong style={{ color: 'var(--cyan)' }}>{challenge.groupName}</strong> est un challenge personnalisé sur{' '}
              <strong>{durationWeeks} semaines</strong>. Chaque jour tu accomplir tes rituels et tu prouves que tu tiens le cap.
              À la fin, le plus régulier et le plus crédible remporte la mise.
            </>
          ) : (
            <>
              <strong style={{ color: 'var(--blue-bright)' }}>{challenge.groupName}</strong> est un challenge de transformation
              physique sur <strong>{durationWeeks} semaines</strong>. Chaque jour tu te disciplines. Chaque semaine l'IA
              vérifie que tu ne mens pas. À la fin, le plus <strong>transformé et le plus crédible</strong> remporte la mise.
            </>
          )}
        </p>
      </div>

      {/* ── Déroulé simple en 3 actes ─────────────────────────────────────── */}
      <div className="panel p-4">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">Comment ça marche</div>
        <div className="space-y-3">
          {[
            {
              step: '1', emoji: '📋',
              title: 'Chaque jour — tes rituels',
              desc: 'Tu coches ce que tu as fait dans la journée. Un code secret prouve que tu étais là. Impossible de tricher sur les dates.',
            },
            {
              step: '2', emoji: '📸',
              title: 'Chaque semaine — le check-in',
              desc: `Tu te pèses${trackPhotos ? ', tu prends une photo' : ''} et tu soumets tes mesures. ${aiEnabled ? 'L\'IA analyse la cohérence entre tes déclarations et tes photos.' : 'Tes mesures sont comparées semaine après semaine.'}`,
            },
            {
              step: '3', emoji: '🏆',
              title: 'À la fin — le classement',
              desc: 'Ton score composite tient compte de tes rituels, de ta transformation physique et de ta régularité. Le plus constant gagne.',
            },
          ].map(item => (
            <div key={item.step} className="flex items-start gap-3">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center font-display font-bold text-sm flex-shrink-0 mt-0.5"
                style={{ background: 'var(--blue)', color: 'white' }}
              >
                {item.step}
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span>{item.emoji}</span>
                  <span className="text-sm font-bold text-[var(--ink)]">{item.title}</span>
                </div>
                <p className="text-xs text-[var(--muted)] leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Ton rythme ───────────────────────────────────────────────────────── */}
      <div className="panel p-4" style={{ borderColor: im.color }}>
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">Ton rythme choisi</div>
        <div
          className="rounded-xl p-4 mb-3"
          style={{ background: im.bg, border: `1px solid ${im.border}` }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="font-display text-2xl uppercase tracking-widest" style={{ color: im.color }}>
              {im.label}
            </div>
            <div className="text-right">
              <div className="font-mono text-2xl font-bold" style={{ color: im.color }}>{im.mult}</div>
              <div className="text-xs text-[var(--muted)]">multiplicateur</div>
            </div>
          </div>
          <p className="text-sm text-[var(--muted)]">{im.tagline}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center text-xs">
          <div className="rounded-lg p-3" style={{ background: 'var(--panel2)' }}>
            <div className="font-mono font-bold text-lg" style={{ color: im.color }}>{ceiling}</div>
            <div className="text-[var(--muted)]">points max possibles</div>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'var(--panel2)' }}>
            <div className="font-mono font-bold text-lg" style={{ color: 'var(--cyan)' }}>{maxTrainingPts}</div>
            <div className="text-[var(--muted)]">pts / jour d'entraît.</div>
          </div>
        </div>
        <p className="text-xs text-[var(--muted2)] mt-3 leading-relaxed">
          Le classement est <strong className="text-[var(--ink)]">normalisé par rapport à ton plafond</strong>. Un joueur SÛRE à 100 % bat un joueur FLOW à moins de 85 %. Choisir FLOW ne garantit pas la victoire : il faut l'honorer.
        </p>

        {/* ── Sélecteur de rythme inline ── */}
        <div className="mt-4 pt-4 border-t border-[var(--border)]">
          {!editingIntensity ? (
            <button
              onClick={() => setEditingIntensity(true)}
              className="w-full py-2.5 rounded-lg text-sm font-bold transition-all hover:opacity-80"
              style={{ background: im.bg, border: `1px solid ${im.border}`, color: im.color }}
            >
              Changer de rythme →
            </button>
          ) : (
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">
                Choisis ton rythme
              </div>
              <div className="space-y-2">
                {(['safe', 'standard', 'flow'] as Intensity[]).map((opt) => {
                  const meta = INTENSITY_META[opt];
                  const selected = profile.intensity === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => { updateProfile({ intensity: opt }); setEditingIntensity(false); }}
                      className="w-full p-3 rounded-xl text-left transition-all"
                      style={{
                        background: selected ? meta.bg : 'var(--panel2)',
                        border: `2px solid ${selected ? meta.color : 'var(--border)'}`,
                      }}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-display text-base uppercase tracking-wider" style={{ color: meta.color }}>
                          {meta.label}
                        </span>
                        <span className="font-mono text-sm font-bold" style={{ color: meta.color }}>
                          {meta.mult}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--muted)]">{meta.tagline}</div>
                      {opt === 'standard' && (
                        <div className="text-xs font-bold mt-1" style={{ color: 'var(--blue-bright)' }}>★ Recommandé</div>
                      )}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setEditingIntensity(false)}
                className="mt-2 text-xs text-[var(--muted)] w-full text-center hover:text-[var(--ink)] transition-colors"
              >
                Annuler
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Rituels ──────────────────────────────────────────────────────────── */}
      <div className="panel p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">📋</span>
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Les rituels quotidiens</div>
            <div className="text-sm font-bold text-[var(--ink)]">Ce que tu dois faire pour marquer des points</div>
          </div>
        </div>

        {/* Jour d'entraînement */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--blue-bright)' }}>
              {isCustom ? 'Tous les jours' : 'Jour d\'entraînement'}
            </div>
            <div className="text-xs font-mono font-bold" style={{ color: im.color }}>max {maxTrainingPts} pts</div>
          </div>
          <div className="space-y-1.5">
            {trainingRituals.map(r => (
              <div key={r.id} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: 'var(--panel2)' }}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-base flex-shrink-0">{r.emoji}</span>
                  <span className="text-sm text-[var(--ink)] truncate">{r.label}</span>
                </div>
                <span className="font-mono text-xs font-bold ml-2 flex-shrink-0" style={{ color: im.color }}>
                  +{Math.round(r.points * mult)} pts
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Jour de repos (FATLOCK uniquement) */}
        {!isCustom && restRituals.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Jour de repos</div>
              <div className="text-xs font-mono font-bold" style={{ color: im.color }}>max {maxRestPts} pts</div>
            </div>
            <div className="space-y-1.5">
              {restRituals.map(r => (
                <div key={r.id} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: 'var(--panel2)' }}>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-base flex-shrink-0">{r.emoji}</span>
                    <span className="text-sm text-[var(--ink)] truncate">{r.label}</span>
                  </div>
                  <span className="font-mono text-xs font-bold ml-2 flex-shrink-0" style={{ color: im.color }}>
                    +{Math.round(r.points * mult)} pts
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-[var(--muted2)] mt-3 leading-relaxed">
          Les rituels sont cochés dans <strong className="text-[var(--ink)]">Rituels</strong> après avoir entré le code du jour. Chaque rituel coché accumule des points — même si tu en manques quelques-uns, ça vaut quand même d'essayer.
        </p>
      </div>

      {/* ── Score ────────────────────────────────────────────────────────────── */}
      <div className="panel p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🏆</span>
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Ton score composite</div>
            <div className="text-sm font-bold text-[var(--ink)]">3 facteurs — 1 classement</div>
          </div>
        </div>
        <div className="space-y-3">
          {[
            { pct: 50, label: 'Rituels accomplis', desc: 'Tes points ego — chaque rituel coché chaque jour.', color: 'var(--blue)' },
            { pct: 25, label: 'Transformation physique', desc: 'Perte de masse grasse + gain musculaire mesurés.', color: 'var(--cyan)' },
            { pct: 25, label: 'Régularité', desc: 'Jours validés avec le code sur la durée totale.', color: 'var(--green)' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3">
              <div className="w-9 text-right font-mono font-bold text-sm flex-shrink-0" style={{ color: item.color }}>
                {item.pct}%
              </div>
              <div className="w-24 flex-shrink-0">
                <div className="h-2 rounded-full" style={{ background: 'var(--panel2)' }}>
                  <div className="h-full rounded-full" style={{ width: `${item.pct * 2}%`, background: item.color }} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-[var(--ink)]">{item.label}</div>
                <div className="text-xs text-[var(--muted2)] leading-tight">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Check-in hebdo ───────────────────────────────────────────────────── */}
      <div className="panel p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">📸</span>
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Check-in hebdomadaire</div>
            <div className="text-sm font-bold text-[var(--ink)]">1 fois par semaine — preuve de ta transformation</div>
          </div>
        </div>
        <div className="space-y-2">
          {[
            trackPhotos && {
              emoji: '📷',
              title: 'Photo face + profil',
              desc: 'Même endroit, même lumière si possible. L\'IA compare semaine après semaine.',
            },
            {
              emoji: '⚖️',
              title: 'Pesée + composition corporelle',
              desc: 'Poids, masse grasse, masse musculaire. Si tu n\'as pas de balance à impédance, le poids seul suffit.',
            },
            aiEnabled && {
              emoji: '🧠',
              title: 'Analyse IA',
              desc: 'L\'IA croise tes mesures déclarées avec tes photos. Cohérent → bonus de crédibilité. Incohérent → malus.',
            },
          ].filter(Boolean).map((item) => {
            const i = item as { emoji: string; title: string; desc: string };
            return (
              <div key={i.title} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'var(--panel2)' }}>
                <span className="text-lg flex-shrink-0">{i.emoji}</span>
                <div>
                  <div className="text-sm font-bold text-[var(--ink)]">{i.title}</div>
                  <div className="text-xs text-[var(--muted)] leading-relaxed">{i.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Code du jour ─────────────────────────────────────────────────────── */}
      <div className="panel p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🔑</span>
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">Le code du jour</div>
            <div className="text-sm font-bold text-[var(--ink)]">Preuve que tu étais bien là aujourd'hui</div>
          </div>
        </div>
        <div className="flex items-center gap-4 mb-3">
          <div
            className="font-display text-3xl font-bold tracking-widest text-center px-4 py-2 rounded-xl flex-shrink-0"
            style={{ background: 'var(--panel2)', color: 'var(--cyan)', border: '1px solid var(--border)' }}
          >
            4B2K9R
          </div>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            Un code à 6 caractères différent chaque jour. Tu l'entres avant de cocher tes rituels.
          </p>
        </div>
        <div className="space-y-1.5 text-xs text-[var(--muted)]">
          <div className="flex items-start gap-2">
            <span className="text-[var(--green)] flex-shrink-0 mt-0.5">✓</span>
            <span>L'admin voit le code dans <strong className="text-[var(--ink)]">Paramètres → Challenge</strong></span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[var(--green)] flex-shrink-0 mt-0.5">✓</span>
            <span>Le code change à minuit — impossible de valider un jour passé</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[var(--green)] flex-shrink-0 mt-0.5">✓</span>
            <span>Pas de code = pas de validation = pas de points pour ce jour</span>
          </div>
        </div>
      </div>

      {/* ── Mise en jeu ──────────────────────────────────────────────────────── */}
      {challenge.stakeAmount > 0 && (
        <div
          className="p-5 rounded-xl text-center"
          style={{ background: 'rgba(255,200,0,0.07)', border: '1px solid rgba(255,200,0,0.25)' }}
        >
          <div className="text-4xl font-display font-bold mb-1" style={{ color: 'var(--gold)' }}>
            {challenge.stakeAmount} €
          </div>
          <div className="text-sm font-bold text-[var(--ink)] mb-1">Mise en jeu par personne</div>
          <div className="text-xs text-[var(--muted)] leading-relaxed">
            Le ou les gagnants remportent la cagnotte totale.
            La crédibilité compte autant que la performance.
          </div>
        </div>
      )}

      {/* ── Paramètres figés au J1 ───────────────────────────────────────────── */}
      <div
        className="p-4 rounded-xl flex items-start gap-3"
        style={{ background: 'rgba(255,200,0,0.06)', border: '1px solid rgba(255,200,0,0.25)' }}
      >
        <span className="text-xl flex-shrink-0">🔒</span>
        <div>
          <div className="text-xs font-bold mb-1.5" style={{ color: 'var(--gold)' }}>
            Figé au démarrage
          </div>
          <p className="text-xs text-[var(--muted)] leading-relaxed mb-2">
            Une fois le J1 passé, ces paramètres ne pourront plus être modifiés :
          </p>
          <ul className="text-xs text-[var(--muted)] space-y-1 mb-2">
            <li className="flex items-center gap-2">
              <span style={{ color: 'var(--red)' }}>✕</span>
              <span><strong className="text-[var(--ink)]">Rythme d'intensité</strong> (SÛRE / STANDARD / FLOW)</span>
            </li>
            <li className="flex items-center gap-2">
              <span style={{ color: 'var(--red)' }}>✕</span>
              <span><strong className="text-[var(--ink)]">Poids et taille de départ</strong> (S0 — mesures de référence)</span>
            </li>
          </ul>
          <p className="text-xs text-[var(--muted2)]">
            Le planning d'entraînement, l'âge et le nom restent modifiables à tout moment dans{' '}
            <strong className="text-[var(--ink)]">Paramètres</strong>.
          </p>
        </div>
      </div>

      {/* ── Règle d'or ───────────────────────────────────────────────────────── */}
      <div
        className="p-4 rounded-xl flex items-start gap-3"
        style={{ background: 'rgba(255,77,94,0.05)', border: '1px solid rgba(255,77,94,0.2)' }}
      >
        <span className="text-xl flex-shrink-0">⚠️</span>
        <div>
          <div className="text-xs font-bold mb-1.5" style={{ color: 'var(--red)' }}>Règle d'or</div>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            L'app n'est qu'un outil. C'est{' '}
            <strong className="text-[var(--ink)]">toi qui décides si tu joues le jeu</strong>.
            Mais l'IA vérifie — et le groupe voit. Joue pour toi, pas pour les autres.
          </p>
        </div>
      </div>

    </div>
  );
}
