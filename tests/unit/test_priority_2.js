/**
 * Unit Tests for Priority 2: Multi-Action Pipeline and Plan State Machine
 */

const assert = require('assert');
const path = require('path');

// Mock chrome environment
global.window = global;
global.chrome = {
  tabs: {
    query: async () => [{ id: 101, url: 'https://example.com', title: 'Example' }],
    get: async (id) => ({ id, url: 'https://example.com', title: 'Example' }),
  },
  windows: {
    getAll: async () => [{ id: 1, focused: true, tabs: [{ id: 101, active: true, url: 'https://example.com' }] }],
  },
  runtime: {
    sendMessage: () => {},
    onMessage: { addListener: () => {} },
  },
};

// Load core files
require(path.resolve(__dirname, '../../extension/core/loop_detector.js'));
require(path.resolve(__dirname, '../../extension/core/message_manager.js'));
require(path.resolve(__dirname, '../../extension/core/tools.js'));
require(path.resolve(__dirname, '../../extension/core/browser_session.js'));
require(path.resolve(__dirname, '../../extension/core/llm_client.js'));
require(path.resolve(__dirname, '../../extension/core/agent.js'));

let passed = 0;
let total = 0;

async function test(name, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    console.error(err.stack);
  }
}

async function runTests() {
  console.log('--- Testing Priority 2: Multi-Action & Plan State Machine ---');

  // Test 1: Plan initialization and rendering
  await test('Plan State Machine initializes plan and renders correct status markers', async () => {
    const mockSession = new global.BrowserSession();
    const agent = new global.Agent({
      task: 'Plan test',
      browserSession: mockSession,
      llmClient: new global.LLMClient(),
    });

    agent._updatePlanFromModelOutput({
      plan_update: ['Buka halaman utama', 'Cari produk laptop', 'Pilih spesifikasi', 'Beli produk'],
    });

    assert.strictEqual(agent.plan.length, 4);
    assert.strictEqual(agent.plan[0].status, 'current');
    assert.strictEqual(agent.plan[1].status, 'pending');

    const desc = agent._renderPlanDescription();
    assert(desc.includes('[>] 0: Buka halaman utama'), 'Expected step 0 to be [>]');
    assert(desc.includes('[ ] 1: Cari produk laptop'), 'Expected step 1 to be [ ]');
  });

  // Test 2: Advancing plan state
  await test('Plan State Machine advances plan and marks previous steps done', async () => {
    const mockSession = new global.BrowserSession();
    const agent = new global.Agent({
      task: 'Plan test',
      browserSession: mockSession,
      llmClient: new global.LLMClient(),
    });

    agent._updatePlanFromModelOutput({
      plan_update: ['Step 1', 'Step 2', 'Step 3'],
    });

    // Advance to step index 2
    agent._updatePlanFromModelOutput({ current_plan_item: 2 });

    assert.strictEqual(agent.plan[0].status, 'done');
    assert.strictEqual(agent.plan[1].status, 'done');
    assert.strictEqual(agent.plan[2].status, 'current');

    const desc = agent._renderPlanDescription();
    assert(desc.includes('[x] 0: Step 1'), 'Expected step 0 to be [x]');
    assert(desc.includes('[x] 1: Step 2'), 'Expected step 1 to be [x]');
    assert(desc.includes('[>] 2: Step 3'), 'Expected step 2 to be [>]');
  });

  // Test 3: Plan stall replan nudge
  await test('Plan State Machine injects replan nudge after consecutive failures', async () => {
    const mockSession = new global.BrowserSession();
    const agent = new global.Agent({
      task: 'Plan stall test',
      browserSession: mockSession,
      llmClient: new global.LLMClient(),
      planningReplanOnStall: 3,
    });

    agent._updatePlanFromModelOutput({
      plan_update: ['Step 1', 'Step 2'],
    });

    assert.strictEqual(agent._getPlanNudge(), null);

    agent.consecutiveActionFailures = 3;
    const nudge = agent._getPlanNudge();
    assert(nudge !== null, 'Expected replan nudge');
    assert(nudge.includes('REPLAN SUGGESTED: You have failed 3 consecutive times'));
  });

  // Test 4: LLM Client parsing of multi-action and plan update
  await test('LLMClient parses multi-action array and plan fields from JSON response', async () => {
    const client = new global.LLMClient();
    const raw = JSON.stringify({
      thinking: 'Executing multiple actions and initializing plan',
      plan_update: ['Step A', 'Step B'],
      current_plan_item: 0,
      actions: [
        { action_name: 'input_text', parameters: { index: 1, text: 'hello' } },
        { action_name: 'click_element', parameters: { index: 2 } },
      ],
    });

    const parsed = client._validateActionObject(JSON.parse(raw));
    assert.strictEqual(parsed.plan_update.length, 2);
    assert.strictEqual(parsed.current_plan_item, 0);
    assert.strictEqual(parsed.actions.length, 2);
    assert.strictEqual(parsed.actions[0].action_name, 'input_text');
    assert.strictEqual(parsed.actions[1].action_name, 'click_element');
    assert.strictEqual(parsed.action_name, 'input_text'); // backward compatibility
  });

  // Test 5: multiAct executes sequential actions
  await test('multiAct executes multiple actions sequentially', async () => {
    const mockSession = new global.BrowserSession();
    let executed = [];

    const agent = new global.Agent({
      task: 'Multi-act test',
      browserSession: mockSession,
      llmClient: new global.LLMClient(),
    });

    // Mock tools execution
    agent.tools.execute = async (name, params) => {
      executed.push({ name, params });
      return { success: true, message: `Executed ${name}` };
    };

    const results = await agent.multiAct([
      { action_name: 'click_element', parameters: { index: 1 } },
      { action_name: 'click_element', parameters: { index: 2 } },
    ]);

    assert.strictEqual(results.length, 2);
    assert.strictEqual(executed.length, 2);
    assert.strictEqual(executed[0].params.index, 1);
    assert.strictEqual(executed[1].params.index, 2);
  });

  // Test 6: multiAct aborts remaining actions on action failure
  await test('multiAct stops subsequent actions if an action fails', async () => {
    const mockSession = new global.BrowserSession();
    let executed = [];

    const agent = new global.Agent({
      task: 'Multi-act fail test',
      browserSession: mockSession,
      llmClient: new global.LLMClient(),
    });

    agent.tools.execute = async (name, params) => {
      executed.push(name);
      if (params.index === 1) {
        return { success: false, error: 'Element not found' };
      }
      return { success: true };
    };

    const results = await agent.multiAct([
      { action_name: 'click_element', parameters: { index: 1 } },
      { action_name: 'click_element', parameters: { index: 2 } },
    ]);

    assert.strictEqual(results.length, 1);
    assert.strictEqual(executed.length, 1);
    assert.strictEqual(results[0].success, false);
  });

  // Test 7: multiAct single-action done guard
  await test('multiAct prevents calling done as part of a multi-action batch', async () => {
    const mockSession = new global.BrowserSession();
    let executed = [];

    const agent = new global.Agent({
      task: 'Done guard test',
      browserSession: mockSession,
      llmClient: new global.LLMClient(),
    });

    agent.tools.execute = async (name, params) => {
      executed.push(name);
      return { success: true };
    };

    const results = await agent.multiAct([
      { action_name: 'click_element', parameters: { index: 1 } },
      { action_name: 'done', parameters: { text: 'All done' } },
    ]);

    assert.strictEqual(executed.length, 1);
    assert.strictEqual(executed[0], 'click_element');
    assert.strictEqual(results.length, 1);
  });

  // Test 8: multiAct static sequence-terminating guard (navigate)
  await test('multiAct stops sequence when navigation action is executed', async () => {
    const mockSession = new global.BrowserSession();
    let executed = [];

    const agent = new global.Agent({
      task: 'Navigate guard test',
      browserSession: mockSession,
      llmClient: new global.LLMClient(),
    });

    agent.tools.execute = async (name, params) => {
      executed.push(name);
      return { success: true };
    };

    const results = await agent.multiAct([
      { action_name: 'navigate', parameters: { url: 'https://google.com' } },
      { action_name: 'click_element', parameters: { index: 5 } },
    ]);

    assert.strictEqual(executed.length, 1);
    assert.strictEqual(executed[0], 'navigate');
  });

  // Test 9: multiAct runtime URL change guard
  await test('multiAct stops sequence when runtime URL changes', async () => {
    const mockSession = new global.BrowserSession();
    let currentUrl = 'https://initial.com';
    mockSession.getCurrentUrl = async () => currentUrl;

    let executed = [];

    const agent = new global.Agent({
      task: 'Runtime URL guard test',
      browserSession: mockSession,
      llmClient: new global.LLMClient(),
    });

    agent.tools.execute = async (name, params) => {
      executed.push(name);
      // Simulate click causing client-side routing/URL mutation
      currentUrl = 'https://changed.com';
      return { success: true };
    };

    const results = await agent.multiAct([
      { action_name: 'click_element', parameters: { index: 1 } },
      { action_name: 'click_element', parameters: { index: 2 } },
    ]);

    assert.strictEqual(executed.length, 1);
    assert.strictEqual(executed[0], 'click_element');
  });

  console.log(`\nResults: ${passed}/${total} Priority 2 tests passed.\n`);
  if (passed !== total) process.exit(1);
}

runTests();
