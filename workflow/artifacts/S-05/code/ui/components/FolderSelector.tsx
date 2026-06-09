import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";

interface FolderSelectorProps {
  onFolderSelected: (path: string) => void;
}

export default function FolderSelector({
  onFolderSelected,
}: FolderSelectorProps): JSX.Element {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const handleClick = async () => {
    try {
      const result = await open({ directory: true });
      if (result !== null) {
        setSelectedPath(result);
        onFolderSelected(result);
      }
    } catch (err) {
      console.error("Erreur lors de l'ouverture de la dialog :", err);
    }
  };

  return (
    <div className="folder-selector">
      <button className="folder-selector__button" onClick={handleClick}>
        Sélectionner un dossier
      </button>
      {selectedPath !== null && (
        <p className="folder-selector__path">{selectedPath}</p>
      )}
    </div>
  );
}
