import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const files = [];
function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const path = `${dir}/${entry.name}`; if (entry.isDirectory()) walk(path); else if (/\.tsx$/.test(path)) files.push(path); } }
walk('app');
for (const file of files) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && /^set[A-Z]/.test(node.expression.text)) {
      for (const arg of node.arguments) if (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) {
        assert.doesNotMatch(arg.getText(source), /\b(?:event|e)\.(?:currentTarget|target)\b/, `${file}: deferred state updater must not read event targets`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
const source = ts.createSourceFile('QuizEditor.tsx', fs.readFileSync('app/components/QuizEditor.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
function find(node) {
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 's-checkbox') {
    const attrs = node.attributes.properties;
    if (attrs.some(a => a.name?.getText(source) === 'label' && a.initializer?.text === 'Add email capture at the end of this quiz')) handler = attrs.find(a => a.name?.getText(source) === 'onChange').initializer.expression;
  }
  ts.forEachChild(node, find);
}
find(source);
assert.ok(handler);
const js = ts.transpile(`const handler = ${handler.getText(source)};`, { target: ts.ScriptTarget.ES2022 });
for (const enabled of [true, false]) {
  let queued;
  const onChange = new Function('setQuiz', `${js}; return handler;`)(updater => { queued = updater; });
  const event = { currentTarget: { checked: enabled } };
  onChange(event);
  event.currentTarget = null;
  const next = queued({ name: 'Existing', emailCapture: { heading: 'Custom heading', button: 'Show result', allowSkip: false } });
  assert.equal(next.emailCapture.enabled, enabled);
  assert.equal(next.emailCapture.heading, 'Custom heading');
  assert.equal(next.emailCapture.allowSkip, false);
}
console.log('Editor event lifetime regression checks passed; all app state updaters audited.');
