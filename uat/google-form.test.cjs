const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

// Simulate the documented Forms service. These checks do not exercise Google's UI.
function harness() {
  const forms = [];
  const properties = new Map();
  let failAt;
  let writes = 0;
  class Item {
    constructor(type) { this.type = type; }
    getType() { return this.type; }
    getTitle() { return this.title; }
    setTitle(value) { this.title = value; return this; }
    setHelpText(value) { this.help = value; return this; }
    setRequired(value) { this.required = value; return this; }
    setRows(value) { this.rows = [...value]; return this; }
    setColumns(value) { this.columns = [...value]; return this; }
    setValidation(value) { this.validation = value; return this; }
    setChoices(value) { this.choices = value; return this; }
    setGoToPage(value) { this.destination = value; return this; }
    createChoice(label, target) { return { label, target }; }
    asPageBreakItem() { assert.equal(this.type, 'PAGE_BREAK'); return this; }
    asMultipleChoiceItem() { assert.equal(this.type, 'MULTIPLE_CHOICE'); return this; }
  }
  class Form {
    constructor(title, published) { this.title = title; this.published = published; this.items = []; this.id = forms.length; forms.push(this); }
    getId() { return this.id; }
    getItems() { return [...this.items]; }
    getEditUrl() { return 'mock:edit/' + this.id; }
    getPublishedUrl() { return 'mock:view/' + this.id; }
    deleteItem(index) { this.items.splice(index, 1); }
    add(type) {
      if (++writes === failAt) throw new Error('Simulated interruption');
      const item = new Item(type); this.items.push(item); return item;
    }
    addMultipleChoiceItem() { return this.add('MULTIPLE_CHOICE'); }
    addPageBreakItem() { return this.add('PAGE_BREAK'); }
    addGridItem() { return this.add('GRID'); }
    addParagraphTextItem() { return this.add('PARAGRAPH_TEXT'); }
    addTextItem() { return this.add('TEXT'); }
    addDateItem() { return this.add('DATE'); }
  }
  for (const method of ['setDescription', 'setProgressBar', 'setShowLinkToRespondAgain', 'setLimitOneResponsePerUser', 'setShuffleQuestions', 'setPublishingSummary', 'setConfirmationMessage']) {
    Form.prototype[method] = function(value) { this[method.slice(3)] = value; return this; };
  }
  const context = vm.createContext({
    FormApp: {
      ItemType: { PAGE_BREAK: 'PAGE_BREAK', MULTIPLE_CHOICE: 'MULTIPLE_CHOICE' },
      PageNavigationType: { CONTINUE: 'CONTINUE', SUBMIT: 'SUBMIT' },
      create: (title, published) => new Form(title, published),
      openById: (id) => forms[id],
      createParagraphTextValidation: () => ({
        requireTextMatchesPattern(pattern) { this.pattern = pattern; return this; },
        setHelpText() { return this; },
        build() { return { pattern: this.pattern }; },
      }),
    },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (key) => properties.get(key),
      setProperty: (key, value) => { assert.ok(Buffer.byteLength(value) < 9000); properties.set(key, value); },
      deleteProperty: (key) => properties.delete(key),
    }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, computeDigest: (algorithm, value) => [...crypto.createHash(algorithm).update(value).digest()] },
    Logger: { log() {} },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'PRISM-UAT-Google-Form.gs'), 'utf8'), context);
  return { context, forms, interruptAfter(number) { failAt = writes + number; } };
}

test('every role routes only to its modules, and each module finishes at details then submit', () => {
  const { context: c, forms } = harness();
  c.buildUatForm();
  const form = forms[0];
  assert.equal(form.items.length, 167);
  assert.equal(form.items.filter(i => i.type === 'PAGE_BREAK').length + 1, 58);
  assert.equal(form.items.filter(i => i.type === 'GRID').reduce((sum, i) => sum + i.rows.length, 0), 197);
  assert.equal(form.published, false);
  assert.equal(form.LimitOneResponsePerUser, false);
  const details = form.items.find(i => i.title === c.SUBMISSION_PAGE);
  const roleQuestion = form.items[0];
  assert.equal(roleQuestion.title, 'What is your user role?');
  assert.equal(roleQuestion.choices.length, 5);
  for (const role of c.UAT_FORM.roles) {
    const rolePage = roleQuestion.choices.find(choice => choice.label === role.name).target;
    const moduleQuestion = form.items[form.items.indexOf(rolePage) + 1];
    assert.equal(moduleQuestion.title, 'What module would you test?');
    assert.deepEqual(Array.from(moduleQuestion.choices, choice => choice.label), Array.from(role.modules, m => c.modulePageTitle_(m)));
    for (const module of role.modules) {
      const modulePage = moduleQuestion.choices.find(choice => choice.label === c.modulePageTitle_(module)).target;
      const start = form.items.indexOf(modulePage);
      const grid = form.items[start + 1];
      const comment = form.items[start + 2];
      assert.equal(grid.type, 'GRID');
      assert.equal(grid.required, true);
      assert.deepEqual(grid.rows, Array.from(module.cases, tc => tc.id + ' - ' + tc.title));
      assert.deepEqual(grid.columns, Array.from(c.LEVELS));
      assert.equal(comment.type, 'PARAGRAPH_TEXT');
      assert.equal(comment.required, true);
      assert.equal(comment.title, c.COMMENT_TITLE);
      for (const tc of module.cases) { assert.ok(modulePage.help.includes(tc.steps)); assert.ok(modulePage.help.includes(tc.expected)); }
      const nextBreak = form.items[start + 3];
      const target = nextBreak.destination === 'CONTINUE' ? nextBreak : nextBreak.destination;
      assert.equal(target, details, module.id + ' must skip all other modules');
    }
  }
  assert.deepEqual(form.items.slice(-2).map(i => [i.title, i.required]), [['Tester name', true], ['Test date', true]]);
});

test('comments accept module IDs and multiple lines, rejecting empty text and foreign IDs', () => {
  const { context: c } = harness();
  for (const module of c.allModules_()) {
    const regex = new RegExp(c.commentPattern_(module));
    const first = module.cases[0].id;
    const last = module.cases.at(-1).id;
    for (const value of [first + ' - Revise this field.', first + ' - Revise.\n' + last + ' - Not tested.', first + ' - No revision or skipped-case comment needed.', first + ' - One.\r\n' + last + ' - Two.\r\n']) {
      assert.ok(regex.test(value), value);
    }
    for (const value of ['', ' ', first + ' - ', first + ' -\n', 'N/A', 'OTHER-01 - Text', first + ' - Good\nOTHER-01 - Text', first + ' - Good\nUnlabelled comment']) {
      assert.equal(regex.test(value), false, module.id + ': ' + value);
    }
  }
});

test('interrupted shell, module, and final details recover without duplicates; reruns reuse the form', () => {
  for (const interruption of [3, 14, 166]) {
    const h = harness();
    h.interruptAfter(interruption);
    assert.throws(() => h.context.buildUatForm(), /Simulated interruption/);
    h.context.buildUatForm();
    h.context.buildUatForm();
    assert.equal(h.forms.length, 1);
    assert.equal(h.forms[0].items.length, 167);
    assert.equal(h.forms[0].items.filter(i => i.type === 'GRID').length, 51);
  }
});

test('changed banks require an explicit reset, which preserves the original form', () => {
  const h = harness();
  h.context.buildUatForm();
  h.context.UAT_FORM.roles[0].modules[0].cases[0].steps += ' Changed.';
  assert.throws(() => h.context.buildUatForm(), /Question bank changed/);
  h.context.resetUatBuild();
  h.context.buildUatForm();
  assert.equal(h.forms.length, 2);
  assert.equal(h.forms[0].items.length, 167);
  assert.equal(h.forms[1].items.length, 167);
});

test('oversized question banks fail before creating an unusable form', () => {
  const h = harness();
  const modules = h.context.UAT_FORM.roles[0].modules;
  while (modules.length < 100) modules.push(modules[0]);
  assert.throws(() => h.context.buildUatForm(), /exceeds Google Forms limits/);
  assert.equal(h.forms.length, 0);
});
