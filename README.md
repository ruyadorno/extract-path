# extract-path

[![NPM version](https://badge.fury.io/js/extract-path.svg)](https://npmjs.org/package/extract-path)
[![Build Status](https://travis-ci.org/ruyadorno/extract-path.svg?branch=master)](https://travis-ci.org/ruyadorno/extract-path)
[![coveralls-image](https://img.shields.io/coveralls/ruyadorno/extract-path/master.svg)](https://coveralls.io/r/ruyadorno/extract-path)
[![MIT license](http://img.shields.io/badge/license-MIT-blue.svg?style=flat)](https://raw.githubusercontent.com/ruyadorno/extract-path/master/LICENSE)

> Extract a valid fs path from a string.

**extract-path** is a node library that will attempt to find a possible valid file system path for a given input, validate its existance within the file system and return the matching value upon confirmation.

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [API](#api)
- [Credit](#credit)
- [Contribute](#contribute)
- [License](#license)

## Install

```sh
npm install extract-path
```

## Usage

```js
// example.js
const extractPath = require('extract-path');

extractPath('Selected file: ~/Documents/foo.js ...')
	.then(path => {
		console.log(path);
		// ~/Documents/foo.js
	});
```

## API

The API only exposes a single function, that receives a `string` and returns a `Promise` which resolves with a single, valid `string` value or `undefined` if there was no possible match.

### extractPath(str, opts)

- **str** `string` value to be parsed in order to extract a valid fs path
- **opts** \[optional\] `object` containing the following:
  - **validateFileExists** `boolean` wether the module should validate the file exists, defaults to `true`
  - **resolveWithInput** `boolean` if `true` resolves the promise with the entire input instead of only the path, defaults to `false`
  - **resolveWithFallback** `boolean` uses a fallback system that matches the entire input if a path couldn't be infered from the input, defaults to `true`

## Credit

**extract-path** is heavily inspired by the work done in [PathPicker](https://github.com/facebook/PathPicker) parsing algorithm and regular expressions.

## Contribute

Please do! This is an open source project. If you have a bug or want to discuss something, [open an issue](https://github.com/ruyadorno/extract-path/issues/new).

## License

[MIT](LICENSE) © 2018 [Ruy Adorno](http://ruyadorno.com)

