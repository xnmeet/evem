# evem-logger
This is a simple log package.

## Usage
### Install
```
npm install evem-logger
```
### Example
```js
import {info,debug} from 'evem-logger'
info('This is info')
debug('This is debug')
```
------

`debug` is only valid when `process.env.VERBOSE` have value

