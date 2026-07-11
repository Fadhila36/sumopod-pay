const assert = require('node:assert');
const { SumoPodClient } = require('../../dist/index.cjs');

console.log('Testing CJS require...');
assert(typeof SumoPodClient === 'function', 'SumoPodClient should be a class/function');

console.log('CJS require smoke test passed successfully.');
