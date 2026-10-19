import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
const source=(await readFile('app/scan-appearance.server.ts','utf8')).replace('import prisma from "./db.server";','const prisma = {};');
const compiled=await transform(source,{loader:'ts',format:'cjs'});const module={exports:{}};new Function('module',compiled.code)(module);
const {normalizeAppearance}=module.exports;
const defaults=normalizeAppearance({});
assert.equal(defaults.shape,'circle');assert.equal(defaults.buttonColor,'#e8f0eb');assert.equal(defaults.buttonTextColor,'#284c37');assert.equal(defaults.accentColor,'#52695a');assert.equal(defaults.modalFontSize,14);assert.equal(defaults.iconImage,'');
assert.equal(normalizeAppearance({shape:'rounded',buttonColor:'#123456'}).shape,'rounded');assert.equal(normalizeAppearance({shape:'rounded',buttonColor:'#123456'}).buttonColor,'#123456');
assert.equal(normalizeAppearance({iconImage:'https://example.com/icon.png'}).iconImage,'https://example.com/icon.png');
console.log('PASS: new stores default to the illustrated circle; saved shapes, colors, and uploaded icons are preserved.');

for(const color of ["#303030","#4a2c21","#123456"]) assert.equal(normalizeAppearance({modalButtonColor:color}).modalButtonColor,color);
assert.equal(normalizeAppearance({mobileModalRadius:18}).mobileModalRadius,18);
console.log("PASS: merchant popup colors and mobile corners are preserved without legacy overrides.");
