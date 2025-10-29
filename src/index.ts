/**
 * UrlSyncFlatClass - synchronize flat key:value state with URL query (browser or hash).
 *
 * Notes:
 * - readInitialState({ defaults }) returns an object containing only requested fields
 *   when `fields` option is provided; otherwise returns all query keys (prefix removed).
 * - parsePrimitive converts "true"/"false" to booleans, numeric strings to Number.
 * - routerType: 'browser' uses location.search + popstate; 'hash' uses location.hash + hashchange.
 */

import HashQuery from '@jswork/hash-query';

export type UrlSyncFlatOptions = {
  prefix?: string;
  fields?: string[]; // if provided (non-empty), only these fields are managed
  replaceState?: boolean;
  debounceMs?: number;
  routerType?: 'browser' | 'hash';
};

export type UrlSyncFlatState = Record<string, string | number | boolean | undefined>;

const DEFAULTS: Required<UrlSyncFlatOptions> = {
  prefix: '',
  fields: [],
  replaceState: true,
  debounceMs: 200,
  routerType: 'hash'
};

function keyOf(prefix: string, k: string) {
  return prefix ? `${prefix}${k}` : k;
}

function parsePrimitive(v: string | null): string | number | boolean | undefined {
  if (v === null) return undefined;
  if (v === 'true') return true;
  if (v === 'false') return false;
  // integer or float
  if (/^[+-]?\d+(\.\d+)?$/.test(v)) {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return v;
}

/**
 * Read query string according to routerType.
 * - browser -> location.search (without leading ?)
 * - hash -> take substring after first '?' inside the hash (if any)
 */
function readQueryString(routerType: 'browser' | 'hash'): string {
  if (typeof window === 'undefined') return '';
  if (routerType === 'browser') {
    return window.location.search ? window.location.search.replace(/^\?/, '') : '';
  }
  const hq = new HashQuery();
  return hq.get().toString();
}

/**
 * Write query string according to routerType.
 * For browser: update pathname + ?qp + hash
 * For hash: update hash's query portion while preserving hash base.
 */
function writeQueryString(routerType: 'browser' | 'hash', qp: URLSearchParams, replace: boolean) {
  if (typeof window === 'undefined') return;

  if (routerType === 'browser') {
    const pathname = window.location.pathname || '';
    const hash = window.location.hash || '';
    const newUrl = `${pathname}${qp.toString() ? '?' + qp.toString() : ''}${hash}`;
    if (replace) {
      window.history.replaceState(null, '', newUrl);
    } else {
      window.history.pushState(null, '', newUrl);
    }
    return;
  }

  // hash mode
  const hq = new HashQuery();
  hq.set(qp, replace);
}

export default class UrlSyncFlat {
  private opts: Required<UrlSyncFlatOptions>;
  private timer: number | null = null;
  private changeHandler?: () => void;

  constructor(opts?: UrlSyncFlatOptions) {
    this.opts = { ...DEFAULTS, ...(opts || {}) };
  }

  /**
   * Read current URL and return parsed flat state.
   * - If fields array is provided and non-empty, only those fields are returned (merged with defaults).
   * - If fields is empty, all query keys are returned; keys with prefix are returned without prefix.
   */
  readInitialState(params?: { defaults?: UrlSyncFlatState }): UrlSyncFlatState {
    const defaults = params?.defaults ?? {};
    if (typeof window === 'undefined') return { ...defaults };

    const rawQs = readQueryString(this.opts.routerType);
    const qp = new URLSearchParams(rawQs);
    const result: UrlSyncFlatState = { ...defaults };

    if (this.opts.fields && this.opts.fields.length > 0) {
      // Only manage listed fields
      this.opts.fields.forEach((f) => {
        // try prefix key first, then raw key
        const v = qp.get(keyOf(this.opts.prefix, f)) ?? qp.get(f);
        const parsed = parsePrimitive(v);
        if (parsed !== undefined) {
          result[f] = parsed;
        }
      });
    } else {
      // Read all keys; when a key starts with prefix, remove it.
      qp.forEach((value, key) => {
        if (this.opts.prefix && key.startsWith(this.opts.prefix)) {
          const rawKey = key.slice(this.opts.prefix.length);
          result[rawKey] = parsePrimitive(value);
        } else {
          result[key] = parsePrimitive(value);
        }
      });
    }

    return result;
  }

  /**
   * Serialize given flat state to URL.
   * - Fields not present or undefined/'' will be removed.
   * - Keeps other unrelated query keys untouched.
   */
  serializeStateToUrl(state: UrlSyncFlatState | undefined) {
    if (typeof window === 'undefined') return;

    const rawQs = readQueryString(this.opts.routerType);
    const qp = new URLSearchParams(rawQs);

    if (this.opts.fields && this.opts.fields.length > 0) {
      this.opts.fields.forEach((f) => {
        const val = state ? state[f] : undefined;
        const k = keyOf(this.opts.prefix, f);
        if (val === undefined || val === '') {
          qp.delete(k);
          qp.delete(f);
        } else {
          qp.set(k, String(val));
        }
      });
    } else if (state) {
      Object.keys(state).forEach((f) => {
        const val = state[f];
        const k = keyOf(this.opts.prefix, f);
        if (val == undefined || val === '') {
          qp.delete(k);
          qp.delete(f);
        } else {
          qp.set(k, String(val));
        }
      });
    }

    writeQueryString(this.opts.routerType, qp, this.opts.replaceState);
  }

  /**
   * Attach popstate (browser) or hashchange (hash) listener.
   * Returns a detach function.
   */
  attachPopstateListener(onChange: (next: UrlSyncFlatState) => void) {
    if (typeof window === 'undefined') return () => {};
    const handler = () => {
      const next = this.readInitialState();
      onChange(next);
    };

    if (this.opts.routerType === 'browser') {
      window.addEventListener('popstate', handler);
    } else {
      window.addEventListener('hashchange', handler);
    }
    this.changeHandler = handler;

    return () => {
      if (this.opts.routerType === 'browser') {
        window.removeEventListener('popstate', handler);
      } else {
        window.removeEventListener('hashchange', handler);
      }
      this.changeHandler = undefined;
    };
  }

  detachPopstate() {
    if (!this.changeHandler) return;
    if (this.opts.routerType === 'browser') {
      window.removeEventListener('popstate', this.changeHandler);
    } else {
      window.removeEventListener('hashchange', this.changeHandler);
    }
    this.changeHandler = undefined;
  }

  schedule(state: UrlSyncFlatState | undefined) {
    if (typeof window === 'undefined') return;
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.serializeStateToUrl(state);
      this.timer = null;
    }, this.opts.debounceMs);
  }

  flush(state: UrlSyncFlatState | undefined) {
    if (typeof window === 'undefined') return;
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.serializeStateToUrl(state);
  }

  cancel() {
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }
}


export { readQueryString, writeQueryString }
