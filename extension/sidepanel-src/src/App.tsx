import React, { useState, useEffect } from 'react';
import { sidepanelStore, SidepanelState } from './state/sidepanelStore';
import { SlimHeader } from './components/sidebar/SlimHeader';
import { Sidebar } from './components/sidebar/Sidebar';
import { AssistantThread } from './components/thread/AssistantThread';
import { LogsView } from './components/logs/LogsView';
import { ApiKeysModal } from './components/modals/ApiKeysModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { ModelsModal } from './components/modals/ModelsModal';

export const App: React.FC = () => {
  const [state, setState] = useState<SidepanelState>(sidepanelStore.getState());
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = sidepanelStore.subscribe(() => {
      setState({ ...sidepanelStore.getState() });
    });
    return unsubscribe;
  }, []);

  const activeSession = sidepanelStore.getActiveSession();
  const currentModel = state.models.find((m) => m.id === state.selectedModelId) || state.models[0];

  return (
    <div className="app-container">
      {/* Sleek B&W Slim Header with Hamburger Menu */}
      <SlimHeader
        onOpenSidebar={() => setSidebarOpen(true)}
        onNewSession={() => sidepanelStore.createNewSession()}
        connectionStatus={state.connectionStatus}
        runState={state.runState}
        modelName={currentModel.name}
      />

      {/* Main View Area: Chat or Logs */}
      <main className="main-content">
        {state.currentView === 'chat' ? (
          <AssistantThread
            session={activeSession}
            runState={state.runState}
            selectedModel={currentModel}
            selectedPreset={state.selectedPreset}
            selectedMode={state.selectedMode}
            onSendMessage={(txt) => sidepanelStore.sendMessage(txt)}
            onCancelRun={() => sidepanelStore.cancelRun()}
            onOpenModels={() => sidepanelStore.setModal('models', true)}
            onOpenSettings={() => sidepanelStore.setModal('settings', true)}
          />
        ) : (
          <LogsView
            events={activeSession.events}
            filter={state.logFilter}
            search={state.logSearch}
            onSetFilter={(f) => sidepanelStore.setLogFilter(f)}
            onSetSearch={(s) => sidepanelStore.setLogSearch(s)}
          />
        )}
      </main>

      {/* Top Layer Overlay Sidebar (Slides in on top of chat when opened) */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        runState={state.runState}
        connectionStatus={state.connectionStatus}
        isDetached={state.isDetached}
        stepCount={state.stepCount}
        currentView={state.currentView}
        logsCount={activeSession.events.length}
        sessions={state.sessions}
        activeSessionId={state.activeSessionId}
        onSetView={(v) => sidepanelStore.setView(v)}
        onNewSession={() => sidepanelStore.createNewSession()}
        onSwitchSession={(id) => sidepanelStore.switchSession(id)}
        onDeleteSession={(id) => sidepanelStore.deleteSession(id)}
        onClearActiveSession={() => sidepanelStore.clearActiveSession()}
        onOpenApikeys={() => sidepanelStore.setModal('apikeys', true)}
        onOpenSettings={() => sidepanelStore.setModal('settings', true)}
        onReconnect={() => sidepanelStore.reconnect()}
        onToggleOnline={() => sidepanelStore.toggleOnline()}
        onToggleDetach={() => sidepanelStore.toggleDetach()}
        indexLabelingEnabled={state.indexLabelingEnabled}
        onToggleIndexLabeling={() => sidepanelStore.toggleIndexLabeling()}
      />

      {/* Modals for Settings, API Keys, and Models */}
      <ApiKeysModal
        isOpen={state.modals.apikeys}
        apiKeys={state.apiKeys}
        onClose={() => sidepanelStore.setModal('apikeys', false)}
      />

      <SettingsModal
        isOpen={state.modals.settings}
        selectedMode={state.selectedMode}
        onClose={() => sidepanelStore.setModal('settings', false)}
      />

      <ModelsModal
        isOpen={state.modals.models}
        models={state.models}
        selectedModelId={state.selectedModelId}
        onClose={() => sidepanelStore.setModal('models', false)}
      />
    </div>
  );
};
