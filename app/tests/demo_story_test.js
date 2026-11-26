const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    textContent: '',
    innerHTML: '',
    style: {},
    classes: new Set(),
    classList: {
      toggle(name, force) {
        const on = force === undefined ? !this._el.classes.has(name) : force;
        if (on) this._el.classes.add(name); else this._el.classes.delete(name);
        return on;
      },
      _el: null
    }
  });
  const el = elements.get(id);
  el.classList._el = el;
  return el;
}
const document = { getElementById: element };
const window = {};
vm.runInNewContext(fs.readFileSync(__dirname + '/../demo_story.js', 'utf8'), { window, document, Set });

const story = window.DemoStory.create();
assert.equal(story.getState().chapter, 0);
assert.equal(story.getState().currentId, 'village');

// Out-of-order discovery is remembered but cannot spoil or skip the story.
assert.equal(story.visit('bridge').type, 'unresolved');
assert.equal(story.getState().chapter, 0);
assert.deepEqual(story.getState().earlyVisits, ['bridge']);

const expected = ['village', 'bridge', 'grove', 'ruins', 'mother', 'cave'];
for (let i = 0; i < expected.length; i++) {
  const result = story.visit(expected[i]);
  assert.equal(result.type, i === expected.length - 1 ? 'complete' : 'clue');
  assert.equal(story.getState().chapter, i + 1);
}
assert.equal(story.getState().completed, true);
assert.equal(story.getState().notes.length, 6);
assert.equal(story.getState().currentId, null);
assert.equal(story.visit('cave'), null);

story.render();
assert.equal(element('journeyPlace').textContent, '旅程暂告一段落');
assert.equal(element('journeyProgress').style.width, '100%');
assert.match(element('journalEntries').innerHTML, /古道仍在延伸/);
console.log('PASS: Lost Road story progression, out-of-order clue handling, journal rendering, and ending.');
