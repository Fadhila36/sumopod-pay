import assert from 'node:assert';
import { SumoPodClient } from '../../dist/index.js';

console.log('Testing ESM import...');
assert(typeof SumoPodClient === 'function', 'SumoPodClient should be a class/function');

console.log('ESM import smoke test passed successfully.');
