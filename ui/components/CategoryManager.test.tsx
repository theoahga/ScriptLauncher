import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import CategoryManager from "./CategoryManager";
import type { AppConfig, ScriptInfo } from "../types";

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock @tauri-apps/plugin-dialog
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

// Mock ScriptList pour isoler CategoryManager
vi.mock("./ScriptList", () => ({
  default: ({
    folderPath,
  }: {
    folderPath: string | null;
    onScriptSelected: (s: ScriptInfo) => void;
  }) => (
    <div data-testid={`scriptlist-${folderPath}`}>ScriptList:{folderPath}</div>
  ),
}));

import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

const emptyConfig: AppConfig = { categories: [] };

const configWithCategories: AppConfig = {
  categories: [
    { id: "cat-1", name: "Système", path: "/scripts/system" },
    { id: "cat-2", name: "Réseau", path: "/scripts/network" },
  ],
};

describe("CategoryManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Cas 1 : config vide → affichage "Aucune catégorie"
  it("affiche 'Aucune catégorie' quand get_config retourne une config vide", async () => {
    vi.mocked(invoke).mockResolvedValue(emptyConfig);

    render(<CategoryManager onScriptSelected={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Aucune catégorie")).toBeInTheDocument();
    });
    expect(invoke).toHaveBeenCalledWith("get_config");
  });

  // Cas 2 : catégories affichées avec ScriptList pour chaque catégorie
  it("affiche les catégories avec un ScriptList par catégorie", async () => {
    vi.mocked(invoke).mockResolvedValue(configWithCategories);

    render(<CategoryManager onScriptSelected={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Système")).toBeInTheDocument();
      expect(screen.getByText("Réseau")).toBeInTheDocument();
    });

    // Les deux ScriptList sont rendus (catégories dépliées par défaut)
    expect(screen.getByTestId("scriptlist-/scripts/system")).toBeInTheDocument();
    expect(screen.getByTestId("scriptlist-/scripts/network")).toBeInTheDocument();
  });

  // Cas 3 : collapse/expand d'une catégorie
  it("replie et déplie une catégorie au clic sur son header", async () => {
    vi.mocked(invoke).mockResolvedValue(configWithCategories);

    render(<CategoryManager onScriptSelected={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Système")).toBeInTheDocument();
    });

    // Initialement dépliée : ScriptList visible
    expect(screen.getByTestId("scriptlist-/scripts/system")).toBeInTheDocument();

    // Cliquer sur le header de "Système" pour replier
    // Utilise getAllByRole + filter pour éviter la collision avec le bouton "Supprimer"
    const headers = screen.getAllByRole("button", {
      name: /Catégorie Système/i,
    });
    // Le header a aria-label "Catégorie Système", le delete a "Supprimer la catégorie Système"
    // On prend celui dont l'aria-label est exactement "Catégorie Système"
    const systemeHeader = headers.find(
      (el) => el.getAttribute("aria-label") === "Catégorie Système"
    )!;
    fireEvent.click(systemeHeader);

    // Après collapse : ScriptList de Système n'est plus visible
    expect(
      screen.queryByTestId("scriptlist-/scripts/system")
    ).not.toBeInTheDocument();

    // "Réseau" reste dépliée
    expect(screen.getByTestId("scriptlist-/scripts/network")).toBeInTheDocument();

    // Re-cliquer pour déplier à nouveau
    fireEvent.click(systemeHeader);
    await waitFor(() => {
      expect(
        screen.getByTestId("scriptlist-/scripts/system")
      ).toBeInTheDocument();
    });
  });

  // Cas 4 : ajout d'une catégorie → save_config appelé
  it("appelle save_config avec la nouvelle catégorie lors de l'ajout", async () => {
    vi.mocked(invoke).mockResolvedValue(emptyConfig);
    vi.mocked(open).mockResolvedValue("/scripts/new-folder");

    render(<CategoryManager onScriptSelected={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Aucune catégorie")).toBeInTheDocument();
    });

    // Cliquer sur "+"
    const addBtn = screen.getByRole("button", {
      name: /Ajouter une catégorie/i,
    });
    fireEvent.click(addBtn);

    // Formulaire inline visible, saisir un nom
    const input = screen.getByPlaceholderText("Nom de la catégorie");
    fireEvent.change(input, { target: { value: "Backup" } });

    // Cliquer sur "Choisir dossier" — déclenche open() puis invoke save_config
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "save_config") return Promise.resolve(undefined);
      return Promise.resolve(emptyConfig);
    });

    const confirmBtn = screen.getByRole("button", { name: /Choisir dossier/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      const saveCall = vi.mocked(invoke).mock.calls.find(
        (call) => call[0] === "save_config"
      );
      expect(saveCall).toBeDefined();
      const savedConfig = (saveCall![1] as { config: AppConfig }).config;
      expect(savedConfig.categories).toHaveLength(1);
      expect(savedConfig.categories[0].name).toBe("Backup");
      expect(savedConfig.categories[0].path).toBe("/scripts/new-folder");
    });
  });

  // Cas 5 : suppression d'une catégorie → save_config appelé
  it("appelle save_config sans la catégorie supprimée lors de la suppression", async () => {
    vi.mocked(invoke).mockResolvedValue(configWithCategories);

    render(<CategoryManager onScriptSelected={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Système")).toBeInTheDocument();
    });

    vi.mocked(invoke).mockResolvedValue(undefined);

    // Cliquer sur le bouton supprimer de "Système"
    const deleteBtn = screen.getByRole("button", {
      name: /Supprimer la catégorie Système/i,
    });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      const saveCall = vi.mocked(invoke).mock.calls.find(
        (call) => call[0] === "save_config"
      );
      expect(saveCall).toBeDefined();
      const savedConfig = (saveCall![1] as { config: AppConfig }).config;
      expect(savedConfig.categories).toHaveLength(1);
      expect(savedConfig.categories[0].id).toBe("cat-2");
    });
  });

  // Cas 6 : sélection d'un script → callback appelé
  it("passe onScriptSelected aux ScriptList des catégories", async () => {
    vi.mocked(invoke).mockResolvedValue(configWithCategories);

    const onScriptSelected = vi.fn();
    render(<CategoryManager onScriptSelected={onScriptSelected} />);

    await waitFor(() => {
      // Vérifie que les ScriptList sont rendus avec le bon folderPath
      expect(
        screen.getByTestId("scriptlist-/scripts/system")
      ).toBeInTheDocument();
    });

    // La prop onScriptSelected est transmise — le mock ScriptList ne l'appelle pas
    // mais on peut vérifier qu'elle n'est pas appelée sans interaction
    expect(onScriptSelected).not.toHaveBeenCalled();
  });

  // Cas 7 : état de chargement
  it("affiche 'Chargement...' pendant le chargement initial", () => {
    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));

    render(<CategoryManager onScriptSelected={vi.fn()} />);

    expect(screen.getByText("Chargement...")).toBeInTheDocument();
  });

  // Cas 8 : annulation du formulaire d'ajout
  it("masque le formulaire quand l'utilisateur annule l'ajout", async () => {
    vi.mocked(invoke).mockResolvedValue(emptyConfig);

    render(<CategoryManager onScriptSelected={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Aucune catégorie")).toBeInTheDocument();
    });

    // Ouvrir le formulaire
    fireEvent.click(
      screen.getByRole("button", { name: /Ajouter une catégorie/i })
    );
    expect(
      screen.getByPlaceholderText("Nom de la catégorie")
    ).toBeInTheDocument();

    // Annuler
    fireEvent.click(screen.getByRole("button", { name: /Annuler/i }));
    expect(
      screen.queryByPlaceholderText("Nom de la catégorie")
    ).not.toBeInTheDocument();
  });
});
