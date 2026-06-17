import { useState, useCallback } from "react";
import "./App.css";
import Sidebar from "./components/Sidebar";
import FolderSelector from "./components/FolderSelector";
import ScriptList from "./components/ScriptList";
import ScriptExecutor from "./components/ScriptExecutor";
import { ScriptInfo } from "./types";

export default function App(): JSX.Element {
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [selectedScript, setSelectedScript] = useState<ScriptInfo | null>(null);

  // ADR-05 (S-07) : reset du script sélectionné quand le dossier change
  const handleFolderSelected = useCallback((path: string) => {
    setFolderPath(path);
    setSelectedScript(null);
  }, []);

  const handleScriptSelected = useCallback((script: ScriptInfo) => {
    setSelectedScript(script);
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
        <ScriptExecutor script={selectedScript} />
      </main>
    </div>
  );
}
