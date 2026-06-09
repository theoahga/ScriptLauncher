import { useState, useCallback } from "react";
import "./App.css";
import FolderSelector from "./components/FolderSelector";
import ScriptList from "./components/ScriptList";
import { ScriptInfo } from "./types";

export default function App(): JSX.Element {
  const [folderPath, setFolderPath] = useState<string | null>(null);

  const handleFolderSelected = useCallback((path: string) => {
    setFolderPath(path);
  }, []);

  const handleScriptSelected = useCallback((script: ScriptInfo) => {
    console.log("Script sélectionné :", script);
    // Sera étendu en S-07 pour exécuter le script
  }, []);

  return (
    <div className="app">
      <FolderSelector onFolderSelected={handleFolderSelected} />
      <ScriptList
        folderPath={folderPath}
        onScriptSelected={handleScriptSelected}
      />
    </div>
  );
}
