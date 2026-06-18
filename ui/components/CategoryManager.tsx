// CategoryManager.tsx — S-09
//
// Remplace FolderSelector. Affiche une arborescence de catégories collapsibles.
// Chaque catégorie = nœud (header cliquable + ScriptList interne).
//
// ADR-02 : saisie du nom via input inline (pas window.prompt)
// ADR-03 : UUID généré via crypto.randomUUID()
// ADR-04 : CategoryManager est auto-suffisant (charge/sauve la config)
// ADR-05 : état collapsed par category.id dans Record<string, boolean>

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

  // ADR-05 : collapsed[id] = true → catégorie repliée, false → dépliée
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // ADR-02 : état pour l'ajout inline d'une catégorie
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");

  // Chargement initial de la config
  useEffect(() => {
    let cancelled = false;

    const loadConfig = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<AppConfig>("get_config");
        if (!cancelled) {
          setConfig(result);
          // Initialiser toutes les catégories comme dépliées (expanded)
          // Modernizer: Object.fromEntries + map idiomatique (pas de mutation)
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

  // Sauvegarde de la config et mise à jour de l'état
  const persistConfig = useCallback(async (newConfig: AppConfig) => {
    try {
      await invoke("save_config", { config: newConfig });
      setConfig(newConfig);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  // Toggle collapse/expand d'une catégorie
  const handleToggle = useCallback((id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Suppression d'une catégorie
  const handleDelete = useCallback(
    async (id: string) => {
      const newConfig: AppConfig = {
        categories: config.categories.filter((c) => c.id !== id),
      };
      await persistConfig(newConfig);
    },
    [config, persistConfig]
  );

  // Démarrer l'ajout
  const handleStartAdd = useCallback(() => {
    // ADR-02 : évite double-clic si déjà en mode ajout
    if (!isAdding) {
      setIsAdding(true);
      setNewName("");
    }
  }, [isAdding]);

  // Annuler l'ajout
  const handleCancelAdd = useCallback(() => {
    setIsAdding(false);
    setNewName("");
  }, []);

  // Confirmer l'ajout : ouvre la dialog dossier, puis sauvegarde
  const handleConfirmAdd = useCallback(async () => {
    const trimmed = newName.trim();
    if (trimmed === "") return; // validation : nom non vide

    try {
      const selectedPath = await open({ directory: true });
      if (selectedPath === null) {
        // L'utilisateur a annulé la dialog — on reste en mode ajout
        return;
      }

      // ADR-03 : UUID v4 via crypto.randomUUID()
      const newCategory: Category = {
        id: crypto.randomUUID(),
        name: trimmed,
        path: selectedPath,
      };

      const newConfig: AppConfig = {
        categories: [...config.categories, newCategory],
      };

      await persistConfig(newConfig);

      // Initialiser la nouvelle catégorie comme dépliée
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
        <p className="category-manager__loading">Chargement...</p>
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
        <span className="category-manager__title">Catégories</span>
        <button
          type="button"
          className="category-manager__add-btn"
          onClick={handleStartAdd}
          aria-label="Ajouter une catégorie"
        >
          +
        </button>
      </div>

      {/* Formulaire inline d'ajout — ADR-02 */}
      {isAdding && (
        <div className="category-manager__add-form">
          <input
            type="text"
            className="category-manager__name-input"
            placeholder="Nom de la catégorie"
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
              Choisir dossier
            </button>
            <button
              type="button"
              className="category-manager__cancel-btn"
              onClick={handleCancelAdd}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Liste des catégories */}
      {config.categories.length === 0 && !isAdding && (
        <p className="category-manager__empty">Aucune catégorie</p>
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
            aria-label={`Catégorie ${category.name}`}
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
              aria-label={`Supprimer la catégorie ${category.name}`}
            >
              ✕
            </button>
          </div>

          {/* Corps de la catégorie : ScriptList (si dépliée) */}
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
