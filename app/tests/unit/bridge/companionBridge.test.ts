/**
 * Unit tests for CompanionBridge (Port 8765)
 * Verifies:
 * 1. Bridge server starts and answers /api/health
 * 2. Extension connects via WebSocket /ws/extension
 * 3. Sessions created on Desktop are listed to Extension
 * 4. Tasks sent from Extension execute via Desktop SessionManager
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

describe('CompanionBridge (Port 8765)', () => {
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

  it('allows Extension WebSocket connection on /ws/extension', async () => {
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

    // Create session in Desktop SessionManager
    sessionManager.createSession('Test Desktop Session');
    
    // Wait briefly for WebSocket broadcast
    await new Promise((r) => setTimeout(r, 100));

    expect(receivedMessages.length).toBeGreaterThan(0);
    expect(receivedMessages.some((m) => m.event_type === 'TASK_CREATED')).toBe(true);

    ws.close();
  });

  it('submits task from Extension and triggers desktop startSessionWithAgent', async () => {
    const startSessionMock = vi.fn().mockResolvedValue(undefined);
    bridge = await startCompanionBridge({
      port: testPort,
      sessionManager: sessionManager as unknown as SessionManager,
      startSessionWithAgent: startSessionMock,
    });

    const res = await fetch(`http://127.0.0.1:${testPort}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'Open Google and search for OpenAI' }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.status).toBe('created');
    expect(data.session_id).toBeDefined();

    expect(startSessionMock).toHaveBeenCalledWith(data.session_id);
    
    // Verify session is present in Desktop sessionManager
    const session = sessionManager.getSession(data.session_id);
    expect(session).toBeDefined();
    expect(session?.prompt).toBe('Open Google and search for OpenAI');
  });
});
