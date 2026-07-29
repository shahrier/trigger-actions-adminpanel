/**
 * Shared session cache for generated analysis.
 *
 * Model calls cost time and tokens, and re-opening the same artifact is the
 * common case while working. Everything here is session-scoped: no description
 * of an org's business logic is left on disk once the tab closes.
 *
 * Two tiers. The in-memory Map always works; sessionStorage is an optional
 * upgrade that survives reloads, and Lightning Web Security sandboxes it per
 * namespace (or blocks it entirely), so it is treated as best-effort.
 */

// Bump when a prompt OR the model in AgentforceController changes, so responses
// shaped by the old instructions — or produced by a different model — are not
// served against the new ones.
export const PROMPT_VERSION = 4;

const CACHE_PREFIX = "taf-ai";
const memoryCache = new Map();

// Non-cryptographic: this only has to tell one payload apart from another.
export function hashString(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < (text || "").length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function cacheKey(parts) {
  return `${CACHE_PREFIX}:v${PROMPT_VERSION}:${hashString(parts.join("|"))}`;
}

export function readCache(key) {
  if (!key) return null;
  if (memoryCache.has(key)) {
    return memoryCache.get(key);
  }
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    memoryCache.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function writeCache(key, value) {
  if (!key) return;
  memoryCache.set(key, value);
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked or full: the in-memory tier still serves this session.
  }
}

export function clearCache(key) {
  if (!key) return;
  memoryCache.delete(key);
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Nothing to do — the in-memory tier is already cleared.
  }
}
