/**
 * Unit Tests for Priority 3: Fallback LLM, History Rerun & Trace Judge
 */

const assert = require('assert');
const path = require('path');

// Mock browser global environment
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
require(path.resolve(__dirname, '../../extension/core/judge.js'));
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
  console.log('--- Testing Priority 3: Fallback LLM, History Rerun & Trace Judge ---');

  // Test 1: LLMClient transparent fallback switching
  await test('LLMClient transparently switches to fallbackClient on primary failure', async () => {
    const primary = new global.LLMClient({ provider: 'gemini' });
    const fallback = new global.LLMClient({ provider: 'openai' });

    // Mock primary failure
    primary._executePlanStep = async () => {
      const err = new Error('Rate limit exceeded (429)');
      err.status = 429;
      throw err;
    };

    // Mock fallback success
    fallback._executePlanStep = async () => {
      return {
        thinking: 'Fallback executed successfully',
        action_name: 'click_element',
        parameters: { index: 5 },
      };
    };

    primary.fallbackClient = fallback;

    const result = await primary.planNextStep('system', { textPrompt: 'hello' });
    assert.strictEqual(primary.isUsingFallback, true);
    assert.strictEqual(result.action_name, 'click_element');
    assert.strictEqual(result.parameters.index, 5);
  });

  // Test 2: Agent handles fallback switch on 429 error
  await test('Agent handles fallback switch and retries step on 429', async () => {
    const mockSession = new global.BrowserSession();
    let emittedEvents = [];

    const primaryClient = new global.LLMClient({ model: 'primary-model' });
    const fallbackClient = new global.LLMClient({ model: 'fallback-model' });

    primaryClient.planNextStep = async () => {
      const err = new Error('HTTP 429: Too Many Requests');
      err.status = 429;
      throw err;
    };

    fallbackClient.planNextStep = async () => {
      return {
        thinking: 'Recovered via fallback',
        action_name: 'done',
        parameters: { text: 'Completed with fallback' },
      };
    };

    const agent = new global.Agent({
      task: 'Fallback test',
      browserSession: mockSession,
      llmClient: primaryClient,
      fallbackLlmClient: fallbackClient,
      onEvent: (evt) => emittedEvents.push(evt.event_type),
    });

    const runResult = await agent.run();
    assert.strictEqual(runResult.success, true);
    assert.strictEqual(agent.isUsingFallbackLlm, true);
    assert.strictEqual(agent.llmClient, fallbackClient);
    assert(emittedEvents.includes('FALLBACK_LLM_SWITCHED'), 'Expected FALLBACK_LLM_SWITCHED event');
  });

  // Test 3: Rerun history deterministic replay
  await test('rerunHistory successfully executes saved history trace', async () => {
    const mockSession = new global.BrowserSession();
    let executed = [];

    const agent = new global.Agent({
      task: 'Rerun test',
      browserSession: mockSession,
      llmClient: new global.LLMClient(),
    });

    agent.tools.execute = async (name, params) => {
      executed.push({ name, params });
      return { success: true, message: `Executed ${name}` };
    };

    const history = [
      { action: { name: 'navigate', parameters: { url: 'https://test.com' } } },
      { action: { name: 'click_element', parameters: { index: 3 } } },
      { action: { name: 'done', parameters: { text: 'Done replay' } } },
    ];

    const res = await agent.rerunHistory(history, { delayBetweenActions: 0 });
    assert.strictEqual(res.success, true);
    assert.strictEqual(executed.length, 3);
    assert.strictEqual(executed[0].name, 'navigate');
    assert.strictEqual(executed[1].name, 'click_element');
    assert.strictEqual(executed[2].name, 'done');
  });

  // Test 4: Rerun history retry and failure handling
  await test('rerunHistory retries transient failure and respects skipFailures', async () => {
    const mockSession = new global.BrowserSession();
    let attempts = 0;

    const agent = new global.Agent({
      task: 'Rerun retry test',
      browserSession: mockSession,
      llmClient: new global.LLMClient(),
    });

    agent.tools.execute = async (name, params) => {
      attempts++;
      if (attempts < 2) {
        return { success: false, error: 'Element temporarily detached' };
      }
      return { success: true, message: 'Recovered' };
    };

    const history = [
      { action: { name: 'click_element', parameters: { index: 1 } } },
    ];

    const res = await agent.rerunHistory(history, { maxRetries: 2, delayBetweenActions: 0 });
    assert.strictEqual(res.success, true);
    assert.strictEqual(attempts, 2);
  });

  // Test 5: Judge formats steps and includes ground truth
  await test('Judge constructs evaluation prompt with ground truth', async () => {
    const judge = new global.Judge();
    const history = [
      { step: 1, action: { name: 'navigate', parameters: { url: 'https://example.com' } }, result: { success: true } },
      { step: 2, action: { name: 'click_element', parameters: { index: 4 } }, result: { success: true } },
    ];

    const prompt = judge.constructJudgePrompt({
      task: 'Cari artikel tentang AI',
      finalResult: 'Ditemukan 5 artikel AI',
      history,
      groundTruth: 'Must return at least 3 articles from 2026',
    });

    assert(prompt.includes('Must return at least 3 articles from 2026'), 'Expected ground truth in prompt');
    assert(prompt.includes('[Step 1] Action: navigate'), 'Expected formatted step 1');
    assert(prompt.includes('[Step 2] Action: click_element'), 'Expected formatted step 2');
  });

  // Test 6: Judge evaluates trace and returns structured verdict
  await test('Judge evaluates trace and parses structured verdict', async () => {
    const mockLlm = new global.LLMClient();
    mockLlm.planNextStep = async () => {
      return {
        thinking: 'The agent satisfied all criteria',
        parameters: {
          verdict: true,
          reasoning: 'The agent accurately extracted all required models.',
          failure_reason: null,
          impossible_task: false,
          reached_captcha: false,
        },
      };
    };

    const judge = new global.Judge({ llmClient: mockLlm });
    const judgement = await judge.evaluateTrace({
      task: 'Highlight all text models',
      finalResult: 'Semua model disorot',
      history: [{ action: { name: 'highlight_sections' }, result: { success: true } }],
    });

    assert.strictEqual(judgement.verdict, true);
    assert(judgement.reasoning.includes('accurately extracted'));
    assert.strictEqual(judgement.failure_reason, null);
  });

  // Test 7: Agent judgeTrace integration
  await test('Agent judgeTrace emits TRACE_JUDGED event', async () => {
    const mockSession = new global.BrowserSession();
    let events = [];

    const mockLlm = new global.LLMClient();
    mockLlm.planNextStep = async () => {
      return {
        verdict: true,
        reasoning: 'Agent completed the user request successfully.',
        failure_reason: null,
      };
    };

    const agent = new global.Agent({
      task: 'Judge integration test',
      browserSession: mockSession,
      llmClient: mockLlm,
      onEvent: (evt) => events.push(evt),
    });

    agent.messageManager.recordStep(1, 'Thinking', { name: 'done', parameters: { text: 'Finished' } }, { success: true });

    const judgement = await agent.judgeTrace({ groundTruth: 'Success popup visible' });
    assert.strictEqual(judgement.verdict, true);

    const judgeEvt = events.find(e => e.event_type === 'TRACE_JUDGED');
    assert(judgeEvt !== undefined, 'Expected TRACE_JUDGED event');
    assert.strictEqual(judgeEvt.data.verdict, true);
  });

  console.log(`\nResults: ${passed}/${total} Priority 3 tests passed.\n`);
  if (passed !== total) process.exit(1);
}

runTests();
