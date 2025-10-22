# url-sync-flat
> Lightweight utility syncing flat state into URL query parameters.

[![version][version-image]][version-url]
[![license][license-image]][license-url]
[![size][size-image]][size-url]
[![download][download-image]][download-url]

## installation
```shell
yarn add @jswork/@jswork/url-sync-flat
```

## Usage

Import:

```js
import UrlSyncFlat from '@jswork/@jswork/url-sync-flat';
```

Basic example (plain JS):

```js
const sync = new UrlSyncFlat({
  prefix: '',                    // optional prefix for keys
  fields: ['page', 'pageSize', 'keyword'], // fields to sync (optional)
  replaceState: true,            // use replaceState (default)
  debounceMs: 200                // debounce delay for schedule()
});

// initialize UI/state from URL (provide defaults)
const init = sync.readInitialState({ defaults: { page: 1, pageSize: 10, keyword: '' } });

// schedule a debounced URL update after state change (e.g. after fetch)
sync.schedule({ page: 2, pageSize: 20, keyword: 'apple' });

// write immediately
sync.flush({ page: 1, pageSize: 10, keyword: '' });

// listen for browser back/forward navigation and restore state
const detach = sync.attachPopstateListener((nextState) => {
  // update UI or re-fetch with nextState
});

// cleanup
detach();
sync.cancel();
```

React (class component) example:

```tsx
import React from 'react';
import UrlSyncFlat from '@jswork/@jswork/url-sync-flat';

class MyTable extends React.Component {
  constructor(props) {
    super(props);
    this.sync = new UrlSyncFlat({ prefix: 't1_', fields: ['page', 'pageSize', 'keyword'] });
    const init = this.sync.readInitialState({ defaults: { page: 1, pageSize: 10, keyword: '' } });
    this.state = { ...init, data: [] };
  }

  componentDidMount() {
    // attach popstate to restore state when user navigates
    this.detach = this.sync.attachPopstateListener((next) => {
      if (next) {
        this.setState(next, () => this.fetchData());
      }
    });
    this.fetchData();
  }

  componentWillUnmount() {
    this.detach && this.detach();
    this.sync.cancel();
  }

  async fetchData() {
    // fetch using this.state.page / pageSize / keyword
    // after successful fetch:
    this.sync.schedule({
      page: this.state.page,
      pageSize: this.state.pageSize,
      keyword: this.state.keyword
    });
  }

  render() {
    // render table / controls bound to this.state
  }
}
```

> API

- constructor(opts?: UrlSyncFlatOptions)
  - opts.prefix?: string — optional key prefix (default: '')
  - opts.fields?: string[] — list of fields to sync; if omitted, class will read/write all query keys (default: [])
  - opts.replaceState?: boolean — true uses history.replaceState, false uses pushState (default: true)
  - opts.debounceMs?: number — debounce delay for schedule (default: 200)

- readInitialState(params?: { defaults?: Record<string, any> }): Record<string, any>
  - Parse current URL and return an object of parsed fields (numbers & booleans converted if possible).
  - Merges parsed values into provided defaults.

- serializeStateToUrl(state?: Record<string, any>): void
  - Immediately write provided flat state into URL query keys.

- schedule(state?: Record<string, any>): void
  - Debounced write; delays actual URL write by debounceMs. Useful to avoid frequent history updates while typing.

- flush(state?: Record<string, any>): void
  - Immediately write and clear any pending scheduled write.

- cancel(): void
  - Cancel any pending scheduled write.

- attachPopstateListener(onChange: (nextState: Record<string, any>) => void): () => void
  - Add a popstate listener that parses the URL and calls onChange with parsed state.
  - Returns a detach function to remove the listener.

- detachPopstate(): void
  - Remove the internal popstate listener (if attached).

Notes and recommendations

- This tool is intentionally simple: it only supports flat state (no nested objects). For nested state use a JSON-serialized approach or the project `url-sync-generic`.
- Use `fields` to restrict which keys are managed by the utility and to avoid clobbering other query parameters.
- Use `prefix` when multiple components on the same page may write query keys (e.g., `t1_`, `t2_`).
- Prefer `replaceState` for frequent updates (typing, pagination) to avoid polluting the browser history. Use `pushState` if you want each action to be navigable via back/forward.


## license
Code released under [the MIT license](https://github.com/afeiship/@jswork/url-sync-flat/blob/master/LICENSE.txt).

[version-image]: https://img.shields.io/npm/v/@jswork/@jswork/url-sync-flat
[version-url]: https://npmjs.org/package/@jswork/@jswork/url-sync-flat

[license-image]: https://img.shields.io/npm/l/@jswork/@jswork/url-sync-flat
[license-url]: https://github.com/afeiship/@jswork/url-sync-flat/blob/master/LICENSE.txt

[size-image]: https://img.shields.io/bundlephobia/minzip/@jswork/@jswork/url-sync-flat
[size-url]: https://github.com/afeiship/@jswork/url-sync-flat/blob/master/dist/@jswork/url-sync-flat.min.js

[download-image]: https://img.shields.io/npm/dm/@jswork/@jswork/url-sync-flat
[download-url]: https://www.npmjs.com/package/@jswork/@jswork/url-sync-flat
