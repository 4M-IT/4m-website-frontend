import type { NewsArticle } from '@/types/news';
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

type NewsApiRow = {
  id?: string;
  title?: string;
  date?: string;
  excerpt?: string;
  image?: string;
  content?: string;
  category?: string;
  featured?: boolean;
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

function mapNewsRow(row: NewsApiRow): NewsArticle {
  const signedImage = pickMediaUrl(row.medias);
  return {
    id: row.id ?? '',
    title: row.title ?? '',
    date: row.date ?? '',
    excerpt: row.excerpt ?? '',
    image: signedImage || normalizeUrlCandidate(row.image),
    content: row.content ?? '',
    category: row.category ?? '',
    featured: Boolean(row.featured),
  };
}

function sortNewsRows(news: NewsArticle[]): NewsArticle[] {
  return [...news].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function normalizeNewsListPayload(data: unknown): NewsArticle[] {
  if (Array.isArray(data)) return data as NewsArticle[];
  const envelope = data as ApiEnvelope<unknown>;
  const raw = envelope?.data ?? data;
  if (Array.isArray(raw)) return (raw as NewsApiRow[]).map(mapNewsRow);
  const obj = raw as { items?: NewsApiRow[]; news?: NewsApiRow[] };
  const rows = obj.items ?? obj.news ?? [];
  return rows.map(mapNewsRow);
}

function normalizeNewsDetailPayload(data: unknown): NewsArticle | null {
  const envelope = data as ApiEnvelope<unknown>;
  const raw = (envelope?.data ?? data) as NewsApiRow | null | undefined;
  if (!raw || !raw.id) return null;
  return mapNewsRow(raw);
}

async function loadNewsJson(): Promise<NewsArticle[]> {
  const mod = await import('@public/data/news.json');
  const news = (mod.default || []) as NewsArticle[];
  return sortNewsRows(news);
}

/**
 * Full news list from `GET {API}/news` or `public/data/news.json`.
 */
export async function loadNewsArticles(): Promise<NewsArticle[]> {
  const base = getPublicApiBaseUrl();
  if (base) {
    try {
      const data = await apiGetJson<unknown>('/api/v1/news');
      return sortNewsRows(normalizeNewsListPayload(data));
    } catch (e) {
      console.warn('[services] loadNewsArticles: API failed, using local JSON', e);
    }
  }
  return loadNewsJson();
}

/**
 * Single article from `GET {API}/news/:id` or local JSON.
 */
export async function loadNewsArticleById(id: string): Promise<NewsArticle | null> {
  const base = getPublicApiBaseUrl();
  if (base) {
    try {
      const article = await apiGetJson<unknown>(`/api/v1/news/${encodeURIComponent(id)}`);
      const normalized = normalizeNewsDetailPayload(article);
      if (normalized) return normalized;
    } catch (e) {
      console.warn('[services] loadNewsArticleById: API failed, using local JSON', e);
    }
  }
  const all = await loadNewsJson();
  return all.find((a) => a.id === id) ?? null;
}
