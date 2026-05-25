import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { WeeklyPhoto } from '../types';

interface StoredPhoto extends WeeklyPhoto {
  key: string;
}

interface FatlockDB extends DBSchema {
  weeklyPhotos: {
    key: string;
    value: StoredPhoto;
    indexes: { byUser: string };
  };
}

let _db: IDBPDatabase<FatlockDB> | undefined;

async function getDB(): Promise<IDBPDatabase<FatlockDB>> {
  if (_db) return _db;
  _db = await openDB<FatlockDB>('fatlock-db', 1, {
    upgrade(db: IDBPDatabase<FatlockDB>) {
      const store = db.createObjectStore('weeklyPhotos', { keyPath: 'key' });
      store.createIndex('byUser', 'userId');
    },
  });
  return _db;
}

function photoKey(userId: string, weekNumber: number): string {
  return `${userId}_${weekNumber}`;
}

function stripKey(record: StoredPhoto): WeeklyPhoto {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { key: _k, ...photo } = record as StoredPhoto & { key: string };
  return photo as WeeklyPhoto;
}

export async function saveWeeklyPhoto(photo: WeeklyPhoto): Promise<void> {
  const db = await getDB();
  const record: StoredPhoto = { ...photo, key: photoKey(photo.userId, photo.weekNumber) };
  await db.put('weeklyPhotos', record);
}

export async function getWeeklyPhoto(
  userId: string,
  weekNumber: number
): Promise<WeeklyPhoto | null> {
  const db = await getDB();
  const record = await db.get('weeklyPhotos', photoKey(userId, weekNumber));
  if (!record) return null;
  return stripKey(record);
}

export async function getAllPhotosForUser(userId: string): Promise<WeeklyPhoto[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('weeklyPhotos', 'byUser', userId);
  return all.map(stripKey);
}

export async function deleteWeeklyPhoto(userId: string, weekNumber: number): Promise<void> {
  const db = await getDB();
  await db.delete('weeklyPhotos', photoKey(userId, weekNumber));
}

export async function clearAllPhotos(): Promise<void> {
  const db = await getDB();
  await db.clear('weeklyPhotos');
}

// Aliases used by components
export const savePhoto = saveWeeklyPhoto;
export const getPhotosByWeek = getWeeklyPhoto;