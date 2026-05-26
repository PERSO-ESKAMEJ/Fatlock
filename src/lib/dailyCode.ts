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

function getLocalDateStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isTodaysCode(groupSecret: string, inputCode: string): boolean {
  return getDailyCode(groupSecret, getLocalDateStr()).toUpperCase() === inputCode.toUpperCase();
}

export function getTodayStr(): string {
  return getLocalDateStr();
}