import { BUCKETS, requireSupabase, supabase } from '../lib/supabase';

export type StorageBucket = (typeof BUCKETS)[keyof typeof BUCKETS];

const EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

type UploadInput = {
  bucket: StorageBucket;
  /** Owning user id; folder layout is `{ownerId}/…` so storage policies can match auth.uid(). */
  ownerId: string;
  /** Local file uri from expo-image-picker (or a remote URL to copy). */
  uri: string;
  folder?: string;
  fileName?: string;
};

async function readFile(uri: string): Promise<{ body: ArrayBuffer; contentType: string }> {
  const response = await fetch(uri);
  if (!response.ok && response.status !== 0) {
    throw new Error('That file could not be read. Try picking it again.');
  }
  const contentType = response.headers.get('content-type') ?? 'image/jpeg';
  const body = await response.arrayBuffer();
  return { body, contentType };
}

/**
 * Uploads through Supabase Storage. Paths always start with the authenticated
 * user id, which is exactly what the bucket policies in
 * supabase/migrations/*_storage.sql check.
 */
export const storageService = {
  async upload({ bucket, ownerId, uri, folder, fileName }: UploadInput): Promise<string> {
    const client = requireSupabase();
    const { body, contentType } = await readFile(uri);
    const extension = EXTENSION[contentType.toLowerCase()] ?? 'jpg';
    const safeName = (fileName ?? `photo-${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = [ownerId, folder, safeName.includes('.') ? safeName : `${safeName}.${extension}`]
      .filter(Boolean)
      .join('/');
    const { error } = await client.storage.from(bucket).upload(path, body, { contentType, upsert: true });
    if (error) throw new Error(error.message);
    return path;
  },

  /** Public URL for the public buckets (profile photos, pet photos, clinic logos). */
  publicUrl(bucket: StorageBucket, path: string): string {
    if (!supabase) return path;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  },

  /** Medical attachments live in a private bucket, so links are short-lived and signed. */
  async signedUrl(bucket: StorageBucket, path: string, expiresInSeconds = 60 * 60): Promise<string | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
    if (error) return null;
    return data.signedUrl;
  },

  async remove(bucket: StorageBucket, path: string): Promise<void> {
    if (!supabase) return;
    await supabase.storage.from(bucket).remove([path]);
  },

  async uploadProfilePhoto(ownerId: string, uri: string): Promise<string> {
    const path = await this.upload({
      bucket: BUCKETS.profilePhotos,
      ownerId,
      uri,
      fileName: `avatar-${Date.now()}`,
    });
    return this.publicUrl(BUCKETS.profilePhotos, path);
  },

  async uploadPetPhoto(ownerId: string, petId: string, uri: string): Promise<string> {
    const path = await this.upload({
      bucket: BUCKETS.petPhotos,
      ownerId,
      uri,
      folder: petId,
      fileName: `${petId}-${Date.now()}`,
    });
    return this.publicUrl(BUCKETS.petPhotos, path);
  },

  /** Path extraction for a public URL already stored on a row. */
  pathFromPublicUrl(bucket: StorageBucket, url: string): string | null {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const index = url.indexOf(marker);
    return index >= 0 ? decodeURIComponent(url.slice(index + marker.length)) : null;
  },
};
