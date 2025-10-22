/**
 * UrlSyncFlatClass - 仅同步扁平 key:value（非嵌套 JSON）到 URL query
 * 支持两种路由类型：browser (location.search) / hash (location.hash 中的 query)
 *
 * 变化：
 * - 新增 opts.routerType: 'browser' | 'hash'，默认 'browser'
 * - 根据 routerType 选择读取/写入 query 的策略
 * - 对于 hash 模式，使用 hashchange 事件监听；对于 browser 模式，使用 popstate 监听
 *
 * 用法示例（hash）：
 *  const sync = new UrlSyncFlatClass({ routerType: 'hash', prefix: 't1_', fields: ['page','keyword'] });
 *  const init = sync.readInitialState({ defaults: { page: 1, keyword: '' } });
 *  this.detach = sync.attachPopstateListener(next => { // set UI });
 *  sync.schedule({ page: 2, keyword: 'abc' });
 *  // 卸载时 detach(); sync.cancel();
 */
export type UrlSyncFlatOptions = {
  prefix?: string; // 可选前缀，默认 ''
  fields?: string[]; // 需要同步的字段列表（可选）
  replaceState?: boolean; // true 使用 replaceState（默认），false 使用 pushState
  debounceMs?: number; // schedule 的防抖时长（ms）
  routerType?: 'browser' | 'hash'; // 'browser' -> use location.search; 'hash' -> use location.hash (default 'browser')
};

export type UrlSyncFlatState = Record<string, string | number | boolean | undefined>;

const DEFAULTS: Required<UrlSyncFlatOptions> = {
  prefix: '',
  fields: [],
  replaceState: true,
  debounceMs: 200,
  routerType: 'hash',
};

function keyOf(prefix: string, k: string) {
  return prefix ? `${prefix}${k}` : k;
}

function parsePrimitive(v: string | null): string | number | boolean | undefined {
  if (v === null) return undefined;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^[+-]?\d+(\.\d+)?$/.test(v)) {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return v;
}

/**
 * Helper: obtain query string according to routerType.
 * - browser: uses window.location.search (without leading '?')
 * - hash: inspects window.location.hash and returns substring after first '?' (if any)
 */
function readQueryString(routerType: 'browser' | 'hash'): string {
  if (typeof window === 'undefined') return '';
  if (routerType === 'browser') {
    return window.location.search ? window.location.search.replace(/^\?/, '') : '';
  }
  // hash mode
  const rawHash = window.location.hash || '';
  const hash = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
  const idx = hash.indexOf('?');
  if (idx >= 0) {
    return hash.slice(idx + 1);
  }
  return '';
}

/**
 * Helper: write query string according to routerType. Preserves other parts of URL.
 * Uses history.replaceState / pushState depending on replace flag in opts.
 */
function writeQueryString(routerType: 'browser' | 'hash', qp: URLSearchParams, replace: boolean) {
  if (typeof window === 'undefined') return;
  const qs = qp.toString();
  if (routerType === 'browser') {
    const pathname = window.location.pathname || '';
    const hash = window.location.hash || '';
    const newUrl = `${pathname}${qs ? '?' + qs : ''}${hash}`;
    if (replace) {
      window.history.replaceState(null, '', newUrl);
    } else {
      window.history.pushState(null, '', newUrl);
    }
    return;
  }

  // hash mode: preserve pathname + search, update hash portion while keeping hash's path before '?'
  const rawHash = window.location.hash || '';
  const hash = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
  const idx = hash.indexOf('?');
  const base = idx >= 0 ? hash.slice(0, idx) : hash; // base may be '' or '/path' or '!' etc.
  const newHash = `${base}${qs ? '?' + qs : ''}`;
  const pathnameSearch = `${window.location.pathname || ''}${window.location.search || ''}`;
  const newUrl = `${pathnameSearch}#${newHash}`;
  if (replace) {
    window.history.replaceState(null, '', newUrl);
  } else {
    window.history.pushState(null, '', newUrl);
  }
}

export default class UrlSyncFlatClass {
  private opts: Required<UrlSyncFlatOptions>;
  private timer: number | null = null;
  private changeHandler?: () => void;

  constructor(opts?: UrlSyncFlatOptions) {
    this.opts = { ...DEFAULTS, ...(opts || {}) };
  }

  /**
   * 从 URL 读取当前指定 fields 的值（优先读取 prefix+field，再回退到 field）
   * defaults 可用于提供默认值
   */
  readInitialState(params?: { defaults?: UrlSyncFlatState }): UrlSyncFlatState {
    const defaults = params?.defaults ?? {};
    if (typeof window === 'undefined') return { ...defaults };

    const rawQs = readQueryString(this.opts.routerType);
    const qp = new URLSearchParams(rawQs);
    const result: UrlSyncFlatState = { ...defaults };

    // 如果提供了 fields 列表，则按列表读取；否则读取所有 query 中带 prefix 的键（去掉 prefix）
    if (this.opts.fields && this.opts.fields.length > 0) {
      this.opts.fields.forEach((f) => {
        const v = qp.get(keyOf(this.opts.prefix, f)) ?? qp.get(f);
        const parsed = parsePrimitive(v);
        if (parsed !== undefined) result[f] = parsed;
      });
    } else {
      // 读取所有 query，挑出以 prefix 开头或非空键写入 result
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
   * 把 state 中指定字段序列化到 URL（仅处理平铺值：string/number/boolean）
   * - 若字段值为 undefined 或 '' 则删除对应 query 键
   * - 保留其他 query 键不变
   */
  serializeStateToUrl(state: UrlSyncFlatState | undefined) {
    if (typeof window === 'undefined') return;

    // start from existing query according to routerType
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
      // 写入 state 中的键（平铺，不递归）
      Object.keys(state).forEach((f) => {
        const val = state[f];
        const k = keyOf(this.opts.prefix, f);
        if (val === undefined || val === '') {
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
   * Attach popstate/hashchange listener; on change parse URL and call onChange(nextState)
   * Returns detach function.
   */
  attachPopstateListener(onChange: (next: UrlSyncFlatState) => void) {
    if (typeof window === 'undefined') return () => {};
    // Create handler that reads according to routerType
    const handler = () => {
      const next = this.readInitialState();
      onChange(next);
    };

    if (this.opts.routerType === 'browser') {
      window.addEventListener('popstate', handler);
    } else {
      // hash mode: listen for 'hashchange' to detect manual hash navigation
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

  /**
   * 防抖写 URL：schedule 延迟写入，flush 立即写入，cancel 取消挂起
   */
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