import path from 'node:path';
import { app } from 'electron';
import { register } from '../registry';
import { applyBrowserHarnessEnv } from '../browserHarnessEnv';
import { buildSkillIndexPrompt, SKILL_DISCOVERY_AND_LIFECYCLE_LINES, htmlBlockGuidanceLines, optionsBlockGuidanceLines, askBlockGuidanceLines } from '../skillIndexPrompt';
import { resolveThemeMode } from '../../../themeMode';
import { enrichedEnv } from '../pathEnrich';
import { loadGeminiApiKey, loadGeminiModel } from '../../../identity/authStore';
import type {
  EngineAdapter,
  InstallProbe,
  AuthProbe,
  SpawnContext,
  ParseContext,
  ParseResult,
} from '../types';
import type { HlEvent } from '../../../../shared/session-schemas';

const ID = 'gemini';
const DISPLAY = 'Google Gemini';
const BIN = 'python';

const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

const geminiAdapter: EngineAdapter = {
  id: ID,
  displayName: DISPLAY,
  binaryName: BIN,

  async probeInstalled(): Promise<InstallProbe> {
    return { installed: true, version: 'Gemini 3.5' };
  },

  async probeAuthed(): Promise<AuthProbe> {
    const key = await loadGeminiApiKey();
    if (key) return { authed: true };
    return { authed: false, error: 'Configure GOOGLE_API_KEY in .env file or Settings.' };
  },

  async openLoginInTerminal(): Promise<{ opened: boolean; error?: string }> {
    return { opened: false, error: 'Add your GOOGLE_API_KEY in .env file or Settings.' };
  },

  buildSpawnArgs(ctx: SpawnContext): string[] {
    const model = ctx.model || DEFAULT_GEMINI_MODEL;
    const browserType = ctx.browserType || (ctx.browserMode === 'ATTACHED' ? 'edge' : 'bundled');
    const args = [
      '-u',
      '-m', 'deep_browser.cli', 'run',
      '--provider', 'gemini',
      '--browser', browserType,
      '--ndjson',
    ];
    if (ctx.targetId && ctx.targetId !== 'default') {
      args.push('--target-id', ctx.targetId);
    }
    if (model) args.push('--model', model);
    if (ctx.sessionId) args.push('--session', ctx.sessionId);
    return args;
  },

  getStdinPayload(_ctx: SpawnContext, wrappedPrompt: string): string {
    return wrappedPrompt;
  },

  buildEnv(ctx: SpawnContext, baseEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const env = enrichedEnv(baseEnv);
    const appPath = typeof app?.getAppPath === 'function' ? app.getAppPath() : process.cwd();
    const repoRoot = path.resolve(appPath, '..');
    const existingPythonPath = env.PYTHONPATH ? `${env.PYTHONPATH}${path.delimiter}` : '';
    env.PYTHONPATH = `${existingPythonPath}${repoRoot}${path.delimiter}${appPath}`;

    env.DEEP_BROWSER_TARGET_ID = ctx.targetId;
    env.DEEP_BROWSER_CDP_PORT = String(ctx.cdpPort);
    env.BU_TARGET_ID = ctx.targetId;
    env.BU_CDP_PORT = String(ctx.cdpPort);
    env.DEEP_BROWSER_LLM_PROVIDER = 'gemini';
    env.GEMINI_MODEL = ctx.model || DEFAULT_GEMINI_MODEL;

    if (ctx.savedApiKey) {
      env.GOOGLE_API_KEY = ctx.savedApiKey;
      env.GEMINI_API_KEY = ctx.savedApiKey;
    }

    return applyBrowserHarnessEnv(ctx, env);
  },

  wrapPrompt(ctx: SpawnContext): string {
    const attachmentLines = ctx.attachmentRefs.length
      ? [
          '',
          'Attachments are available relative to the working directory:',
          ...ctx.attachmentRefs.map((a) => `- ./${a.relPath} (${a.mime}, ${a.size} bytes)`),
        ]
      : [];
    const skillIndex = buildSkillIndexPrompt(ctx.harnessDir);
    const skillIndexLines = skillIndex ? ['', skillIndex] : [];
    return [
      'You are Deep-Browser autonomous agent powered by Google Gemini.',
      'You are driving a specific Chromium browser view on this machine.',
      `Your target is CDP target_id=${ctx.targetId} on port ${ctx.cdpPort} (env BU_TARGET_ID / BU_CDP_PORT).`,
      'Use Browser Harness JS from this working directory for browser actions.',
      ...SKILL_DISCOVERY_AND_LIFECYCLE_LINES,
      ...htmlBlockGuidanceLines(resolveThemeMode()),
      ...optionsBlockGuidanceLines(),
      ...askBlockGuidanceLines(),
      "Use the `browser-harness-js` CLI for browser actions. Start with `browser-harness-js 'await connectToAssignedTarget()'`.",
      'When producing files, save them to `./outputs/' + ctx.sessionId + '/` and mention the filename in the final answer.',
      ...skillIndexLines,
      ...attachmentLines,
      '',
      'User task:',
      ctx.prompt,
    ].join('\n');
  },

  parseLine(line: string, ctx: ParseContext): ParseResult {
    const events: HlEvent[] = [];
    let capturedSessionId: string | undefined;
    let terminalError: string | undefined;

    try {
      const e = JSON.parse(line) as Record<string, unknown>;
      const type = typeof e.type === 'string' ? e.type : '';

      if (type === 'thinking' || type === 'thought') {
        const text = typeof e.text === 'string' ? e.text : typeof e.content === 'string' ? e.content : '';
        if (text) events.push({ type: 'thinking', text });
      } else if (type === 'tool_call') {
        const name = typeof e.name === 'string' ? e.name : 'action';
        const args = (e.args && typeof e.args === 'object' ? e.args : {}) as Record<string, unknown>;
        events.push({
          type: 'tool_call',
          name,
          args,
          iteration: ctx.iter,
        });
      } else if (type === 'tool_result') {
        const name = typeof e.name === 'string' ? e.name : 'action';
        const preview = typeof e.output === 'string' ? e.output : JSON.stringify(e.output ?? '');
        events.push({
          type: 'tool_result',
          name,
          ok: !Boolean(e.is_error),
          preview,
          ms: typeof e.ms === 'number' ? e.ms : 100,
        });
      } else if (type === 'done' || type === 'complete') {
        const summary = typeof e.summary === 'string' ? e.summary : typeof e.result === 'string' ? e.result : 'Task completed successfully.';
        events.push({ type: 'done', summary, iterations: ctx.iter });
        return { events, terminalDone: true };
      } else if (type === 'error') {
        terminalError = typeof e.message === 'string' ? e.message : 'Gemini execution error';
        events.push({ type: 'error', message: terminalError });
        return { events, terminalError };
      } else if (typeof e.message === 'string') {
        events.push({ type: 'thinking', text: e.message });
      }
    } catch {
      // Raw string output fallback
      if (line.trim()) {
        events.push({ type: 'thinking', text: line });
      }
    }

    return { events, capturedSessionId, terminalError };
  },
};

register(geminiAdapter);

export default geminiAdapter;
