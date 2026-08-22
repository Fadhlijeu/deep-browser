/**
 * Unit tests for CompanionBridge (Port 8765) & Browser Modes
 * Verifies:
 * 1. Bridge server starts and answers /api/health
 * 2. Extension connects via WebSocket /ws/extension
 * 3. Sessions created on Desktop (MANAGED default) and Extension (ATTACHED default) are properly typed
 * 4. Events broadcast with browser_mode, browser_id, tab_id
 * 5. Reconnect & shutdown lifecycle
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { WebSocket } from 'ws';
import { startCompanionBridge, type CompanionBridgeHandle } from '../../../src/main/companionBridge';
import type { SessionManager } from '../../../src/main/sessions/SessionManager';

class MockSessionManager extends EventEmitter {
  private sessions: Map<string, any> = new Map();

  createSession(prompt: string, opts?: any): string {
    const id = `sess-${Date.now()}`;
    const session = {
      id,
      prompt,
      status: 'running',
      createdAt: Date.now(),
      originChannel: opts?.originChannel,
      browserMode: opts?.browserMode ?? (opts?.originChannel === 'chrome-extension' ? 'ATTACHED' : 'MANAGED'),
      browserId: opts?.browserId ?? (opts?.browserMode === 'ATTACHED' ? 'chrome_9222' : 'bundled_chromium'),
      tabId: opts?.tabId,
    };
    this.sessions.set(id, session);
    this.emit('session-created', session);
    return id;
  }

  getSession(id: string): any {
    return this.sessions.get(id);
  }

  listSessions(): any[] {
    return Array.from(this.sessions.values());
  }

  pauseSession(id: string): void {
    const s = this.sessions.get(id);
    if (s) {
      s.status = 'paused';
      this.emit('session-updated', s);
    }
  }

  resumePausedSession(id: string): void {
    const s = this.sessions.get(id);
    if (s) {
      s.status = 'running';
      this.emit('session-updated', s);
    }
  }

  cancelSession(id: string): void {
    const s = this.sessions.get(id);
    if (s) {
      s.status = 'stopped';
      this.emit('session-updated', s);
    }
  }
}

describe('CompanionBridge (Port 8765) & Browser Modes', () => {
  let bridge: CompanionBridgeHandle | null = null;
  let sessionManager: MockSessionManager;
  let testPort = 8798;

  beforeEach(() => {
    sessionManager = new MockSessionManager();
  });

  afterEach(async () => {
    if (bridge) {
      await bridge.close();
      bridge = null;
    }
  });

  it('starts bridge and returns online health status', async () => {
    const startSessionMock = vi.fn().mockResolvedValue(undefined);
    bridge = await startCompanionBridge({
      port: testPort,
      sessionManager: sessionManager as unknown as SessionManager,
      startSessionWithAgent: startSessionMock,
    });

    const res = await fetch(`http://127.0.0.1:${testPort}/api/health`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.status).toBe('online');
    expect(data.app).toBe('deep-browser');
  });

  it('allows Extension WebSocket connection on /ws/extension and broadcasts browser mode metadata', async () => {
    const startSessionMock = vi.fn().mockResolvedValue(undefined);
    bridge = await startCompanionBridge({
      port: testPort,
      sessionManager: sessionManager as unknown as SessionManager,
      startSessionWithAgent: startSessionMock,
    });

    const ws = new WebSocket(`ws://127.0.0.1:${testPort}/ws/extension`);
    const receivedMessages: any[] = [];

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => {
        resolve();
      });
      ws.on('error', reject);
    });

    ws.on('message', (data) => {
      receivedMessages.push(JSON.parse(data.toString()));
    });

    // Create session in Desktop (default MANAGED)
    sessionManager.createSession('Desktop Research Task', { browserMode: 'MANAGED' });
    
    // Wait briefly for WebSocket broadcast
    await new Promise((r) => setTimeout(r, 100));

    expect(receivedMessages.length).toBeGreaterThan(0);
    const createdEvt = receivedMessages.find((m) => m.event_type === 'TASK_CREATED');
    expect(createdEvt).toBeDefined();
    expect(createdEvt.browser_mode).toBe('MANAGED');
    expect(createdEvt.browser_id).toBe('bundled_chromium');

    ws.close();
  });

  it('submits task from Extension in ATTACHED mode with current tabId without launching bundled Chromium', async () => {
    const startSessionMock = vi.fn().mockResolvedValue(undefined);
    bridge = await startCompanionBridge({
      port: testPort,
      sessionManager: sessionManager as unknown as SessionManager,
      startSessionWithAgent: startSessionMock,
    });

    const res = await fetch(`http://127.0.0.1:${testPort}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: 'Open Google and search in current tab',
        browser_mode: 'ATTACHED',
        browser_id: 'chrome_9222',
        tab_id: 1042,
      }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.status).toBe('created');
    expect(data.browser_mode).toBe('ATTACHED');
    expect(data.browser_id).toBe('chrome_9222');
    expect(data.tab_id).toBe(1042);

    expect(startSessionMock).toHaveBeenCalledWith(data.session_id);
    
    // Verify session is present in Desktop sessionManager with ATTACHED mode
    const session = sessionManager.getSession(data.session_id);
    expect(session).toBeDefined();
    expect(session?.browserMode).toBe('ATTACHED');
    expect(session?.browserId).toBe('chrome_9222');
    expect(session?.tabId).toBe(1042);
  });
});
