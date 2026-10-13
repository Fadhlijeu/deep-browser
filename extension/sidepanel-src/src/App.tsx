import React, { useState, useEffect } from 'react';
import { sidepanelStore, SidepanelState } from './state/sidepanelStore';
import { Topbar } from './components/topbar/Topbar';
import { AssistantThread } from './components/thread/AssistantThread';
import { LogsView } from './components/logs/LogsView';
import { SessionDrawer } from './components/modals/SessionDrawer';
import { ApiKeysModal } from './components/modals/ApiKeysModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { ModelsModal } from './components/modals/ModelsModal';

export const App: React.FC = () => {
  const [state, setState] = useState<SidepanelState>(sidepanelStore.getState());

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
      {/* Topbar */}
      <Topbar
        runState={state.runState}
        connectionStatus={state.connectionStatus}
        isDetached={state.isDetached}
        stepCount={state.stepCount}
        currentView={state.currentView}
        logsCount={activeSession.events.length}
        onSetView={(v) => sidepanelStore.setView(v)}
        onOpenDrawer={() => sidepanelStore.setModal('drawer', true)}
        onNewSession={() => sidepanelStore.createNewSession()}
        onOpenApikeys={() => sidepanelStore.setModal('apikeys', true)}
        onOpenSettings={() => sidepanelStore.setModal('settings', true)}
        onReconnect={() => sidepanelStore.reconnect()}
        onToggleOnline={() => sidepanelStore.toggleOnline()}
        onToggleDetach={() => sidepanelStore.toggleDetach()}
        indexLabelingEnabled={state.indexLabelingEnabled}
        onToggleIndexLabeling={() => sidepanelStore.toggleIndexLabeling()}
      />

      {/* Main View Area */}
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

      {/* Drawers & Modals */}
      <SessionDrawer
        isOpen={state.modals.drawer}
        sessions={state.sessions}
        activeSessionId={state.activeSessionId}
        onClose={() => sidepanelStore.setModal('drawer', false)}
        onSwitchSession={(id) => sidepanelStore.switchSession(id)}
        onDeleteSession={(id) => sidepanelStore.deleteSession(id)}
        onCreateNewSession={() => sidepanelStore.createNewSession()}
        onClearActiveSession={() => sidepanelStore.clearActiveSession()}
      />

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
