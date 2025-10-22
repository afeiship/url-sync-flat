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

const sync = new UrlSyncFlat();

// 设置参数
sync.set('name', 'afeiship');
sync.set('age', 18);
// => url: ?name=afeiship&age=18

// 获取参数
const name = sync.get('name'); // 'afeiship'
const age = sync.get('age');   // 18

// 获取多个参数
const { name: n, age: a } = sync.gets(['name', 'age']);
// n: 'afeiship', a: 18

// 移除参数
sync.remove('age');
// => url: ?name=afeiship

// 清除所有参数
sync.clear();
// => url: ?

// 附加到 URL
const url = sync.attach('https://www.example.com?id=1');
// url: 'https://www.example.com?id=1&name=afeiship&age=18' (假设之前设置了name和age)
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
