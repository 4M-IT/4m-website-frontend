import type { Award } from '@/types/award';
import { getPublicApiBaseUrl } from '@/config/api';
import { apiGetJson } from '@/services/http';

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
};

type CmsMedia = {
  signedUrl?: string;
  signed_url?: string;
  thumbnailSignedUrl?: string;
  thumbnail_signed_url?: string;
  proxyUrl?: string;
  proxy_url?: string;
  publicUrl?: string;
  public_url?: string;
};

type AwardApiRow = {
  name?: string;
  program?: string;
  institution?: string;
  year?: string;
  featured?: boolean;
  media_source?: Award['media_source'];
  media_destination?: string;
  medias?: CmsMedia[];
};

function normalizeUrlCandidate(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed || '';
}

function pickMediaUrl(medias?: CmsMedia[]): string {
  if (!Array.isArray(medias) || medias.length === 0) return '';
  for (const media of medias) {
    const candidate = normalizeUrlCandidate(
      media?.thumbnailSignedUrl
      ?? media?.thumbnail_signed_url
      ?? media?.signedUrl
      ?? media?.signed_url
      ?? media?.proxyUrl
      ?? media?.proxy_url
      ?? media?.publicUrl
      ?? media?.public_url,
    );
    if (candidate) return candidate;
  }
  return '';
}

function isAbsoluteOrRootUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || value.startsWith('//') || value.startsWith('/');
}

function sortAwards(items: Award[]): Award[] {
  return [...items].sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return parseInt(b.year, 10) - parseInt(a.year, 10);
  });
}

function mapAwardRow(row: AwardApiRow): Award {
  const signedImage = pickMediaUrl(row.medias);
  const fallbackDest = normalizeUrlCandidate(row.media_destination);
  const mediaDestination = signedImage || fallbackDest;
  const mediaSource: Award['media_source'] = mediaDestination
    ? (signedImage || isAbsoluteOrRootUrl(mediaDestination) ? 'url' : (row.media_source ?? 'file'))
    : 'file';

  return {
    name: row.name ?? '',
    program: row.program ?? '',
    institution: row.institution ?? '',
    year: String(row.year ?? ''),
    media_source: mediaSource,
    media_destination: mediaDestination,
    featured: Boolean(row.featured),
  };
}

function normalizeAwardsPayload(data: unknown): Award[] {
  if (Array.isArray(data)) return data as Award[];

  const envelope = data as ApiEnvelope<unknown>;
  const raw = envelope?.data ?? data;
  if (Array.isArray(raw)) return (raw as AwardApiRow[]).map(mapAwardRow);

  const obj = raw as {
    items?: AwardApiRow[];
    awards?: AwardApiRow[];
  };
  const rows = obj.items ?? obj.awards ?? [];
  return rows.map(mapAwardRow);
}

async function loadAwardsJson(): Promise<Award[]> {
  const mod = await import('@public/data/awards.json');
  const awards = (mod.default || []) as Award[];
  return sortAwards(awards);
}

/**
 * Full awards list from `GET {API}/awards` or local `public/data/awards.json`.
 */
export async function loadAwards(): Promise<Award[]> {
  const base = getPublicApiBaseUrl();
  if (base) {
    try {
      const data = await apiGetJson<unknown>('/api/v1/awards');
      return sortAwards(normalizeAwardsPayload(data));
    } catch (e) {
      console.warn('[services] loadAwards: API failed, using local JSON', e);
    }
  }
  return loadAwardsJson();
}
