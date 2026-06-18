import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import ScriptList from "./ScriptList";
import type { AppConfig, Category, ScriptInfo } from "../types";
import "./CategoryManager.css";

interface CategoryManagerProps {
  onScriptSelected: (script: ScriptInfo) => void;
  onScriptNewInstance?: (script: ScriptInfo) => void;
}

export default function CategoryManager({
  onScriptSelected,
  onScriptNewInstance,
}: CategoryManagerProps): JSX.Element {
  const [config, setConfig] = useState<AppConfig>({ categories: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // collapsed[id] = true → category is collapsed, false → expanded
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadConfig = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<AppConfig>("get_config");
        if (!cancelled) {
          setConfig(result);
          // Initialize all categories as expanded
          setCollapsed(
            Object.fromEntries(result.categories.map((cat) => [cat.id, false]))
          );
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

    loadConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  const persistConfig = useCallback(async (newConfig: AppConfig) => {
    try {
      await invoke("save_config", { config: newConfig });
      setConfig(newConfig);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  const handleToggle = useCallback((id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      const newConfig: AppConfig = {
        categories: config.categories.filter((c) => c.id !== id),
      };
      await persistConfig(newConfig);
    },
    [config, persistConfig]
  );

  const handleStartAdd = useCallback(() => {
    if (!isAdding) {
      setIsAdding(true);
      setNewName("");
    }
  }, [isAdding]);

  const handleCancelAdd = useCallback(() => {
    setIsAdding(false);
    setNewName("");
  }, []);

  const handleConfirmAdd = useCallback(async () => {
    const trimmed = newName.trim();
    if (trimmed === "") return; // validate: non-empty name

    try {
      const selectedPath = await open({ directory: true });
      if (selectedPath === null) {
        // User cancelled the dialog — stay in add mode
        return;
      }

      const newCategory: Category = {
        id: crypto.randomUUID(),
        name: trimmed,
        path: selectedPath,
      };

      const newConfig: AppConfig = {
        categories: [...config.categories, newCategory],
      };

      await persistConfig(newConfig);

      // Initialize new category as expanded
      setCollapsed((prev) => ({ ...prev, [newCategory.id]: false }));

      setIsAdding(false);
      setNewName("");
    } catch (err) {
      setError(String(err));
    }
  }, [newName, config, persistConfig]);

  if (loading) {
    return (
      <div className="category-manager">
        <p className="category-manager__loading">Loading...</p>
      </div>
    );
  }

  if (error !== null) {
    return (
      <div className="category-manager">
        <p className="category-manager__error">{error}</p>
      </div>
    );
  }

  return (
    <div className="category-manager">
      <div className="category-manager__header">
        <span className="category-manager__title">Categories</span>
        <button
          type="button"
          className="category-manager__add-btn"
          onClick={handleStartAdd}
          aria-label="Add a category"
        >
          +
        </button>
      </div>

      {isAdding && (
        <div className="category-manager__add-form">
          <input
            type="text"
            className="category-manager__name-input"
            placeholder="Category name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirmAdd();
              if (e.key === "Escape") handleCancelAdd();
            }}
            autoFocus
          />
          <div className="category-manager__add-actions">
            <button
              type="button"
              className="category-manager__confirm-btn"
              onClick={handleConfirmAdd}
              disabled={newName.trim() === ""}
            >
              Choose folder
            </button>
            <button
              type="button"
              className="category-manager__cancel-btn"
              onClick={handleCancelAdd}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {config.categories.length === 0 && !isAdding && (
        <p className="category-manager__empty">No categories</p>
      )}

      {config.categories.map((category) => (
        <div key={category.id} className="category-manager__category">
          <div
            className="category-manager__category-header"
            onClick={() => handleToggle(category.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") handleToggle(category.id);
            }}
            aria-expanded={!collapsed[category.id]}
            aria-label={`Category ${category.name}`}
          >
            <span className="category-manager__chevron">
              {collapsed[category.id] ? "▶" : "▼"}
            </span>
            <span className="category-manager__category-name">
              {category.name}
            </span>
            <button
              type="button"
              className="category-manager__delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(category.id);
              }}
              aria-label={`Delete category ${category.name}`}
            >
              ✕
            </button>
          </div>

          {!collapsed[category.id] && (
            <div className="category-manager__category-body">
              <ScriptList
                folderPath={category.path}
                onScriptSelected={onScriptSelected}
                onScriptNewInstance={onScriptNewInstance}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
