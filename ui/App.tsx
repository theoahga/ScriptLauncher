import { useCallback } from "react";
import "./App.css";
import FolderSelector from "./components/FolderSelector";

export default function App(): JSX.Element {
  const handleFolderSelected = useCallback((path: string) => {
    console.log("Dossier sélectionné :", path);
    // Sera étendu en S-06 pour passer le chemin à ScriptList
  }, []);

  return (
    <div className="app">
      <FolderSelector onFolderSelected={handleFolderSelected} />
    </div>
  );
}
