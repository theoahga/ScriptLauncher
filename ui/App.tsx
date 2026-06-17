import { useState, useCallback } from "react";
import "./App.css";
import Sidebar from "./components/Sidebar";
import FolderSelector from "./components/FolderSelector";
import ScriptList from "./components/ScriptList";
import ScriptExecutor from "./components/ScriptExecutor";
import HistoryPanel from "./components/HistoryPanel";
import { ScriptInfo } from "./types";

export default function App(): JSX.Element {
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [selectedScript, setSelectedScript] = useState<ScriptInfo | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [activeTab, setActiveTab] = useState<"executor" | "history">(
    "executor",
  );

  // ADR-05 (S-07) : reset du script sélectionné quand le dossier change
  const handleFolderSelected = useCallback((path: string) => {
    setFolderPath(path);
    setSelectedScript(null);
  }, []);

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
        <FolderSelector onFolderSelected={handleFolderSelected} />
        <ScriptList
          folderPath={folderPath}
          onScriptSelected={handleScriptSelected}
        />
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
