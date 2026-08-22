/**
 * Native Deep-Browser Companion Bridge Server (Port 8765)
 * Hosts the local HTTP + WebSocket endpoints connecting the Chrome Extension
 * directly to the authoritative Electron Desktop runtime (SessionManager).
 */

import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { mainLogger } from './logger';
import type { SessionManager } from './sessions/SessionManager';

export interface CompanionBridgeOptions {
  port?: number;
  sessionManager: SessionManager;
  startSessionWithAgent: (sessionId: string) => Promise<void>;
  getActiveSessionId?: () => string | null;
  setActiveSessionId?: (sessionId: string) => void;
}

export interface CompanionBridgeHandle {
  close(): Promise<void>;
  broadcast(event: Record<string, unknown>): void;
}

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
}

function sendJson(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  setCorsHeaders(res);
  const raw = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(raw),
  });
  res.end(raw);
}

function readBody(req: IncomingMessage, maxBytes = 256 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytes = 0;
    req.setEncoding('utf-8');
    req.on('data', (chunk: string) => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > maxBytes) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

export async function startCompanionBridge(opts: CompanionBridgeOptions): Promise<CompanionBridgeHandle> {
  const port = opts.port ?? 8765;
  const sessionManager = opts.sessionManager;
  const sockets = new Set<WebSocket>();

  const server = http.createServer(async (req, res) => {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url ?? '/', 'http://127.0.0.1:8765');
    const pathname = parsedUrl.pathname;

    try {
      // 1. Health check
      if ((pathname === '/api/health' || pathname === '/health') && req.method === 'GET') {
        const sessions = sessionManager.listSessions();
        sendJson(res, 200, {
          status: 'online',
          app: 'deep-browser',
          version: '0.1.0',
          active_sessions: sessions.length,
          active_session_id: opts.getActiveSessionId?.() ?? sessions[0]?.id ?? null,
        });
        return;
      }

      // 2. List sessions
      if (pathname === '/api/sessions' && req.method === 'GET') {
        const sessions = sessionManager.listSessions();
        const views = sessions.map((s) => ({
          id: s.id,
          name: s.prompt ? s.prompt.slice(0, 40) : 'Session',
          mode: 'managed',
          status: s.status,
          created_at: s.createdAt,
          target_url: s.lastUrl ?? null,
          title: s.primarySite ?? null,
        }));
        sendJson(res, 200, {
          sessions: views,
          active_session_id: opts.getActiveSessionId?.() ?? sessions[0]?.id ?? null,
        });
        return;
      }

      // 3. Create task (dispatch to Desktop SessionManager)
      if (pathname === '/api/tasks' && req.method === 'POST') {
        const raw = await readBody(req);
        const payload = JSON.parse(raw) as {
          task?: string;
          prompt?: string;
          engine?: string;
          browser_mode?: 'MANAGED' | 'ATTACHED';
          browser_id?: string;
          tab_id?: string | number;
        };
        const prompt = payload.task ?? payload.prompt ?? '';
        if (!prompt.trim()) {
          sendJson(res, 400, { error: 'Task prompt cannot be empty' });
          return;
        }

        const sessionId = sessionManager.createSession(prompt, {
          originChannel: 'chrome-extension',
          browserMode: payload.browser_mode ?? 'ATTACHED',
          browserId: payload.browser_id ?? 'chrome_9222',
          tabId: payload.tab_id,
        });
        opts.setActiveSessionId?.(sessionId);

        // Start execution asynchronously
        opts.startSessionWithAgent(sessionId).catch((err) => {
          mainLogger.error('companionBridge.startSession.error', { sessionId, error: (err as Error).message });
        });

        sendJson(res, 200, {
          status: 'created',
          task_id: sessionId,
          session_id: sessionId,
          browser_mode: payload.browser_mode ?? 'ATTACHED',
          browser_id: payload.browser_id ?? 'chrome_9222',
          tab_id: payload.tab_id ?? null,
          message: 'Task submitted to Deep-Browser runtime',
        });
        return;
      }

      // 4. Attach Chrome / Create Managed Session
      if (pathname === '/api/sessions/attach' && req.method === 'POST') {
        const sessionId = sessionManager.createSession('Attached Chrome Session', {
          originChannel: 'chrome-extension',
          browserMode: 'ATTACHED',
          browserId: 'chrome_9222',
        });
        opts.setActiveSessionId?.(sessionId);
        sendJson(res, 200, {
          id: sessionId,
          name: 'Current Chrome',
          mode: 'ATTACHED',
          browser_mode: 'ATTACHED',
          browser_id: 'chrome_9222',
          status: 'idle',
        });
        return;
      }

      if (pathname === '/api/sessions/managed' && req.method === 'POST') {
        const sessionId = sessionManager.createSession('New Browser Session', {
          originChannel: 'chrome-extension',
          browserMode: 'MANAGED',
          browserId: 'bundled_chromium',
        });
        opts.setActiveSessionId?.(sessionId);
        sendJson(res, 200, {
          id: sessionId,
          name: 'Managed Session',
          mode: 'MANAGED',
          browser_mode: 'MANAGED',
          browser_id: 'bundled_chromium',
          status: 'idle',
        });
        return;
      }

      // 5. Switch Session
      const switchMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/switch$/);
      if (switchMatch && req.method === 'POST') {
        const targetId = switchMatch[1];
        opts.setActiveSessionId?.(targetId);
        sendJson(res, 200, { status: 'success', active_session_id: targetId });
        return;
      }

      // 6. Browser State
      if (pathname === '/api/browser/state' && req.method === 'GET') {
        const activeId = opts.getActiveSessionId?.() ?? sessionManager.listSessions()[0]?.id;
        const session = activeId ? sessionManager.getSession(activeId) : undefined;
        sendJson(res, 200, {
          session_id: activeId ?? null,
          url: session?.lastUrl ?? null,
          title: session?.primarySite ?? 'Deep-Browser Workspace',
          browser_mode: session?.browserMode ?? 'ATTACHED',
          browser_id: session?.browserId ?? 'chrome_9222',
          tab_id: session?.tabId ?? null,
          is_attached: session?.browserMode === 'ATTACHED',
        });
        return;
      }

      // 7. Agent Controls: Pause, Resume, Stop
      if (pathname === '/api/agent/pause' && req.method === 'POST') {
        const activeId = opts.getActiveSessionId?.() ?? sessionManager.listSessions()[0]?.id;
        if (activeId) sessionManager.pauseSession(activeId);
        sendJson(res, 200, { status: 'paused', session_id: activeId });
        return;
      }

      if (pathname === '/api/agent/resume' && req.method === 'POST') {
        const activeId = opts.getActiveSessionId?.() ?? sessionManager.listSessions()[0]?.id;
        if (activeId) sessionManager.resumePausedSession(activeId);
        sendJson(res, 200, { status: 'resumed', session_id: activeId });
        return;
      }

      if (pathname === '/api/agent/stop' && req.method === 'POST') {
        const activeId = opts.getActiveSessionId?.() ?? sessionManager.listSessions()[0]?.id;
        if (activeId) sessionManager.cancelSession(activeId);
        sendJson(res, 200, { status: 'stopped', session_id: activeId });
        return;
      }

      // 8. Safe Mode Confirmations
      const confMatch = pathname.match(/^\/api\/confirmations\/([^/]+)$/);
      if (confMatch && req.method === 'POST') {
        const confId = confMatch[1];
        sendJson(res, 200, { status: 'confirmed', confirmation_id: confId });
        return;
      }

      sendJson(res, 404, { error: 'Endpoint not found', path: pathname });
    } catch (err) {
      mainLogger.error('companionBridge.request.error', { path: pathname, error: (err as Error).message });
      sendJson(res, 500, { error: (err as Error).message });
    }
  });

  // WebSocket Server on /ws/extension
  const wss = new WebSocketServer({ server, path: '/ws/extension' });

  function broadcast(event: Record<string, unknown>): void {
    const raw = JSON.stringify(event);
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(raw);
        } catch {
          // ignore closed socket
        }
      }
    }
  }

  wss.on('connection', (ws) => {
    sockets.add(ws);
    mainLogger.info('companionBridge.ws.connected', { totalClients: sockets.size });

    // Send initial status event
    const activeId = opts.getActiveSessionId?.() ?? sessionManager.listSessions()[0]?.id ?? 'default';
    const activeSession = sessionManager.getSession(activeId);
    ws.send(
      JSON.stringify({
        event_id: `evt_${Date.now()}`,
        task_id: activeId,
        session_id: activeId,
        browser_mode: activeSession?.browserMode ?? 'ATTACHED',
        browser_id: activeSession?.browserId ?? 'chrome_9222',
        tab_id: activeSession?.tabId ?? null,
        event_type: 'SESSION_ATTACHED',
        timestamp: Date.now() / 1000,
        message: 'Connected to Deep-Browser Runtime',
        data: { status: 'online' },
      }),
    );

    ws.on('close', () => {
      sockets.delete(ws);
      mainLogger.info('companionBridge.ws.disconnected', { totalClients: sockets.size });
    });

    ws.on('error', (err) => {
      mainLogger.warn('companionBridge.ws.error', { error: err.message });
    });
  });

  // Wire SessionManager events to live WebSocket broadcast
  sessionManager.on('session-created', (session) => {
    broadcast({
      event_id: `evt_${Date.now()}`,
      task_id: session.id,
      session_id: session.id,
      browser_mode: session.browserMode ?? 'MANAGED',
      browser_id: session.browserId ?? 'bundled_chromium',
      tab_id: session.tabId ?? null,
      event_type: 'TASK_CREATED',
      timestamp: Date.now() / 1000,
      message: `Task created: ${session.prompt?.slice(0, 80) ?? 'Session'}`,
      data: { session },
    });
  });

  sessionManager.on('session-updated', (session) => {
    let evtType = 'SESSION_SWITCHED';
    if (session.status === 'running') evtType = 'TASK_STARTED';
    else if (session.status === 'paused') evtType = 'PAUSED';
    else if (session.status === 'stopped') evtType = 'COMPLETED';

    broadcast({
      event_id: `evt_${Date.now()}`,
      task_id: session.id,
      session_id: session.id,
      browser_mode: session.browserMode ?? 'MANAGED',
      browser_id: session.browserId ?? 'bundled_chromium',
      tab_id: session.tabId ?? null,
      event_type: evtType,
      timestamp: Date.now() / 1000,
      message: `Session ${session.id.slice(0, 8)} status: ${session.status}`,
      data: { status: session.status, error: session.error },
    });
  });

  sessionManager.on('session-output', (sessionId, event) => {
    const session = sessionManager.getSession(sessionId);
    let evtType = 'OBSERVATION';
    if (event.type === 'tool_call') evtType = 'ACTION_REQUESTED';
    else if (event.type === 'tool_result') evtType = 'ACTION_EXECUTED';
    else if (event.type === 'done') evtType = 'COMPLETED';

    broadcast({
      event_id: `evt_${Date.now()}`,
      task_id: sessionId,
      session_id: sessionId,
      browser_mode: session?.browserMode ?? 'MANAGED',
      browser_id: session?.browserId ?? 'bundled_chromium',
      tab_id: session?.tabId ?? null,
      event_type: evtType,
      timestamp: Date.now() / 1000,
      message: event.type === 'thinking' ? event.text : `${event.type}`,
      data: event,
    });
  });

  sessionManager.on('session-error', (session) => {
    broadcast({
      event_id: `evt_${Date.now()}`,
      task_id: session.id,
      session_id: session.id,
      browser_mode: session.browserMode ?? 'MANAGED',
      browser_id: session.browserId ?? 'bundled_chromium',
      tab_id: session.tabId ?? null,
      event_type: 'FAILED',
      timestamp: Date.now() / 1000,
      message: session.error ?? 'Session failed',
      data: { error: session.error },
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => {
      mainLogger.info('companionBridge.started', { port, host: '127.0.0.1' });
      resolve();
    });
    server.on('error', (err) => {
      mainLogger.error('companionBridge.listenFailed', { port, error: (err as Error).message });
      reject(err);
    });
  });

  return {
    broadcast,
    close: async () => {
      for (const ws of sockets) {
        try { ws.close(); } catch { /* ignore */ }
      }
      sockets.clear();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      mainLogger.info('companionBridge.closed');
    },
  };
}
