import { useState, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";

interface FolderSelectorProps {
  onFolderSelected: (path: string) => void;
}

export default function FolderSelector({
  onFolderSelected,
}: FolderSelectorProps): JSX.Element {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const handleClick = useCallback(async () => {
    try {
      const result = await open({ directory: true });
      if (result !== null) {
        setSelectedPath(result);
        onFolderSelected(result);
      }
    } catch (err) {
      console.error("Failed to open dialog:", err);
    }
  }, [onFolderSelected]);

  return (
    <div className="folder-selector">
      <button
        type="button"
        className="folder-selector__button"
        onClick={handleClick}
      >
        Select a folder
      </button>
      {selectedPath !== null && (
        <p className="folder-selector__path">{selectedPath}</p>
      )}
    </div>
  );
}
