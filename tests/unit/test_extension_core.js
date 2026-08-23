/**
 * Unit Tests: Deep Browser Standalone Extension Core
 * ==================================================
 *
 * Tests the JavaScript implementation of Browser Use architecture:
 *   1. DomService & XPath generator
 *   2. Tools & Action execution
 *   3. MessageManager & DOM tree prompt builder
 *   4. LLMClient JSON action parser & recovery
 *   5. Agent state machine lifecycle
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Mock browser global environment for Node.js
global.window = global;
global.chrome = {
  tabs: {
    query: async () => [{ id: 101, windowId: 1, url: 'https://pddikti.kemdiktisaintek.go.id', title: 'PDDikti' }],
    get: async (id) => ({ id, windowId: 1, url: 'https://pddikti.kemdiktisaintek.go.id', title: 'PDDikti' }),
    update: async (id, props) => ({ id, ...props }),
    create: async (props) => ({ id: 102, windowId: 1, ...props }),
    captureVisibleTab: async () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    onUpdated: { addListener: () => {}, removeListener: () => {} },
    onActivated: { addListener: () => {} },
  },
  scripting: {
    executeScript: async ({ func, args }) => {
      // Mock execution results
      return [{ result: { success: true, executed: true } }];
    },
  },
  storage: {
    local: {
      get: (keys, cb) => cb({}),
      set: (keys, cb) => cb && cb(),
    },
  },
};

// Load core scripts
require('../../extension/core/dom_service.js');
require('../../extension/core/browser_session.js');
require('../../extension/core/extractor.js');
require('../../extension/core/skills/skill_base.js');
require('../../extension/core/skills/research_skill.js');
require('../../extension/core/security_policy.js');
require('../../extension/core/widgets.js');
require('../../extension/core/tools.js');
require('../../extension/core/message_manager.js');
require('../../extension/core/llm_client.js');
require('../../extension/core/agent.js');


async function runTests() {
  console.log('--- Starting Standalone Extension Core Tests ---');
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
    }
  }

  // 1. DomService Tests
  test('DomService provides a serializable extraction function', () => {
    const fn = global.DomService.getExtractionFunction();
    assert.strictEqual(typeof fn, 'function');
    assert.strictEqual(fn.name, 'extractDOMStateInTab');
  });

  // 2. Tools & Schema Tests
  test('Tools provides full Browser Use action schemas', () => {
    const schemas = global.Tools.getActionSchemas();
    assert(Array.isArray(schemas));
    const names = schemas.map(s => s.name);
    assert(names.includes('click_element'));
    assert(names.includes('input_text'));
    assert(names.includes('navigate'));
    assert(names.includes('scroll_page'));
    assert(names.includes('send_keys'));
    assert(names.includes('done'));
  });

  await testAsync('Tools executes click_element correctly', async () => {
    const session = new global.BrowserSession({ tabId: 101 });
    session.cachedSelectorMap = { 1: { xpath: '//*[@id="search"]' } };
    const tools = new global.Tools(session);

    const res = await tools.execute('click_element', { index: 1 });
    assert.strictEqual(res.success, true);
  });

  await testAsync('Tools executes input_text and validates index', async () => {
    const session = new global.BrowserSession({ tabId: 101 });
    const tools = new global.Tools(session);

    const resInvalid = await tools.execute('input_text', { text: 'Muhammad Fadhli' });
    assert.strictEqual(resInvalid.success, false);
    assert(resInvalid.error.includes('numeric index'));

    const resValid = await tools.execute('input_text', { index: 2, text: 'Muhammad Fadhli' });
    assert.strictEqual(resValid.success, true);
  });

  await testAsync('Tools executes done action', async () => {
    const session = new global.BrowserSession({ tabId: 101 });
    const tools = new global.Tools(session);

    const res = await tools.execute('done', { text: 'Data mahasiswa ditemukan', success: true });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.is_done, true);
    assert.strictEqual(res.data.text, 'Data mahasiswa ditemukan');
  });

  // 3. MessageManager Tests
  test('MessageManager builds system prompt and step prompt', () => {
    const mm = new global.MessageManager({ task: 'Cari nama Muhammad Fadhli' });
    const systemPrompt = mm.getSystemPrompt();
    assert(systemPrompt.includes('You are Deep-Browser'));
    assert(systemPrompt.includes('click_element'));

    const mockState = {
      url: 'https://pddikti.kemdiktisaintek.go.id',
      title: 'Pencarian Mahasiswa',
      simplifiedTreeText: '[1]<input type="text" name="q" placeholder="Cari..." />\n[2]<button type="submit">Cari</button>',
      screenshot: 'base64_img',
      pageInfo: { viewport_width: 1280, viewport_height: 800, pixels_above: 0, pixels_below: 200 },
    };

    const payload = mm.buildStepPrompt(mockState, 1);
    assert(payload.textPrompt.includes('### CURRENT BROWSER STATE (Step 1)'));
    assert(payload.textPrompt.includes('[1]<input'));
    assert(payload.textPrompt.includes('Cari nama Muhammad Fadhli'));
    assert.strictEqual(payload.screenshotBase64, 'base64_img');
  });

  test('MessageManager records history for self-correction', () => {
    const mm = new global.MessageManager({ task: 'Test' });
    mm.recordStep(1, 'Thinking 1', { name: 'click_element', parameters: { index: 1 } }, { success: true });
    mm.recordStep(2, 'Thinking 2', { name: 'input_text', parameters: { index: 2, text: 'Hello' } }, { success: false, error: 'Not visible' });

    const historyText = mm.formatHistory();
    assert(historyText.includes('[Step 1] Action: `click_element`'));
    assert(historyText.includes('[Step 2] Action: `input_text`'));
    assert(historyText.includes('Failed (Not visible)'));
  });

  // 4. LLMClient Parser Tests
  test('LLMClient parses raw JSON response', () => {
    const client = new global.LLMClient();
    const raw = '{"thinking": "Looking for search input", "action_name": "input_text", "parameters": {"index": 1, "text": "Fadhli"}}';
    const decision = client._parseActionJSON(raw);
    assert.strictEqual(decision.thinking, 'Looking for search input');
    assert.strictEqual(decision.action_name, 'input_text');
    assert.strictEqual(decision.parameters.index, 1);
  });

  test('LLMClient parses JSON inside markdown code fence', () => {
    const client = new global.LLMClient();
    const raw = 'Here is the next step:\n```json\n{\n  "thinking": "Click search button",\n  "action_name": "click_element",\n  "parameters": {"index": 2}\n}\n```\nHope this helps!';
    const decision = client._parseActionJSON(raw);
    assert.strictEqual(decision.thinking, 'Click search button');
    assert.strictEqual(decision.action_name, 'click_element');
    assert.strictEqual(decision.parameters.index, 2);
  });

  // 5. Agent Lifecycle Tests
  await testAsync('Agent runs step loop and completes on done action', async () => {
    const events = [];
    const session = new global.BrowserSession({ tabId: 101 });
    session.getState = async () => ({
      url: 'https://pddikti.kemdiktisaintek.go.id',
      title: 'PDDikti',
      elements: [{ index: 1, tag: 'input', text: 'Cari' }],
      selectorMap: { 1: { xpath: '//*[@id="search"]' } },
      simplifiedTreeText: '[1]<input type="text" name="q" />',
      pageInfo: { viewport_width: 1280, viewport_height: 800 },
      screenshot: null,
    });

    let stepCount = 0;
    const mockLlm = {
      planNextStep: async (systemPrompt, payload) => {
        stepCount++;
        if (stepCount === 1) {
          return {
            thinking: 'Input student name',
            action_name: 'input_text',
            parameters: { index: 1, text: 'Muhammad Fadhli' },
          };
        }
        return {
          thinking: 'Information found on page',
          action_name: 'done',
          parameters: { text: 'Mahasiswa Muhammad Fadhli ditemukan: Teknik Informatika', success: true },
        };
      },
    };

    const agent = new global.Agent({
      task: 'Cari info mahasiswa',
      browserSession: session,
      llmClient: mockLlm,
      maxSteps: 5,
      onEvent: (evt) => events.push(evt.event_type),
    });

    const result = await agent.run();
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.totalSteps, 2);
    assert(result.result.includes('Teknik Informatika'));
    assert(events.includes('TASK_STARTED'));
    assert(events.includes('OBSERVATION'));
    assert(events.includes('REASONING'));
    assert(events.includes('TYPE'));
    assert(events.includes('TASK_COMPLETED'));
  });


  console.log(`\nResults: ${passed}/${total} tests passed.`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
