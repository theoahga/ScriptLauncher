import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ScriptInfo, ScriptOutput } from "../types";
import "./ScriptExecutor.css";

interface ScriptExecutorProps {
  script: ScriptInfo | null;
}

export default function ScriptExecutor({
  script,
}: ScriptExecutorProps): JSX.Element {
  const [output, setOutput] = useState<ScriptOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  // ADR-01 : reset des états quand le script sélectionné change
  // ADR-06 : ref pour annuler les invocations obsolètes
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    setOutput(null);
    setError(null);
    setIsRunning(false);

    return () => {
      cancelledRef.current = true;
    };
  }, [script]);

  const handleRun = useCallback(async () => {
    if (script === null) return;

    cancelledRef.current = false;
    setIsRunning(true);
    setOutput(null);
    setError(null);

    try {
      const result = await invoke<ScriptOutput>("run_script", {
        path: script.path,
      });
      if (!cancelledRef.current) {
        setOutput(result);
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setError(String(err));
      }
    } finally {
      if (!cancelledRef.current) {
        setIsRunning(false);
      }
    }
  }, [script]);

  if (script === null) {
    return (
      <div className="script-executor">
        <p className="script-executor__empty">Aucun script sélectionné</p>
      </div>
    );
  }

  return (
    <div className="script-executor">
      <div className="script-executor__header">
        <span className="script-executor__script-name">{script.name}</span>
        <button
          type="button"
          className="script-executor__run-btn"
          onClick={handleRun}
          disabled={isRunning}
        >
          {isRunning ? "En cours..." : "Exécuter"}
        </button>
      </div>

      {error !== null && (
        <p className="script-executor__error">{error}</p>
      )}

      {output !== null && (
        <div className="script-executor__output">
          <span
            className={
              output.exit_code === 0
                ? "script-executor__status script-executor__status--success"
                : "script-executor__status script-executor__status--error"
            }
          >
            {output.exit_code === 0
              ? "Succès"
              : `Erreur (code : ${output.exit_code})`}
          </span>

          <div className="script-executor__section">
            <span className="script-executor__section-label">
              Sortie standard
            </span>
            <pre className="script-executor__stdout">
              {output.stdout || "(vide)"}
            </pre>
          </div>

          {output.stderr.trim() !== "" && (
            <div className="script-executor__section">
              <span className="script-executor__section-label">
                Erreur standard
              </span>
              <pre className="script-executor__stderr">{output.stderr}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
