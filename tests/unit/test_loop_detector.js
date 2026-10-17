/**
 * Unit Tests: ActionLoopDetector & UrlShortener
 * ============================================
 */

const assert = require('assert');
require('../../extension/core/loop_detector.js');

async function runTests() {
  console.log('--- Testing ActionLoopDetector & UrlShortener ---');
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

  // 1. PageFingerprint tests
  test('PageFingerprint creates identical hashes for identical states', () => {
    const fp1 = global.PageFingerprint.fromBrowserState('https://example.com', '[1]<button>OK</button>', 5);
    const fp2 = global.PageFingerprint.fromBrowserState('https://example.com', '[1]<button>OK</button>', 5);
    const fp3 = global.PageFingerprint.fromBrowserState('https://example.com', '[1]<button>Cancel</button>', 5);

    assert.strictEqual(fp1.equals(fp2), true);
    assert.strictEqual(fp1.equals(fp3), false);
  });

  // 2. ActionLoopDetector action hashing & repetition
  test('ActionLoopDetector normalizes actions and tracks repetition count', () => {
    const detector = new global.ActionLoopDetector({ windowSize: 10 });

    // Execute click on same element 4 times
    detector.recordAction('click_element', { index: 5 });
    detector.recordAction('click_element', { index: 5 });
    detector.recordAction('click_element', { index: 5 });
    assert.strictEqual(detector.maxRepetitionCount, 3);
    assert.strictEqual(detector.getNudgeMessage(), null); // threshold is 4

    detector.recordAction('click_element', { index: 5 });
    assert.strictEqual(detector.maxRepetitionCount, 4);
    const nudge = detector.getNudgeMessage();
    assert.ok(nudge && nudge.includes('ACTION REPETITION NOTICE'));
  });

  // 3. ActionLoopDetector escalating nudges
  test('ActionLoopDetector escalates to critical warning at high repetition', () => {
    const detector = new global.ActionLoopDetector({ windowSize: 20 });
    for (let i = 0; i < 10; i++) {
      detector.recordAction('search_page', { query: 'test query' });
    }
    const nudge = detector.getNudgeMessage();
    assert.ok(nudge && nudge.includes('CRITICAL REPETITION LOOP DETECTED'));
  });

  // 4. ActionLoopDetector exempts wait and done
  test('ActionLoopDetector exempts wait and done from loop tracking', () => {
    const detector = new global.ActionLoopDetector({ windowSize: 20 });
    for (let i = 0; i < 15; i++) {
      detector.recordAction('wait', { seconds: 2 });
    }
    assert.strictEqual(detector.maxRepetitionCount, 0);
    assert.strictEqual(detector.getNudgeMessage(), null);
  });

  // 5. Page Stagnation detection
  test('ActionLoopDetector detects page stagnation across consecutive steps', () => {
    const detector = new global.ActionLoopDetector();
    for (let i = 0; i < 5; i++) {
      detector.recordPageState('https://example.com', 'Static Page Content', 10);
    }
    assert.strictEqual(detector.consecutiveStagnantPages, 4);
    const nudge = detector.getNudgeMessage();
    assert.ok(nudge && nudge.includes('PAGE STAGNATION DETECTED'));
  });

  // 6. UrlShortener shortening and recovery
  test('UrlShortener shortens bloated URLs and restores them in parameters', () => {
    const shortener = new global.UrlShortener({ urlLimit: 30 });
    const longUrl = 'https://shop.example.com/item/101?utm_source=google&utm_medium=cpc&utm_campaign=winter_sale_2026&gclid=123456789ABCDEF';
    
    const shortened = shortener.shortenUrl(longUrl);
    assert.ok(shortened.length < longUrl.length);
    assert.ok(shortened.includes('...'));

    // Test text shortening
    const promptText = `Please check this link: ${longUrl} for details.`;
    const { shortenedText, count } = shortener.shortenText(promptText);
    assert.strictEqual(count, 1);
    assert.ok(!shortenedText.includes('winter_sale_2026'));
    assert.ok(shortenedText.includes('...'));

    // Test parameter restoration
    const params = {
      action: 'navigate',
      target_url: shortened,
      nested: {
        links: [shortened, 'https://regular.com/short']
      }
    };

    const restored = shortener.restoreParams(params);
    assert.strictEqual(restored.target_url, longUrl);
    assert.strictEqual(restored.nested.links[0], longUrl);
    assert.strictEqual(restored.nested.links[1], 'https://regular.com/short');
  });

  console.log(`\nResults: ${passed}/${total} loop detector tests passed.`);
  if (passed !== total) process.exit(1);
}

runTests();
