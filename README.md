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

## usage
```js
import UrlSyncFlat from '@jswork/@jswork/url-sync-flat';

// 用法示例：
const sync = new UrlSyncFlatClass({ prefix: 't1_', fields: ['page','pageSize','keyword'], replaceState: true });
 
const init = sync.readInitialState({ defaults: { page: 1, pageSize: 10, keyword: '' } });
// 用 init 初始化 UI/state
const detach = sync.attachPopstateListener(next => { // set UI });
// 同步 state 到 URL
sync.schedule({ page: 2, pageSize: 20, keyword: 'abc' });

// 卸载时 detach(); sync.cancel();
```

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
