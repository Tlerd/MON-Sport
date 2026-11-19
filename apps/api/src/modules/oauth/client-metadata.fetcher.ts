import { Injectable } from '@nestjs/common';

const MAX_BYTES = 10_240;
const TIMEOUT_MS = 5000;
const MAX_NAME = 100;

export interface ClientMetadata {
  clientId: string;
  clientName: string;
  redirectUris: string[];
}

export function cimdHosts(): string[] {
  return (process.env.OAUTH_CIMD_HOSTS ?? 'claude.ai')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedClientId(clientId: string): boolean {
  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    return false;
  }
  return url.protocol === 'https:' && !url.username && !url.password && cimdHosts().includes(url.hostname.toLowerCase());
}

@Injectable()
export class ClientMetadataFetcher {
  async fetch(clientId: string): Promise<ClientMetadata | null> {
    if (!isAllowedClientId(clientId)) return null;
    try {
      const response = await fetch(clientId, { redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!response.ok || !response.body) return null;
      const text = await readLimited(response.body);
      if (text === null) return null;
      const doc: unknown = JSON.parse(text);
      if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) return null;
      const record = doc as Record<string, unknown>;
      if (record.client_id !== clientId) return null;
      const uris = record.redirect_uris;
      if (!Array.isArray(uris) || !uris.every((uri) => typeof uri === 'string')) return null;
      const method = record.token_endpoint_auth_method;
      if (method !== undefined && method !== 'none') return null;
      const name = record.client_name;
      let clientName: string;
      if (name === undefined) clientName = new URL(clientId).host;
      else if (typeof name === 'string' && name.length >= 1 && name.length <= MAX_NAME && !/[\u0000-\u001f\u007f]/.test(name)) clientName = name;
      else return null;
      return { clientId, clientName, redirectUris: uris as string[] };
    } catch {
      return null;
    }
  }
}

async function readLimited(body: ReadableStream<Uint8Array>): Promise<string | null> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
