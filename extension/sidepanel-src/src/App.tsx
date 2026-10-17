import React, { useState, useEffect } from 'react';
import { sidepanelStore, SidepanelState } from './state/sidepanelStore';
import { Sidebar } from './components/sidebar/Sidebar';
import { CopilotTopbar } from './components/topbar/CopilotTopbar';
import { CopilotChatView } from './components/thread/CopilotChatView';
import { SessionsView } from './components/sessions/SessionsView';
import { ActivityView } from './components/activity/ActivityView';
import { ToolsView } from './components/tools/ToolsView';
import { SkillsView } from './components/skills/SkillsView';
import { SettingsView } from './components/settings/SettingsView';
import { CommandPalette } from './components/modals/CommandPalette';
import { ModelsModal } from './components/modals/ModelsModal';
import { ModeModal } from './components/modals/ModeModal';
import { ApiKeysModal } from './components/modals/ApiKeysModal';
import { SettingsModal } from './components/modals/SettingsModal';

export const App: React.FC = () => {
  const [state, setState] = useState<SidepanelState>(sidepanelStore.getState());
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = sidepanelStore.subscribe(() => {
      setState({ ...sidepanelStore.getState() });
    });
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', sidepanelStore.getState().theme || 'light');
    }
    return unsubscribe;
  }, []);

  const activeSession = sidepanelStore.getActiveSession();
  const currentModel = state.models.find((m) => m.id === state.selectedModelId) || state.models[0];
  const activeTab = state.tabs.find((t) => t.active) || state.tabs[0];

  const handleToggleTheme = () => {
    const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
    sidepanelStore.setTheme(nextTheme);
  };

  return (
    <div className="app" data-theme={state.theme}>
      {/* 1. Left Sidebar Navigation */}
      <Sidebar
        currentView={state.currentView}
        onSetView={(v) => sidepanelStore.setView(v)}
        sessions={state.sessions}
        activeTab={activeTab}
        runState={state.runState}
        stepCount={state.stepCount}
        onOpenSettings={() => sidepanelStore.setView('settings')}
      />

      {/* 2. Main Right Container */}
      <main className="main">
        {/* Topbar */}
        <CopilotTopbar
          currentView={state.currentView}
          connectionStatus={state.connectionStatus}
          runState={state.runState}
          stepCount={state.stepCount}
          theme={state.theme}
          isDetached={state.isDetached}
          isInspectorOpen={state.isInspectorOpen}
          onToggleInspector={() => sidepanelStore.toggleInspector()}
          onToggleTheme={handleToggleTheme}
          onToggleDetach={() => sidepanelStore.toggleDetach()}
          onOpenSearch={() => setIsCommandPaletteOpen(true)}
          onOpenSettings={() => sidepanelStore.setView('settings')}
        />

        {/* View Content Router */}
        <div className="content">
          {state.currentView === 'chat' && (
            <CopilotChatView
              session={activeSession}
              runState={state.runState}
              selectedModel={currentModel}
              selectedPreset={state.selectedPreset}
              selectedMode={state.selectedMode}
              isInspectorOpen={state.isInspectorOpen}
              onToggleInspector={() => sidepanelStore.toggleInspector()}
              onSendMessage={(txt) => sidepanelStore.sendMessage(txt)}
              onCancelRun={() => sidepanelStore.cancelRun()}
              onOpenModels={() => sidepanelStore.setModal('models', true)}
              onOpenSettings={() => sidepanelStore.setView('settings')}
            />
          )}

          {state.currentView === 'sessions' && (
            <SessionsView
              sessions={state.sessions}
              activeSessionId={state.activeSessionId}
              onSelectSession={(id) => {
                sidepanelStore.switchSession(id);
                sidepanelStore.setView('chat');
              }}
              onNewSession={() => {
                sidepanelStore.createNewSession();
                sidepanelStore.setView('chat');
              }}
              onDeleteSession={(id) => sidepanelStore.deleteSession(id)}
              onRenameSession={(id, name) => sidepanelStore.renameSession(id, name)}
              onTogglePin={(id) => sidepanelStore.togglePinSession(id)}
              onToggleArchive={(id) => sidepanelStore.toggleArchiveSession(id)}
            />
          )}

          {state.currentView === 'activity' && (
            <ActivityView
              session={activeSession}
              allSessions={state.sessions}
              onResolveHitl={(id, val) => sidepanelStore.resolveHitl(id, val)}
              onOpenSession={(id) => {
                sidepanelStore.switchSession(id);
                sidepanelStore.setView('chat');
              }}
            />
          )}

          {state.currentView === 'tools' && (
            <ToolsView
              onUsePrompt={(p) => {
                sidepanelStore.setView('chat');
                setTimeout(() => sidepanelStore.sendMessage(p), 100);
              }}
            />
          )}

          {(state.currentView === 'skills' || state.currentView === 'automations') && (
            <SkillsView
              onRunSkill={(p) => {
                sidepanelStore.setView('chat');
                setTimeout(() => sidepanelStore.sendMessage(p), 100);
              }}
            />
          )}

          {state.currentView === 'settings' && (
            <SettingsView
              models={state.models}
              selectedModelId={state.selectedModelId}
              selectedMode={state.selectedMode}
              apiKeys={state.apiKeys}
              theme={state.theme}
              indexLabelingEnabled={state.indexLabelingEnabled}
              isRecordingEnabled={state.isRecordingEnabled}
              isHudEnabled={state.isHudEnabled}
              judgeEnabled={state.judgeEnabled}
              onSetTheme={(t) => sidepanelStore.setTheme(t)}
              onSelectModel={(id) => sidepanelStore.setSelectedModel(id)}
              onSetMode={(m) => sidepanelStore.setMode(m)}
              onSaveApiKey={(prov, k) => sidepanelStore.setApiKey(prov, k)}
              onToggleIndexLabeling={() => sidepanelStore.toggleIndexLabeling()}
              onToggleRecording={() => sidepanelStore.toggleRecording()}
              onToggleHud={() => sidepanelStore.toggleDemoHud()}
              onToggleJudge={() => sidepanelStore.toggleJudge()}
            />
          )}
        </div>
      </main>

      {/* 3. Global Command Palette (Ctrl/Cmd K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSetView={(v) => sidepanelStore.setView(v)}
        onSelectModel={(id) => sidepanelStore.setSelectedModel(id)}
        onSelectSession={(id) => sidepanelStore.switchSession(id)}
        models={state.models}
        sessions={state.sessions}
      />

      {/* 4. Modals */}
      <ModelsModal
        isOpen={state.modals.models}
        models={state.models}
        selectedModelId={state.selectedModelId}
        judgeEnabled={state.judgeEnabled}
        judgeModelId={state.judgeModelId}
        onClose={() => sidepanelStore.setModal('models', false)}
      />

      <ModeModal
        isOpen={state.modals.mode}
        selectedMode={state.selectedMode}
        onSelectMode={(m) => {
          sidepanelStore.setMode(m);
          sidepanelStore.setModal('mode', false);
        }}
        onClose={() => sidepanelStore.setModal('mode', false)}
      />

      <ApiKeysModal
        isOpen={state.modals.apikeys}
        apiKeys={state.apiKeys}
        onClose={() => sidepanelStore.setModal('apikeys', false)}
      />

      <SettingsModal
        isOpen={state.modals.settings}
        selectedMode={state.selectedMode}
        models={state.models}
        selectedModelId={state.selectedModelId}
        apiKeys={state.apiKeys}
        sidepanelEnabled={state.sidepanelEnabled}
        indexLabelingEnabled={state.indexLabelingEnabled}
        judgeEnabled={state.judgeEnabled}
        judgeModelId={state.judgeModelId}
        isDetached={state.isDetached}
        onClose={() => sidepanelStore.setModal('settings', false)}
      />
    </div>
  );
};
