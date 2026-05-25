const ADJECTIVES = [
  'APEX', 'FLOW', 'BURN', 'LOCK', 'FIRE', 'EDGE', 'BOLT', 'IRON',
  'RAGE', 'CORE', 'PEAK', 'WILD',
];

function simpleHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getDailyCode(groupSecret: string, dateStr: string): string {
  const hash = simpleHash(groupSecret + dateStr);
  const word = ADJECTIVES[hash % ADJECTIVES.length];
  const num = (hash >> 4) % 99 + 1;
  return `${word}-${num.toString().padStart(2, '0')}`;
}

export function isTodaysCode(groupSecret: string, inputCode: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return getDailyCode(groupSecret, today).toUpperCase() === inputCode.toUpperCase();
}

export function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}