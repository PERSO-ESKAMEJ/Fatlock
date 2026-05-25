import {
  RecapFile,
  UserProfile,
  DailyLog,
  BodyComposition,
  WeeklyPhoto,
  WeeklyScore,
} from '../types';

async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function generateRecapFile(
  profile: UserProfile,
  challengeId: string,
  weekNumber: number,
  dailyLogs: DailyLog[],
  bodyCompositions: BodyComposition[],
  weeklyPhotos: WeeklyPhoto[],
  weeklyScores: WeeklyScore[]
): Promise<RecapFile> {
  const payload = {
    userId: profile.id,
    userName: profile.name,
    challengeId,
    weekNumber,
    exportedAt: new Date().toISOString(),
    profile,
    dailyLogs,
    bodyCompositions,
    weeklyPhotos,
    weeklyScores,
  };

  const checksumInput = JSON.stringify(payload);
  const checksum = await sha256(checksumInput);

  return {
    version: '1.0',
    ...payload,
    checksum,
  };
}

export function exportRecapAsFile(recap: RecapFile): void {
  const json = JSON.stringify(recap, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fatlock_recap_${recap.userName.replace(/\s+/g, '_')}_S${recap.weekNumber}_${recap.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function verifyRecapFile(recap: RecapFile): Promise<boolean> {
  const { checksum, ...rest } = recap;
  const checksumInput = JSON.stringify(rest);
  const computed = await sha256(checksumInput);
  return computed === checksum;
}

export function importRecapFromFile(file: File): Promise<RecapFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as RecapFile;
        resolve(parsed);
      } catch {
        reject(new Error('Fichier recap invalide ou corrompu.'));
      }
    };
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier.'));
    reader.readAsText(file);
  });
}
