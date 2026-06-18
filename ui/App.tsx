import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import Sidebar from "./components/Sidebar";
import CategoryManager from "./components/CategoryManager";
import ScriptExecutor from "./components/ScriptExecutor";
import HistoryPanel from "./components/HistoryPanel";
import { ScriptInfo, ExecutionTab } from "./types";

export default function App(): JSX.Element {
  const [tabs, setTabs] = useState<ExecutionTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);

  const handleScriptSelected = useCallback((script: ScriptInfo) => {
    setTabs((prev) => {
      const existing = prev.find((t) => t.script.path === script.path);
      if (existing) {
        setActiveTabId(existing.id);
        setShowHistory(false);
        return prev;
      }
      const id = crypto.randomUUID();
      setActiveTabId(id);
      setShowHistory(false);
      return [...prev, { id, script }];
    });
  }, []);

  const handleScriptNewInstance = useCallback((script: ScriptInfo) => {
    const id = crypto.randomUUID();
    setTabs((prev) => [...prev, { id, script }]);
    setActiveTabId(id);
    setShowHistory(false);
  }, []);

  const handleCloseTab = useCallback(async (tabId: string) => {
    await invoke<void>("kill_script", { executionId: tabId }).catch(() => {});
    setTabs((prev) => {
      const remaining = prev.filter((t) => t.id !== tabId);
      setActiveTabId((current) => {
        if (current !== tabId) return current;
        if (remaining.length === 0) return null;
        const idx = prev.findIndex((t) => t.id === tabId);
        return remaining[Math.min(idx, remaining.length - 1)].id;
      });
      return remaining;
    });
  }, []);

  const handleCloseAllTabs = useCallback(async (currentTabs: ExecutionTab[]) => {
    await Promise.all(
      currentTabs.map((t) =>
        invoke<void>("kill_script", { executionId: t.id }).catch(() => {}),
      ),
    );
    setTabs([]);
    setActiveTabId(null);
  }, []);

  const handleExecutionComplete = useCallback(() => {
    setHistoryVersion((v) => v + 1);
  }, []);

  return (
    <div className="app-shell">
      <Sidebar>
        <CategoryManager
          onScriptSelected={handleScriptSelected}
          onScriptNewInstance={handleScriptNewInstance}
        />
      </Sidebar>
      <main className="main-panel">
        <div className="main-panel__tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`main-panel__tab${activeTabId === tab.id && !showHistory ? " main-panel__tab--active" : ""}`}
              onClick={() => { setActiveTabId(tab.id); setShowHistory(false); }}
            >
              <span className="main-panel__tab-label">{tab.script.name}</span>
              <span
                className="main-panel__tab-close"
                role="button"
                aria-label={`Close ${tab.script.name}`}
                onClick={(e) => { e.stopPropagation(); handleCloseTab(tab.id); }}
              >
                ×
              </span>
            </button>
          ))}
          {tabs.length > 0 && (
            <button
              type="button"
              className="main-panel__tab main-panel__tab--close-all"
              onClick={() => handleCloseAllTabs(tabs)}
              title="Close all tabs"
            >
              Close all
            </button>
          )}
          <button
            type="button"
            className={`main-panel__tab main-panel__tab--history${showHistory ? " main-panel__tab--active" : ""}`}
            onClick={() => setShowHistory(true)}
          >
            History
          </button>
        </div>

        {showHistory ? (
          <HistoryPanel historyVersion={historyVersion} />
        ) : tabs.length === 0 ? (
          <p className="main-panel__empty">Select a script from the sidebar</p>
        ) : (
          tabs.map((tab) => (
            <div
              key={tab.id}
              className={tab.id === activeTabId ? "tab-content tab-content--visible" : "tab-content"}
            >
              <ScriptExecutor
                executionId={tab.id}
                script={tab.script}
                onExecutionComplete={handleExecutionComplete}
              />
            </div>
          ))
        )}
      </main>
    </div>
  );
}
