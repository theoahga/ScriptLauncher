import { useState, useCallback } from "react";
import "./App.css";
import Sidebar from "./components/Sidebar";
import CategoryManager from "./components/CategoryManager";
import ScriptExecutor from "./components/ScriptExecutor";
import HistoryPanel from "./components/HistoryPanel";
import { ScriptInfo } from "./types";

export default function App(): JSX.Element {
  const [selectedScript, setSelectedScript] = useState<ScriptInfo | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [activeTab, setActiveTab] = useState<"executor" | "history">(
    "executor",
  );

  // ADR-04 (S-09) : CategoryManager gère la config en interne.
  // App.tsx ne connaît que le script sélectionné.
  const handleScriptSelected = useCallback((script: ScriptInfo) => {
    setSelectedScript(script);
    setActiveTab("executor");
  }, []);

  // S-11 : incrémente historyVersion après chaque exécution pour recharger HistoryPanel
  const handleExecutionComplete = useCallback(() => {
    setHistoryVersion((v) => v + 1);
  }, []);

  return (
    <div className="app-shell">
      <Sidebar>
        <CategoryManager onScriptSelected={handleScriptSelected} />
      </Sidebar>
      <main className="main-panel">
        <div className="main-panel__tabs">
          <button
            type="button"
            className={`main-panel__tab${activeTab === "executor" ? " main-panel__tab--active" : ""}`}
            onClick={() => setActiveTab("executor")}
          >
            Exécution
          </button>
          <button
            type="button"
            className={`main-panel__tab${activeTab === "history" ? " main-panel__tab--active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            Historique
          </button>
        </div>

        {activeTab === "executor" ? (
          <ScriptExecutor
            script={selectedScript}
            onExecutionComplete={handleExecutionComplete}
          />
        ) : (
          <HistoryPanel historyVersion={historyVersion} />
        )}
      </main>
    </div>
  );
}
