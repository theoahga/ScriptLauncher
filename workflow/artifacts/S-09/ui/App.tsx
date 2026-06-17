import { useState, useCallback } from "react";
import "./App.css";
import Sidebar from "./components/Sidebar";
import CategoryManager from "./components/CategoryManager";
import ScriptExecutor from "./components/ScriptExecutor";
import { ScriptInfo } from "./types";

export default function App(): JSX.Element {
  const [selectedScript, setSelectedScript] = useState<ScriptInfo | null>(null);

  // ADR-04 (S-09) : CategoryManager gère la config en interne.
  // App.tsx ne connaît que le script sélectionné.
  const handleScriptSelected = useCallback((script: ScriptInfo) => {
    setSelectedScript(script);
  }, []);

  return (
    <div className="app-shell">
      <Sidebar>
        <CategoryManager onScriptSelected={handleScriptSelected} />
      </Sidebar>
      <main className="main-panel">
        <ScriptExecutor script={selectedScript} />
      </main>
    </div>
  );
}
