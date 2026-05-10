import type { APIRoute } from 'astro';
import { normalizeBackendOrigin } from '@/config/api';

function getBackendOrigin(): string {
  const raw = import.meta.env.API_INTERNAL_URL || 'https://4m-backend-production.up.railway.app';
  return normalizeBackendOrigin(raw);
}

function joinPathParam(pathParam?: string): string {
  if (pathParam === undefined || pathParam === '') return '';
  return pathParam.replace(/^\/+/, '').replace(/\/+$/, '');
}

function buildUpstreamUrl(url: URL, pathParam?: string): string {
  const backendOrigin = getBackendOrigin();
  const rest = joinPathParam(pathParam);
  const path =
    rest === ''
      ? 'api/v1'
      : rest === 'api/v1' || rest.startsWith('api/v1/')
        ? rest
        : `api/v1/${rest}`;
  const target = new URL(`${backendOrigin}/${path}`);
  target.search = url.search;
  return target.toString();
}

async function proxyRequest(request: Request, url: URL, pathParam?: string): Promise<Response> {
  const upstreamUrl = buildUpstreamUrl(url, pathParam);
  const method = request.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const headers: Record<string, string> = {
    Accept: request.headers.get('accept') || 'application/json',
  };
  const contentType = request.headers.get('content-type');
  if (contentType && method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = contentType;
  }
  const authorization = request.headers.get('authorization');
  if (authorization) {
    headers.Authorization = authorization;
  }
  const apiKey = request.headers.get('x-api-key');
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }
  const cmsObjectKey = request.headers.get('x-cms-object-key');
  if (cmsObjectKey) {
    headers['x-cms-object-key'] = cmsObjectKey;
  }
  const cmsContentType = request.headers.get('x-cms-content-type');
  if (cmsContentType) {
    headers['x-cms-content-type'] = cmsContentType;
  }

  const fetchInit: RequestInit & { duplex?: 'half' } = {
    method,
    headers,
    body: hasBody ? request.body : undefined,
    signal: request.signal,
    redirect: 'manual',
  };
  if (hasBody) {
    // Node's fetch requires duplex for streamed request bodies.
    fetchInit.duplex = 'half';
  }

  const upstream = await fetch(upstreamUrl, fetchInit);

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'application/json',
      'cache-control': upstream.headers.get('cache-control') || 'no-store',
    },
  });
}

export const ALL: APIRoute = async ({ request, url, params }) => {
  const raw = params.path;
  const pathJoined = Array.isArray(raw) ? raw.join('/') : (raw ?? '');
  return proxyRequest(request, url, pathJoined);
};
