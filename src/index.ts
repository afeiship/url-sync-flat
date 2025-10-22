/**
 * AI: https://github.com/copilot/c/593e75b6-f7bc-4d0b-8904-84fef121ea15
 *
 * UrlSyncFlatClass - 仅同步扁平 key:value（非嵌套 JSON）到 URL query
 * - 每个字段作为独立 query key 写入（prefix + field）
 * - 读取时尝试把数字/布尔字符串转换回对应类型
 * - 支持 replaceState/pushState、防抖 schedule/flush/cancel、popstate 监听
 *
 * 用法示例：
 *  const sync = new UrlSyncFlatClass({ prefix: 't1_', fields: ['page','pageSize','keyword'], replaceState: true });
 *  const init = sync.readInitialState({ defaults: { page: 1, pageSize: 10, keyword: '' } });
 *  // 用 init 初始化 UI/state
 *  const detach = sync.attachPopstateListener(next => { // set UI });
 *  // 同步 state 到 URL
 *  //sync.schedule({ page: 2, pageSize: 20, keyword: 'abc' });
 *  // 卸载时 detach(); sync.cancel();
 **/

 export type UrlSyncFlatOptions = {
  prefix?: string; // 可选前缀，默认 ''
  fields?: string[]; // 需要同步的字段列表（必传或为空数组表示不限制但建议传）
  replaceState?: boolean; // true 使用 replaceState（默认），false 使用 pushState
  debounceMs?: number; // schedule 的防抖时长（ms）
};

export type UrlSyncFlatState = Record<string, string | number | boolean | undefined>;

const DEFAULTS: Required<UrlSyncFlatOptions> = {
  prefix: '',
  fields: [],
  replaceState: true,
  debounceMs: 200,
};

function keyOf(prefix: string, k: string) {
  return prefix ? `${prefix}${k}` : k;
}

function parsePrimitive(v: string | null): string | number | boolean | undefined {
  if (v === null) return undefined;
  // boolean
  if (v === 'true') return true;
  if (v === 'false') return false;
  // integer/float
  if (/^[+-]?\d+(\.\d+)?$/.test(v)) {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  // default string
  return v;
}

export default class UrlSyncFlatClass {
  private opts: Required<UrlSyncFlatOptions>;
  private timer: number | null = null;
  private popHandler?: () => void;

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

    const qp = new URLSearchParams(window.location.search);
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
          // 如果没有 prefix，直接写入
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
    const qp = new URLSearchParams(window.location.search);

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

    const newUrl = `${window.location.pathname}${qp.toString() ? '?' + qp.toString() : ''}${window.location.hash || ''}`;
    if (this.opts.replaceState) {
      window.history.replaceState(null, '', newUrl);
    } else {
      window.history.pushState(null, '', newUrl);
    }
  }

  /**
   * Attach popstate listener; on change parse URL and call onChange(nextState)
   * 返回 detach 函数
   */
  attachPopstateListener(onChange: (next: UrlSyncFlatState) => void) {
    if (typeof window === 'undefined') return () => {};
    const handler = () => {
      const next = this.readInitialState();
      onChange(next);
    };
    window.addEventListener('popstate', handler);
    this.popHandler = handler;
    return () => {
      window.removeEventListener('popstate', handler);
      this.popHandler = undefined;
    };
  }

  detachPopstate() {
    if (this.popHandler) {
      window.removeEventListener('popstate', this.popHandler);
      this.popHandler = undefined;
    }
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
    if (this.timer) { window.clearTimeout(this.timer); this.timer = null; }
    this.serializeStateToUrl(state);
  }

  cancel() {
    if (this.timer) { window.clearTimeout(this.timer); this.timer = null; }
  }
}