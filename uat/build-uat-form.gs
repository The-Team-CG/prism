/** One Google Form, one submission per module. See uat/README.md. */
var LEVELS = [
  'Passed - Working',
  'Partially Passed - Works but needs revision (w/ comment)',
  'Fail - Not Working',
  'Skipped - Di tinest (w/ comment)',
];
var COMMENT_TITLE = 'IF YOU SELECT PARTIALLY PASSED OR SKIPPED Please may we know your suggestion or the part that need to improve STRICTLY';
var ROLE_QUESTION = 'What is your user role?';
var MODULE_QUESTION = 'What module would you test?';
var SUBMISSION_PAGE = 'Tester details and submission';
var STATE_KEY = 'UAT_GRID_FORM_BUILD_V1';
var TIME_BUDGET_MS = 4.5 * 60 * 1000;

function buildUatForm() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var started = Date.now();
    var props = PropertiesService.getScriptProperties();
    var fingerprint = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(UAT_FORM))
      .map(function (byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); }).join('');
    var modules = allModules_();
    // Include page breaks in the content count to use the stricter limit.
    var itemCount = 1 + 2 * UAT_FORM.roles.length + 3 * modules.length + 3;
    var sectionCount = 2 + UAT_FORM.roles.length + modules.length;
    if (itemCount > 300 || sectionCount > 75) {
      throw new Error('Question bank exceeds Google Forms limits. Items: ' + itemCount + '; sections: ' + sectionCount);
    }
    var state = JSON.parse(props.getProperty(STATE_KEY) || 'null');
    if (state && state.fingerprint !== fingerprint) {
      throw new Error('Question bank changed. Run resetUatBuild to create a new form; the old form is preserved.');
    }
    var form = state ? FormApp.openById(state.formId) : FormApp.create(UAT_FORM.title, false);
    if (!state) {
      // Save before adding items so an interrupted shell can be rebuilt.
      state = { formId: form.getId(), fingerprint: fingerprint, next: 0, count: 0, shell: false, complete: false };
      props.setProperty(STATE_KEY, JSON.stringify(state));
    }
    if (state.complete) {
      logLinks_(form);
      return;
    }
    // Remove only unfinished builder items. Do not edit during a build.
    while (form.getItems().length > state.count) form.deleteItem(form.getItems().length - 1);
    if (!state.shell) {
      createFormShell_(form);
      state.shell = true;
      state.count = form.getItems().length;
      props.setProperty(STATE_KEY, JSON.stringify(state));
    }
    while (state.next < modules.length) {
      if (Date.now() - started > TIME_BUDGET_MS) {
        Logger.log('Built ' + state.next + ' of ' + modules.length + ' modules. Run buildUatForm again to continue.');
        Logger.log('Draft: ' + form.getEditUrl());
        return;
      }
      addModule_(form, modules[state.next]);
      state.next += 1;
      state.count = form.getItems().length;
      props.setProperty(STATE_KEY, JSON.stringify(state));
    }
    form.addPageBreakItem().setTitle(SUBMISSION_PAGE);
    form.addTextItem().setTitle('Tester name').setRequired(true);
    form.addDateItem().setTitle('Test date').setRequired(true);
    wireNavigation_(form);
    state.complete = true;
    state.count = form.getItems().length;
    props.setProperty(STATE_KEY, JSON.stringify(state));
    Logger.log('Complete: ' + itemCount + ' items, ' + sectionCount + ' sections. Review the draft, then publish in Google Forms.');
    logLinks_(form);
  } finally {
    lock.releaseLock();
  }
}

/** The next build creates a new form. Existing forms and responses remain. */
function resetUatBuild() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    PropertiesService.getScriptProperties().deleteProperty(STATE_KEY);
  } finally {
    lock.releaseLock();
  }
}

function createFormShell_(form) {
  form.setDescription(UAT_FORM.description)
    .setProgressBar(false)
    .setShowLinkToRespondAgain(true)
    .setLimitOneResponsePerUser(false)
    .setShuffleQuestions(false)
    .setPublishingSummary(false)
    .setConfirmationMessage('Thank you! Your result for this module was recorded. Click "Submit another response" to test another module. One submission per module.');
  form.addMultipleChoiceItem().setTitle(ROLE_QUESTION)
    .setHelpText('Choose the role you are testing as. Only its modules will be listed.')
    .setRequired(true);
  UAT_FORM.roles.forEach(function (role) {
    form.addPageBreakItem().setTitle(role.name).setHelpText(role.signIn);
    form.addMultipleChoiceItem().setTitle(MODULE_QUESTION)
      .setHelpText('Choose ONE module. Submit another response for your next module.')
      .setRequired(true);
  });
}

function addModule_(form, module) {
  var instructions = module.cases.map(function (testCase) {
    return testCase.id + ' - ' + testCase.title + '\nSteps: ' + testCase.steps + '\nExpected result: ' + testCase.expected;
  }).join('\n\n');
  form.addPageBreakItem().setTitle(modulePageTitle_(module))
    .setHelpText('Before you start: ' + module.setup + '\n\n' + instructions);
  form.addGridItem().setTitle('Satisfaction Level - ' + module.id)
    .setRows(module.cases.map(function (testCase) { return testCase.id + ' - ' + testCase.title; }))
    .setColumns(LEVELS).setRequired(true)
    .setHelpText('Select one rating in every row. Several rows may use the same rating.');
  form.addParagraphTextItem().setTitle(COMMENT_TITLE)
    .setHelpText('Format: Test Case ID - Comment\nOne line for EACH Partially Passed or Skipped case. Explain the revision or why it was not tested. Fail comments are encouraged.\nThis box is required for every module. If no case is Partially Passed or Skipped, write: ' + module.cases[0].id + ' - No revision or skipped-case comment needed.\nGoogle Forms checks the format and module IDs only. A reviewer checks that every relevant row has a matching comment.')
    .setRequired(true)
    .setValidation(FormApp.createParagraphTextValidation()
      .requireTextMatchesPattern(commentPattern_(module))
      .setHelpText('Use one line per comment: a test case ID from this module, then " - ", then a non-empty comment.')
      .build());
}

function wireNavigation_(form) {
  var pages = {};
  var moduleQuestions = {};
  var roleQuestion;
  var currentPage;
  var items = form.getItems();
  items.forEach(function (item) {
    if (item.getType() === FormApp.ItemType.PAGE_BREAK) {
      currentPage = item.getTitle();
      pages[currentPage] = item.asPageBreakItem();
    } else if (item.getType() === FormApp.ItemType.MULTIPLE_CHOICE) {
      if (item.getTitle() === ROLE_QUESTION) roleQuestion = item.asMultipleChoiceItem();
      if (item.getTitle() === MODULE_QUESTION) moduleQuestions[currentPage] = item.asMultipleChoiceItem();
    }
  });
  roleQuestion.setChoices(UAT_FORM.roles.map(function (role) {
    return roleQuestion.createChoice(role.name, pages[role.name]);
  }));
  UAT_FORM.roles.forEach(function (role) {
    var question = moduleQuestions[role.name];
    question.setChoices(role.modules.map(function (module) {
      return question.createChoice(modulePageTitle_(module), pages[modulePageTitle_(module)]);
    }));
  });
  // A page break controls the END of the preceding page. Choice routing on
  // selectors overrides this default. Every module skips to the final details.
  items.forEach(function (item) {
    if (item.getType() === FormApp.ItemType.PAGE_BREAK) {
      item.asPageBreakItem().setGoToPage(
        item.getTitle() === SUBMISSION_PAGE ? FormApp.PageNavigationType.CONTINUE : pages[SUBMISSION_PAGE]
      );
    }
  });
}

function commentPattern_(module) {
  var ids = module.cases.map(function (testCase) { return escapeRegex_(testCase.id); }).join('|');
  var line = '[ \\t]*(?:' + ids + ')[ \\t]*-[ \\t]*[^\\s][^\\r\\n]*';
  return '^' + line + '(?:\\r?\\n' + line + ')*[ \\t]*(?:\\r?\\n)?$';
}
function allModules_() {
  return UAT_FORM.roles.reduce(function (modules, role) { return modules.concat(role.modules); }, []);
}
function modulePageTitle_(module) { return module.id + ' · ' + module.name; }
function escapeRegex_(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function logLinks_(form) {
  Logger.log('Edit link: ' + form.getEditUrl());
  Logger.log('Tester link (available after publication): ' + form.getPublishedUrl());
}
