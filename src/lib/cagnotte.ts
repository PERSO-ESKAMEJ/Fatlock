export interface PrizeBreakdown {
  totalPool: number;
  first: number;
  second: number;
  third: number;
  adminFee: number;
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
  const adminFee = Math.round(totalPool * 0.05 * 100) / 100; // 5% admin fee
  const net = totalPool - adminFee;

  let first = 0;
  let second = 0;
  let third = 0;

  if (participantCount <= 2) {
    first = net;
    second = 0;
    third = 0;
  } else if (participantCount === 3) {
    first = Math.round(net * 0.6 * 100) / 100;
    second = Math.round(net * 0.3 * 100) / 100;
    third = Math.round((net - first - second) * 100) / 100;
  } else if (participantCount <= 5) {
    first = Math.round(net * 0.5 * 100) / 100;
    second = Math.round(net * 0.3 * 100) / 100;
    third = Math.round((net - first - second) * 100) / 100;
  } else {
    first = Math.round(net * 0.45 * 100) / 100;
    second = Math.round(net * 0.3 * 100) / 100;
    third = Math.round((net - first - second) * 100) / 100;
  }

  const description =
    participantCount <= 2
      ? `Le gagnant remporte la totalité du pot (${first.toFixed(2)} €).`
      : `1er: ${first.toFixed(2)} € · 2e: ${second.toFixed(2)} € · 3e: ${third.toFixed(2)} €`;

  return { totalPool, first, second, third, adminFee, description };
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