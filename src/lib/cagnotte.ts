export interface PrizeBreakdown {
  totalPool: number;
  first: number;
  second: number;
  third: number;
  description: string;
}

export interface VoteResult {
  userId: string;
  name: string;
  rank: number;
  prize: number;
}

export function calculatePrizePool(
  stakeAmount: number,
  participantCount: number
): PrizeBreakdown {
  const totalPool = stakeAmount * participantCount;

  let first = 0;
  let second = 0;
  let third = 0;

  if (participantCount <= 2) {
    // Pas assez de joueurs pour le podium complet — le gagnant prend tout
    first = totalPool;
  } else if (participantCount === 3) {
    // Tout le monde récupère sa mise, pas de gain
    first = stakeAmount;
    second = stakeAmount;
    third = stakeAmount;
  } else {
    // Règle principale : 4+ joueurs
    // 3e récupère sa mise ; 1er et 2e se partagent les mises des 4e et au-delà (60/40)
    const gainPool = (participantCount - 3) * stakeAmount;
    third = stakeAmount;
    first = Math.round((stakeAmount + gainPool * 0.6) * 100) / 100;
    second = Math.round((stakeAmount + gainPool * 0.4) * 100) / 100;
  }

  const description =
    participantCount <= 2
      ? `Le gagnant remporte la totalité du pot (${first.toFixed(2)} €).`
      : participantCount === 3
      ? `Tout le monde récupère sa mise (${stakeAmount.toFixed(2)} €) — aucun gain possible à 3.`
      : `1er: ${first.toFixed(2)} € · 2e: ${second.toFixed(2)} € · 3e: ${third.toFixed(2)} €`;

  return { totalPool, first, second, third, description };
}

export function distributePrizes(
  stakeAmount: number,
  results: { userId: string; name: string; finalRank: number }[]
): VoteResult[] {
  const n = results.length;
  const breakdown = calculatePrizePool(stakeAmount, n);

  return results.map((r) => {
    let prize = 0;
    if (r.finalRank === 1) prize = breakdown.first;
    else if (r.finalRank === 2) prize = breakdown.second;
    else if (r.finalRank === 3) prize = breakdown.third;
    return { userId: r.userId, name: r.name, rank: r.finalRank, prize };
  });
}

const ANIMAL_NAMES = [
  'Jaguar', 'Puma', 'Lynx', 'Panthère', 'Tigre', 'Léopard',
  'Faucon', 'Aigle', 'Condor', 'Vautour', 'Balbuzard', 'Autour',
  'Ours', 'Loup', 'Renard', 'Belette', 'Blaireau', 'Vison',
  'Requin', 'Orque', 'Barracuda', 'Espadon', 'Marlin', 'Thon',
];

export function generateAnonymousName(index: number): string {
  return ANIMAL_NAMES[index % ANIMAL_NAMES.length];
}