import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ScriptInfo } from "../types";
import "./ScriptList.css";

interface ScriptListProps {
  folderPath: string | null;
  onScriptSelected: (script: ScriptInfo) => void;
  onScriptNewInstance?: (script: ScriptInfo) => void;
}

export default function ScriptList({
  folderPath,
  onScriptSelected,
  onScriptNewInstance,
}: ScriptListProps): JSX.Element {
  const [scripts, setScripts] = useState<ScriptInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (folderPath === null) {
      setScripts([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const loadScripts = async () => {
      setLoading(true);
      setError(null);
      setScripts([]);

      try {
        const result = await invoke<ScriptInfo[]>("list_scripts", {
          folder: folderPath,
        });
        if (!cancelled) {
          setScripts(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadScripts();

    return () => {
      cancelled = true;
    };
  }, [folderPath]);

  if (folderPath === null) {
    return (
      <div className="script-list">
        <p className="script-list__empty">Aucun dossier sélectionné</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="script-list">
        <p className="script-list__loading">Chargement...</p>
      </div>
    );
  }

  if (error !== null) {
    return (
      <div className="script-list">
        <p className="script-list__error">{error}</p>
      </div>
    );
  }

  if (scripts.length === 0) {
    return (
      <div className="script-list">
        <p className="script-list__empty">Aucun script trouvé dans ce dossier</p>
      </div>
    );
  }

  return (
    <div className="script-list">
      <ul className="script-list__items">
        {scripts.map((script) => (
          <li
            key={script.path}
            className="script-list__item"
            onClick={() => onScriptSelected(script)}
            onContextMenu={(e) => {
              e.preventDefault();
              onScriptNewInstance?.(script);
            }}
          >
            <span className="script-list__item-name">{script.name}</span>
            {script.extension !== "" && (
              <span className="script-list__item-ext">.{script.extension}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
