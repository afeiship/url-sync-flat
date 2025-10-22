# UrlSyncFlat

UrlSyncFlat — lightweight utility to synchronize flat (non-nested) key:value state with the browser URL query string.  
Supports both browser (location.search) and hash (location.hash) routing modes.

- Small and dependency-free
- Works in plain JS, TypeScript, and React (class or hooks)
- Syncs simple primitive fields (string / number / boolean)
- Supports prefixing keys, push/replace history, debounced writes, and popstate/hashchange handling
- Ideal for pagination, simple filters, keywords — not for nested objects

## Installation

```bash
# npm
npm install @jswork/@jswork/url-sync-flat

# yarn
yarn add @jswork/@jswork/url-sync-flat
```

## Import / Usage

```js
import UrlSyncFlat from '@jswork/@jswork/url-sync-flat';
```

## Quick example (plain JS)

```html
<script type="module">
import UrlSyncFlat from '@jswork/@jswork/url-sync-flat';

// sync fields: page, pageSize, keyword; use browser router (location.search)
const sync = new UrlSyncFlat({
  prefix: '',                      // optional prefix for keys
  fields: ['page', 'pageSize', 'keyword'],
  replaceState: true,              // use history.replaceState by default
  debounceMs: 200,                 // debounce for schedule()
  routerType: 'browser'            // 'browser' or 'hash'
});

// initialize UI/state from URL (with defaults)
const init = sync.readInitialState({ defaults: { page: 1, pageSize: 10, keyword: '' } });
console.log('init state', init);

// schedule a debounced URL update after state change (e.g. after fetch)
sync.schedule({ page: 2, pageSize: 20, keyword: 'apple' });

// immediate write (no debounce)
sync.flush({ page: 1, pageSize: 10, keyword: '' });

// listen for back/forward navigation and restore state
const detach = sync.attachPopstateListener((nextState) => {
  console.log('restored from history', nextState);
  // update UI or re-fetch using nextState
});

// cleanup when done
// detach();
// sync.cancel();
</script>
```

## React (class component) example

```tsx
import React from 'react';
import UrlSyncFlat from '@jswork/@jswork/url-sync-flat';

class MyTable extends React.Component {
  constructor(props) {
    super(props);
    this.sync = new UrlSyncFlat({
      prefix: 't1_', 
      fields: ['page', 'pageSize', 'keyword'],
      replaceState: true,
      debounceMs: 200,
      routerType: 'browser'
    });

    const init = this.sync.readInitialState({ defaults: { page: 1, pageSize: 10, keyword: '' } });
    this.state = { ...init, data: [] };
  }

  componentDidMount() {
    // attach navigation listener
    this.detach = this.sync.attachPopstateListener((next) => {
      if (next) {
        this.setState(next, () => this.fetchData());
      }
    });
    this.fetchData();
  }

  componentWillUnmount() {
    if (this.detach) this.detach();
    this.sync.cancel();
  }

  async fetchData() {
    // use this.state.page / pageSize / keyword to fetch
    // after successful fetch:
    this.sync.schedule({
      page: this.state.page,
      pageSize: this.state.pageSize,
      keyword: this.state.keyword
    });
  }

  render() {
    // render UI with this.state
    return null;
  }
}
```

## Hash mode example

If your app uses hash routing (e.g. `#/path?key=val`) you can use `routerType: 'hash'`. UrlSyncFlat will read/write the part after the `?` inside the hash and listen to `hashchange` events.

```js
const syncHash = new UrlSyncFlat({
  prefix: 't2_',
  fields: ['page', 'keyword'],
  routerType: 'hash', // use hash mode
  replaceState: true
});

const init = syncHash.readInitialState({ defaults: { page: 1, keyword: '' } });
// schedule/flush/attachPopstateListener works the same
```

## Notes & recommendations

- This tool intentionally supports only flat state (primitive values). For nested objects or arrays prefer a JSON-serialized approach or another utility.
- Use `fields` to limit the keys managed by UrlSyncFlat and avoid clobbering other unrelated query parameters.
- Use `prefix` when multiple components may write query parameters on the same page (e.g. `t1_`, `t2_`).
- Prefer `replaceState` for frequent updates (typing, pagination) to avoid polluting browser history; use `pushState` when you want each action to be navigable via back/forward.
- Hash mode is helpful for SPAs that keep client routing inside the hash segment.

## Browser compatibility

Works in modern browsers with support for `URLSearchParams`, `history.replaceState` / `history.pushState`, and `hashchange` events.

## Contributing

Contributions are welcome. Open an issue or submit a PR with tests/examples.

## License

MIT