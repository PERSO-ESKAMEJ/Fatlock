import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { WeeklyPhoto } from '../types';
import { supabase } from './supabase';
import { useProfileStore } from '../store/useProfileStore';

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

function storagePath(challengeId: string, userId: string, weekNumber: number): string {
  return `${challengeId}/${userId}/week${weekNumber}.json`;
}

async function uploadPhotoToSupabase(photo: WeeklyPhoto): Promise<void> {
  const sb = supabase();
  const challengeId = useProfileStore.getState().challenge?.id;
  if (!sb || !challengeId) return;

  const json = JSON.stringify(photo);
  const blob = new Blob([json], { type: 'application/json' });
  const path = storagePath(challengeId, photo.userId, photo.weekNumber);

  await sb.storage.from('fatlock-photos').upload(path, blob, {
    upsert: true,
    contentType: 'application/json',
  });
}

async function downloadPhotoFromSupabase(
  userId: string,
  weekNumber: number
): Promise<WeeklyPhoto | null> {
  const sb = supabase();
  const challengeId = useProfileStore.getState().challenge?.id;
  if (!sb || !challengeId) return null;

  const path = storagePath(challengeId, userId, weekNumber);
  const { data, error } = await sb.storage.from('fatlock-photos').download(path);
  if (error || !data) return null;

  try {
    const text = await data.text();
    return JSON.parse(text) as WeeklyPhoto;
  } catch {
    return null;
  }
}

// ── Sync status registry ─────────────────────────────────────────────────────
// Suivi en mémoire de l'état de synchronisation de chaque photo vers Supabase Storage.
// Réinitialisé à chaque rechargement de page (pas besoin de persister).

type SyncState = 'pending' | 'synced' | 'failed' | 'local';
const _syncStatus = new Map<string, SyncState>();
const _syncListeners = new Map<string, Set<(s: SyncState) => void>>();

function _notifySyncListeners(key: string, state: SyncState) {
  _syncStatus.set(key, state);
  _syncListeners.get(key)?.forEach((cb) => cb(state));
}

/** État de synchronisation Supabase d'une photo. 'local' = pas de Supabase configuré. */
export function getPhotoSyncStatus(userId: string, weekNumber: number): SyncState {
  return _syncStatus.get(photoKey(userId, weekNumber)) ?? 'local';
}

/** Abonnement réactif au statut de sync. Retourne une fonction de désabonnement. */
export function subscribePhotoSync(
  userId: string,
  weekNumber: number,
  cb: (state: SyncState) => void
): () => void {
  const key = photoKey(userId, weekNumber);
  if (!_syncListeners.has(key)) _syncListeners.set(key, new Set());
  _syncListeners.get(key)!.add(cb);
  cb(_syncStatus.get(key) ?? 'local');
  return () => _syncListeners.get(key)?.delete(cb);
}

export async function saveWeeklyPhoto(photo: WeeklyPhoto): Promise<void> {
  const db = await getDB();
  const record: StoredPhoto = { ...photo, key: photoKey(photo.userId, photo.weekNumber) };
  await db.put('weeklyPhotos', record);

  const key = photoKey(photo.userId, photo.weekNumber);
  const sb = supabase();
  if (!sb) {
    _notifySyncListeners(key, 'local');
    return;
  }

  _notifySyncListeners(key, 'pending');
  uploadPhotoToSupabase(photo)
    .then(() => _notifySyncListeners(key, 'synced'))
    .catch((err) => {
      console.warn('[FATLOCK] Photo sync failed:', err);
      _notifySyncListeners(key, 'failed');
    });
}

export async function getWeeklyPhoto(
  userId: string,
  weekNumber: number
): Promise<WeeklyPhoto | null> {
  const db = await getDB();
  const record = await db.get('weeklyPhotos', photoKey(userId, weekNumber));
  if (record) return stripKey(record);

  // Fallback: fetch from Supabase (works for other participants' photos)
  const remote = await downloadPhotoFromSupabase(userId, weekNumber);
  if (remote) {
    // Cache locally for next time
    const stored: StoredPhoto = { ...remote, key: photoKey(userId, weekNumber) };
    await db.put('weeklyPhotos', stored).catch(() => undefined);
  }
  return remote;
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

  // Also delete from Supabase Storage
  const sb = supabase();
  const challengeId = useProfileStore.getState().challenge?.id;
  const userId = useProfileStore.getState().profile?.id;
  if (!sb || !challengeId || !userId) return;

  const folder = `${challengeId}/${userId}`;
  const { data } = await sb.storage.from('fatlock-photos').list(folder);
  if (data && data.length > 0) {
    const paths = data.map((f) => `${folder}/${f.name}`);
    await sb.storage.from('fatlock-photos').remove(paths);
  }
}

export async function deletePhotoFromSupabase(userId: string, weekNumber: number): Promise<void> {
  const sb = supabase();
  const challengeId = useProfileStore.getState().challenge?.id;
  if (!sb || !challengeId) return;
  const path = storagePath(challengeId, userId, weekNumber);
  await sb.storage.from('fatlock-photos').remove([path]);
}

// Aliases used by components
export const savePhoto = saveWeeklyPhoto;
export const getPhotosByWeek = getWeeklyPhoto;