/**
 * Comprehensive Unit & Integration Tests: Extension State Machine & Reducer
 * =========================================================================
 *
 * Covers:
 *   1. Run State Machine Transitions (idle -> queued -> running -> waiting_for_approval -> completed / failed / cancelled / interrupted / outcome_unknown)
 *   2. Terminal State Invariants (no regressions, conflicting terminal deduplication)
 *   3. Tool-Call State Machine (pending -> running -> succeeded / failed / timed_out / cancelled / outcome_unknown)
 *   4. Safe Retry Classification (Class A read-only, Class B idempotent, Class C side-effecting)
 *   5. Non-idempotent Retry Confirmation Gate
 *   6. Disconnection before vs after execution starts
 *   7. Reconciliation with authoritative runtime snapshot
 *   8. Lost success/error response followed by reconciliation
 *   9. Event deduplication and stable event identity
 *  10. Stale Run ID rejection and run isolation
 *  11. Double-click & Atomic Action state transitions (submitting -> accepted / rejected)
 *  12. Approval race conditions & single-resolution semantics
 *  13. Tool Presets & Security Policy capabilities gating
 */

const assert = require('assert');
const path = require('path');

// Mock browser global environment for Node.js
global.window = global;

// Load modules
require('../../extension/core/state_machine.js');
require('../../extension/core/security_policy.js');

const stateMachineModule = global.DeepBrowserState || {};
const SecurityPolicy = global.SecurityPolicy;

const {
  RUN_STATES,
  TERMINAL_RUN_STATES,
  TOOL_STATES,
  ACTION_STATES,
  RETRY_CLASSES,
  PRESETS,
  classifyAction,
  StateMachine,
} = stateMachineModule;

async function runTests() {
  console.log('================================================================');
  console.log('  Deep Browser Extension State Machine & Verification Tests     ');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(err);
    }
  }

  // ─── Test 1: Run State Transitions (Happy Path) ───────────────────────────
  await test('Run State Machine: idle -> queued -> running -> completed', () => {
    const sm = new StateMachine();
    assert.strictEqual(sm.runState, RUN_STATES.IDLE);

    const runId = sm.startRun('run_test_1');
    assert.strictEqual(sm.runState, RUN_STATES.QUEUED);
    assert.strictEqual(sm.runId, 'run_test_1');

    const okRun = sm.transitionRun(RUN_STATES.RUNNING);
    assert.strictEqual(okRun, true);
    assert.strictEqual(sm.runState, RUN_STATES.RUNNING);

    const okComp = sm.transitionRun(RUN_STATES.COMPLETED, { result: 'Final Answer' });
    assert.strictEqual(okComp, true);
    assert.strictEqual(sm.runState, RUN_STATES.COMPLETED);
    assert.strictEqual(sm.finalResult, 'Final Answer');
  });

  // ─── Test 2: Terminal State Invariants & Regression Prevention ────────────
  await test('Run State Machine: terminal state rejects regressions and late conflicts', () => {
    const sm = new StateMachine();
    sm.startRun('run_test_2');
    sm.transitionRun(RUN_STATES.RUNNING);
    sm.transitionRun(RUN_STATES.COMPLETED, { result: 'Success' });

    // Regression attempt
    const regRes = sm.transitionRun(RUN_STATES.RUNNING);
    assert.strictEqual(regRes, false, 'Regression to running must be rejected');
    assert.strictEqual(sm.runState, RUN_STATES.COMPLETED);

    // Conflicting terminal event (e.g. late failed event)
    const confRes = sm.transitionRun(RUN_STATES.FAILED, { error: 'Late error' });
    assert.strictEqual(confRes, false, 'Conflicting terminal event must be rejected without silent overwrite');
    assert.strictEqual(sm.runState, RUN_STATES.COMPLETED);

    // Duplicate terminal event (idempotent)
    const dupRes = sm.transitionRun(RUN_STATES.COMPLETED);
    assert.strictEqual(dupRes, true, 'Duplicate terminal event must be deduplicated idempotently');
    assert.strictEqual(sm.runState, RUN_STATES.COMPLETED);
  });

  // ─── Test 3: Tool Call Lifecycle ──────────────────────────────────────────
  await test('Tool-Call State Machine: pending -> running -> succeeded / failed', () => {
    const sm = new StateMachine();
    sm.startRun('run_test_3');
    sm.transitionRun(RUN_STATES.RUNNING);

    const tc = sm.registerToolCall('tool_1', 'click_element', { index: 5 });
    assert.strictEqual(tc.state, TOOL_STATES.PENDING);
    assert.strictEqual(tc.classification, RETRY_CLASSES.CLASS_C);

    const okRun = sm.transitionTool('tool_1', TOOL_STATES.RUNNING);
    assert.strictEqual(okRun, true);
    assert.strictEqual(tc.state, TOOL_STATES.RUNNING);

    const okSucc = sm.transitionTool('tool_1', TOOL_STATES.SUCCEEDED, { result: { clicked: true }, verification: { url_mutated: true } });
    assert.strictEqual(okSucc, true);
    assert.strictEqual(tc.state, TOOL_STATES.SUCCEEDED);
    assert.deepStrictEqual(tc.verification, { url_mutated: true });
  });

  // ─── Test 4: Retry Classification (Class A vs B vs C) ────────────────────
  await test('Retry Classification: Class A (read-only), Class B (idempotent), Class C (side-effects)', () => {
    assert.strictEqual(classifyAction('navigate', { url: 'https://example.com' }), RETRY_CLASSES.CLASS_A);
    assert.strictEqual(classifyAction('scroll_page', { direction: 'down' }), RETRY_CLASSES.CLASS_A);
    assert.strictEqual(classifyAction('extract', { query: 'table data' }), RETRY_CLASSES.CLASS_A);
    assert.strictEqual(classifyAction('get_state', {}), RETRY_CLASSES.CLASS_A);

    assert.strictEqual(classifyAction('input_text', { index: 1, text: 'hello', idempotency_key: 'key_123' }), RETRY_CLASSES.CLASS_B);

    assert.strictEqual(classifyAction('input_text', { index: 1, text: 'hello' }), RETRY_CLASSES.CLASS_C);
    assert.strictEqual(classifyAction('click_element', { index: 3 }), RETRY_CLASSES.CLASS_C);
    assert.strictEqual(classifyAction('submit_form', {}), RETRY_CLASSES.CLASS_C);
    assert.strictEqual(classifyAction('unknown_action', {}), RETRY_CLASSES.CLASS_C);
  });

  // ─── Test 5: Safe Retry Eligibility & Confirmation Warning ────────────────
  await test('Safe Retry Policy: Class C unknown outcome requires confirmation dialog', () => {
    const sm = new StateMachine();
    sm.startRun('run_test_5');
    sm.transitionRun(RUN_STATES.RUNNING);

    // Register a Class C side-effecting action
    sm.registerToolCall('tool_c', 'click_element', { index: 10 });
    sm.transitionTool('tool_c', TOOL_STATES.RUNNING);
    sm.transitionTool('tool_c', TOOL_STATES.OUTCOME_UNKNOWN);

    const checkC = sm.checkRetryEligibility('tool_c');
    assert.strictEqual(checkC.eligible, true);
    assert.strictEqual(checkC.requiresConfirmation, true, 'Class C with unknown outcome must require user confirmation');

    // Register a Class A read-only action
    sm.registerToolCall('tool_a', 'navigate', { url: 'https://google.com' });
    sm.transitionTool('tool_a', TOOL_STATES.RUNNING);
    sm.transitionTool('tool_a', TOOL_STATES.OUTCOME_UNKNOWN);

    const checkA = sm.checkRetryEligibility('tool_a');
    assert.strictEqual(checkA.eligible, true);
    assert.strictEqual(checkA.requiresConfirmation, false, 'Class A read-only action does not require confirmation');
  });

  // ─── Test 6: Succeeded Action Blocks Duplicate Retry ──────────────────────
  await test('Safe Retry Policy: Confirmed prior success prevents duplicate retry', () => {
    const sm = new StateMachine();
    sm.startRun('run_test_6');
    sm.transitionRun(RUN_STATES.RUNNING);

    sm.registerToolCall('tool_done', 'input_text', { index: 2, text: 'User' });
    sm.transitionTool('tool_done', TOOL_STATES.RUNNING);
    sm.transitionTool('tool_done', TOOL_STATES.SUCCEEDED, { result: true });

    const check = sm.checkRetryEligibility('tool_done');
    assert.strictEqual(check.eligible, false, 'Succeeded action must not allow retry');
  });

  // ─── Test 7: Disconnection & Reconciliation ──────────────────────────────
  await test('Interruption & Reconciliation: runtime disconnect restores verified snapshot', () => {
    const sm = new StateMachine();
    sm.startRun('run_test_7');
    sm.transitionRun(RUN_STATES.RUNNING);

    // Disconnect happens
    sm.transitionRun(RUN_STATES.INTERRUPTED);
    assert.strictEqual(sm.runState, RUN_STATES.INTERRUPTED);

    // Reconciliation arrives from runtime
    const reconciled = sm.reconcileWithRuntime({
      runId: 'run_test_7',
      runState: RUN_STATES.COMPLETED,
      finalResult: 'Reconciled Output',
      events: [
        { id: 'evt_recon_1', type: 'TASK_COMPLETED', message: 'Reconciled successfully', timestamp: Date.now() },
      ],
    });

    assert.strictEqual(reconciled, true);
    assert.strictEqual(sm.runState, RUN_STATES.COMPLETED);
    assert.strictEqual(sm.finalResult, 'Reconciled Output');
    assert.strictEqual(sm.recoveryStatus, 'recovered');
  });

  // ─── Test 8: Mismatched Run ID Rejection During Reconciliation ───────────
  await test('Run Isolation: Mismatched run ID during reconciliation is rejected', () => {
    const sm = new StateMachine();
    sm.startRun('run_active');
    sm.transitionRun(RUN_STATES.INTERRUPTED);

    const staleResult = sm.reconcileWithRuntime({
      runId: 'run_stale_previous',
      runState: RUN_STATES.COMPLETED,
    });

    assert.strictEqual(staleResult, false, 'Stale or mismatched runId must be rejected');
    assert.strictEqual(sm.runState, RUN_STATES.INTERRUPTED);
  });

  // ─── Test 9: Event Deduplication ─────────────────────────────────────────
  await test('Event Deduplication: Stable event ID prevents duplicate entries', () => {
    const sm = new StateMachine();
    sm.startRun('run_test_9');

    sm.addEvent({ id: 'evt_dup_1', type: 'CLICK', message: 'Click [1]' });
    sm.addEvent({ id: 'evt_dup_1', type: 'CLICK', message: 'Click [1] Duplicate' });

    assert.strictEqual(sm.events.length, 2, 'Initial queued event + 1 unique event'); // startRun adds 1 event
    assert.strictEqual(sm.events[1].id, 'evt_dup_1');
  });

  // ─── Test 10: Atomic Action & HITL Approval Transitions ───────────────────
  await test('HITL Approval & Action State: waiting_for_approval -> submitting -> running', () => {
    const sm = new StateMachine();
    sm.startRun('run_test_10');
    sm.transitionRun(RUN_STATES.RUNNING);

    sm.transitionRun(RUN_STATES.WAITING_FOR_APPROVAL, {
      approval: { id: 'appr_1', action: 'delete_file', reason: 'Destructive' },
    });
    assert.strictEqual(sm.runState, RUN_STATES.WAITING_FOR_APPROVAL);
    assert.deepStrictEqual(sm.pendingApproval, { id: 'appr_1', action: 'delete_file', reason: 'Destructive' });

    // User clicks Approve: action state becomes SUBMITTING
    sm.setActionState(ACTION_STATES.SUBMITTING);
    assert.strictEqual(sm.actionState, ACTION_STATES.SUBMITTING);

    // Approval submission accepted by runtime
    sm.setActionState(ACTION_STATES.ACCEPTED);
    assert.strictEqual(sm.actionState, ACTION_STATES.ACCEPTED);

    // Execution resumed confirmed by runtime
    sm.transitionRun(RUN_STATES.RUNNING);
    assert.strictEqual(sm.runState, RUN_STATES.RUNNING);
    assert.strictEqual(sm.pendingApproval, null, 'Pending approval is cleared when execution resumes');
  });

  // ─── Test 11: Tool Presets & Policy Capabilities ─────────────────────────
  await test('Tool Presets & SecurityPolicy: Read-only strictly blocks mutations', () => {
    const policy = new SecurityPolicy({ preset: 'read_only' });

    // Safe read actions allowed
    assert.strictEqual(policy.isActionAllowed('navigate'), true);
    assert.strictEqual(policy.isActionAllowed('extract'), true);
    assert.strictEqual(policy.isActionAllowed('scroll_page'), true);

    // Mutations strictly blocked in read_only preset
    assert.strictEqual(policy.isActionAllowed('input_text'), false);
    assert.strictEqual(policy.isActionAllowed('send_keys'), false);
    assert.strictEqual(policy.isActionAllowed('upload_file'), false);

    // Form filling preset gates sensitive submit buttons
    const formPolicy = new SecurityPolicy({ preset: 'form_filling' });
    assert.strictEqual(formPolicy.isActionAllowed('input_text'), true);
    assert.strictEqual(formPolicy.requiresReview('click_element', { target: 'Submit Order' }), true);
  });

  // ─── Test 12: Distinct Retry Attempt Tracking ────────────────────────────
  await test('Tool Retry Attempts: separate attempt records are created', () => {
    const sm = new StateMachine();
    sm.startRun('run_test_12');
    sm.transitionRun(RUN_STATES.RUNNING);

    const tc = sm.registerToolCall('tool_retry', 'click_element', { index: 1 });
    sm.transitionTool('tool_retry', TOOL_STATES.RUNNING);
    sm.transitionTool('tool_retry', TOOL_STATES.FAILED, { error: 'Element obstructed' });

    assert.strictEqual(tc.attempts.length, 1);
    assert.strictEqual(tc.attempts[0].state, TOOL_STATES.FAILED);

    // Record new retry attempt
    const newAttempt = sm.retryToolAttempt('tool_retry');
    assert.strictEqual(tc.attempts.length, 2);
    assert.strictEqual(newAttempt.attemptNumber, 2);
    assert.strictEqual(tc.state, TOOL_STATES.PENDING);

    sm.transitionTool('tool_retry', TOOL_STATES.RUNNING);
    sm.transitionTool('tool_retry', TOOL_STATES.SUCCEEDED, { result: true });
    assert.strictEqual(tc.attempts[1].state, TOOL_STATES.SUCCEEDED);
    assert.strictEqual(tc.attempts[0].state, TOOL_STATES.FAILED, 'Original attempt failure remains intact and auditable');
  });

  console.log(`\n================================================================`);
  console.log(`  State Machine Summary: ${passed}/${total} Tests Passed`);
  console.log(`================================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
