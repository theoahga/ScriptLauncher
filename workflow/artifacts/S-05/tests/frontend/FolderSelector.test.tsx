import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import FolderSelector from "../../ui/components/FolderSelector";

// Mock @tauri-apps/plugin-dialog
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

import { open } from "@tauri-apps/plugin-dialog";

describe("FolderSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le bouton 'Sélectionner un dossier' au rendu initial", () => {
    render(<FolderSelector onFolderSelected={vi.fn()} />);

    const button = screen.getByRole("button", {
      name: "Sélectionner un dossier",
    });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("type", "button");
  });

  it("n'affiche pas de chemin au rendu initial", () => {
    render(<FolderSelector onFolderSelected={vi.fn()} />);

    // Aucun paragraphe de chemin ne doit être présent
    expect(screen.queryByRole("paragraph")).not.toBeInTheDocument();
  });

  it("ouvre la dialog native au clic sur le bouton", async () => {
    vi.mocked(open).mockResolvedValue(null);

    render(<FolderSelector onFolderSelected={vi.fn()} />);

    const button = screen.getByRole("button", {
      name: "Sélectionner un dossier",
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(open).toHaveBeenCalledOnce();
      expect(open).toHaveBeenCalledWith({ directory: true });
    });
  });

  it("affiche le chemin et appelle onFolderSelected quand un dossier est sélectionné", async () => {
    const mockPath = "/Users/test/scripts";
    vi.mocked(open).mockResolvedValue(mockPath);
    const onFolderSelected = vi.fn();

    render(<FolderSelector onFolderSelected={onFolderSelected} />);

    const button = screen.getByRole("button", {
      name: "Sélectionner un dossier",
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(mockPath)).toBeInTheDocument();
    });

    expect(onFolderSelected).toHaveBeenCalledOnce();
    expect(onFolderSelected).toHaveBeenCalledWith(mockPath);
  });

  it("ne change pas l'état et n'appelle pas onFolderSelected quand l'utilisateur annule (null)", async () => {
    vi.mocked(open).mockResolvedValue(null);
    const onFolderSelected = vi.fn();

    render(<FolderSelector onFolderSelected={onFolderSelected} />);

    const button = screen.getByRole("button", {
      name: "Sélectionner un dossier",
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(open).toHaveBeenCalledOnce();
    });

    // Pas de chemin affiché, callback non appelé
    expect(screen.queryByRole("paragraph")).not.toBeInTheDocument();
    expect(onFolderSelected).not.toHaveBeenCalled();
  });

  it("gère silencieusement une erreur de la dialog sans afficher d'erreur ni changer l'état", async () => {
    vi.mocked(open).mockRejectedValue(new Error("Permission refusée"));
    const onFolderSelected = vi.fn();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<FolderSelector onFolderSelected={onFolderSelected} />);

    const button = screen.getByRole("button", {
      name: "Sélectionner un dossier",
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Erreur lors de l'ouverture de la dialog :",
        expect.any(Error),
      );
    });

    // Aucun changement d'état
    expect(screen.queryByRole("paragraph")).not.toBeInTheDocument();
    expect(onFolderSelected).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("met à jour le chemin affiché si un nouveau dossier est sélectionné après un premier", async () => {
    const firstPath = "/Users/test/dossier1";
    const secondPath = "/Users/test/dossier2";
    vi.mocked(open)
      .mockResolvedValueOnce(firstPath)
      .mockResolvedValueOnce(secondPath);

    const onFolderSelected = vi.fn();

    render(<FolderSelector onFolderSelected={onFolderSelected} />);

    const button = screen.getByRole("button", {
      name: "Sélectionner un dossier",
    });

    fireEvent.click(button);
    await waitFor(() => expect(screen.getByText(firstPath)).toBeInTheDocument());

    fireEvent.click(button);
    await waitFor(() =>
      expect(screen.getByText(secondPath)).toBeInTheDocument(),
    );

    expect(screen.queryByText(firstPath)).not.toBeInTheDocument();
    expect(onFolderSelected).toHaveBeenCalledTimes(2);
    expect(onFolderSelected).toHaveBeenNthCalledWith(2, secondPath);
  });
});
