import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { HistoryEntry } from "../types";
import "./HistoryPanel.css";

interface HistoryPanelProps {
  /** Incremented by App.tsx after each append_history to force a reload */
  historyVersion: number;
}

const HISTORY_LIMIT = 50;

/** Formats a duration in ms to a human-readable string (e.g., "1.2s", "42ms") */
function formatDuration(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${ms}ms`;
}

const DATE_FORMAT_OPTIONS = {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
} as const satisfies Intl.DateTimeFormatOptions;

/** Formats an ISO 8601 timestamp to a short local date/time string */
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, DATE_FORMAT_OPTIONS);
  } catch {
    return iso;
  }
}

export default function HistoryPanel({
  historyVersion,
}: HistoryPanelProps): JSX.Element {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await invoke<HistoryEntry[]>("get_history", {
          limit: HISTORY_LIMIT,
        });
        if (!cancelled) {
          setEntries(data);
          setSelectedEntry((prev) => {
            if (prev === null) return null;
            const found = data.find((e) => e.id === prev.id);
            return found ?? null;
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(String(err));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [historyVersion]);

  const handleEntryClick = useCallback((entry: HistoryEntry) => {
    setSelectedEntry((prev) => (prev?.id === entry.id ? null : entry));
  }, []);

  const handleClear = useCallback(async () => {
    const confirmed = window.confirm(
      "Clear all execution history? This action cannot be undone.",
    );
    if (!confirmed) return;

    try {
      await invoke<void>("clear_history");
      setEntries([]);
      setSelectedEntry(null);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  if (isLoading) {
    return (
      <div className="history-panel">
        <p className="history-panel__loading">Loading history...</p>
      </div>
    );
  }

  return (
    <div className="history-panel">
      <div className="history-panel__toolbar">
        <span className="history-panel__title">History</span>
        <button
          type="button"
          className="history-panel__clear-btn"
          onClick={handleClear}
          disabled={entries.length === 0}
        >
          Clear history
        </button>
      </div>

      {error !== null && (
        <p className="history-panel__error">{error}</p>
      )}

      <div className="history-panel__body">
        <div className="history-panel__list">
          {entries.length === 0 ? (
            <p className="history-panel__empty">No executions</p>
          ) : (
            <ul className="history-panel__entries">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className={`history-panel__entry${selectedEntry?.id === entry.id ? " history-panel__entry--selected" : ""}`}
                  onClick={() => handleEntryClick(entry)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleEntryClick(entry);
                    }
                  }}
                >
                  <span className="history-panel__entry-name">
                    {entry.script_name}
                  </span>
                  <span className="history-panel__entry-meta">
                    {formatDate(entry.started_at)} · {formatDuration(entry.duration_ms)}
                  </span>
                  <span
                    className={`history-panel__badge${entry.exit_code === 0 ? " history-panel__badge--success" : " history-panel__badge--error"}`}
                  >
                    {entry.exit_code === 0 ? "OK" : `✗ ${entry.exit_code}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selectedEntry !== null && (
          <div className="history-panel__detail">
            <div className="history-panel__detail-header">
              <span className="history-panel__detail-title">
                {selectedEntry.script_name}
              </span>
              <span className="history-panel__detail-meta">
                {formatDate(selectedEntry.started_at)} ·{" "}
                {formatDuration(selectedEntry.duration_ms)} ·{" "}
                <span
                  className={
                    selectedEntry.exit_code === 0
                      ? "history-panel__badge history-panel__badge--success"
                      : "history-panel__badge history-panel__badge--error"
                  }
                >
                  {selectedEntry.exit_code === 0
                    ? "Success"
                    : `Error (code: ${selectedEntry.exit_code})`}
                </span>
              </span>
            </div>

            <div className="history-panel__detail-section">
              <span className="history-panel__detail-label">
                Standard output
              </span>
              <pre className="history-panel__detail-stdout">
                {selectedEntry.stdout.trim() !== ""
                  ? selectedEntry.stdout
                  : "(empty)"}
              </pre>
            </div>

            {selectedEntry.stderr.trim() !== "" && (
              <div className="history-panel__detail-section">
                <span className="history-panel__detail-label">
                  Standard error
                </span>
                <pre className="history-panel__detail-stderr">
                  {selectedEntry.stderr}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
