/**
 * Browser-facing API base (`PUBLIC_API_URL`), often a same-origin proxy path such as `/api/backend`.
 *
 * **SSR:** Node `fetch` cannot load relative URLs (no request origin). We resolve in this order:
 * 1. `API_INTERNAL_URL` when set — preferred for server-side calls
 * 2. If `PUBLIC_API_URL` is relative (`/…`), resolve it against `import.meta.env.SITE` (from `site` in `astro.config`)
 * 3. Fall back to the same default origin as `src/pages/api/backend/[...path].ts`
 *
 * `API_INTERNAL_URL` should be the **API origin only** (no trailing `/api/v1`).
 * Server-side `apiGetJson('/api/v1/…')` paths are built the same way as the Astro proxy.
 */
const DEFAULT_BACKEND_ORIGIN = 'https://4m-backend-production.up.railway.app';

/** Strips trailing slashes and a trailing `/api/v1` so callers can append `/api/v1/...` consistently. */
export function normalizeBackendOrigin(raw: string): string {
  let s = raw.trim().replace(/\/+$/, '');
  if (s.endsWith('/api/v1')) {
    s = s.slice(0, -'/api/v1'.length).replace(/\/+$/, '');
  }
  return s;
}

export function getPublicApiBaseUrl(): string {
  if (import.meta.env.SSR) {
    const internal = import.meta.env.API_INTERNAL_URL;
    if (internal && typeof internal === 'string' && internal.trim()) {
      return normalizeBackendOrigin(internal);
    }

    const publicUrl = import.meta.env.PUBLIC_API_URL;
    if (publicUrl && typeof publicUrl === 'string' && publicUrl.trim()) {
      const trimmed = publicUrl.trim().replace(/\/$/, '');
      if (trimmed.startsWith('/')) {
        const site = import.meta.env.SITE;
        if (site && typeof site === 'string' && site.trim()) {
          return new URL(trimmed, site.endsWith('/') ? site : `${site}/`).href.replace(/\/$/, '');
        }
        return normalizeBackendOrigin(DEFAULT_BACKEND_ORIGIN);
      }
      return trimmed;
    }

    return normalizeBackendOrigin(DEFAULT_BACKEND_ORIGIN);
  }

  const publicUrl = import.meta.env.PUBLIC_API_URL;
  if (publicUrl && typeof publicUrl === 'string' && publicUrl.trim()) {
    return publicUrl.trim().replace(/\/$/, '');
  }

  return normalizeBackendOrigin(DEFAULT_BACKEND_ORIGIN);
}
