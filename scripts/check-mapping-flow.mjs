import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';

const source = await readFile('app/components/QuizEditor.tsx', 'utf8');
const helpers = source.slice(source.indexOf('function tagsFor('), source.indexOf('function isDosha('));
const compiled = await transform(helpers, { loader: 'ts' });
const select = new Function('slugTag', `${compiled.code}; return selectableTags;`)(value => value.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
const quiz = {
  quick: [{ options: [{ label: 'Dry', tags: ['dry', 'shared'] }, { label: 'No explicit tag' }] }],
  deep: [{ options: [{ label: 'Warm', tags: ['warm', 'shared'] }] }],
};
const products = [{ tags: ['Catalog only'] }];
assert.deepEqual(select(quiz, products, 'quick'), ['dry', 'shared', 'no_explicit_tag']);
assert.deepEqual(select(quiz, products, 'deep'), ['warm', 'shared']);
assert.deepEqual(select(quiz, products, 'scan'), ['catalog_only']);
assert.deepEqual(select({ ...quiz, quick: [] }, products, 'quick'), []);
console.log('PASS: mapping tags follow the selected quiz flow, including fallback answer tags and empty flows.');
