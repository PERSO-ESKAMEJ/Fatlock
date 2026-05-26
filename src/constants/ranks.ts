import { RankTier } from '../types';

export interface RankTierDef {
  tier: RankTier;
  minPoints: number;
  color: string;
  description: string;
}

// Seuils recalibrés sur la formule composite v2 (max théorique ≈ 810 pts en 8 semaines FLOW all-in).
// Répartition : ~10 % / 25 % / 40 % / 58 % / 75 % / 90 % du max.
export const RANK_TIERS: RankTierDef[] = [
  {
    tier: 'Corps Brut',
    minPoints: 0,
    color: '#566186',
    description: 'Le point de départ. La matière brute attend d\'être sculptée.',
  },
  {
    tier: 'En Construction',
    minPoints: 80,
    color: '#7d8db4',
    description: 'Les fondations se posent. L\'effort commence à porter ses fruits.',
  },
  {
    tier: 'Challenger',
    minPoints: 200,
    color: '#2f7bff',
    description: 'Tu défies tes limites. Le challenge prend tout son sens.',
  },
  {
    tier: 'Affûté',
    minPoints: 325,
    color: '#21e6ff',
    description: 'La discipline se voit. Le corps répond.',
  },
  {
    tier: 'Élite',
    minPoints: 470,
    color: '#ffc23d',
    description: 'Niveau supérieur atteint. Tu fais partie des meilleurs.',
  },
  {
    tier: 'Ego Manifeste',
    minPoints: 610,
    color: '#ff4d5e',
    description: 'L\'ego abdominal se manifeste. Transformation visible et assumée.',
  },
  {
    tier: 'Apex',
    minPoints: 730,
    color: '#ffffff',
    description: 'Le sommet. Rare, redoutable, irréductible.',
  },
];

export function getTierColor(tier: RankTier): string {
  return RANK_TIERS.find((t) => t.tier === tier)?.color ?? '#566186';
}

export function getTierDescription(tier: RankTier): string {
  return RANK_TIERS.find((t) => t.tier === tier)?.description ?? '';
}