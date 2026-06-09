import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ScriptExecutor from "./ScriptExecutor";
import { ScriptInfo, ScriptOutput } from "../types";

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

const mockScript: ScriptInfo = {
  name: "deploy.sh",
  path: "/scripts/deploy.sh",
  extension: "sh",
};

const mockOutputSuccess: ScriptOutput = {
  stdout: "Deployment complete\nAll services running",
  stderr: "",
  exit_code: 0,
};

const mockOutputError: ScriptOutput = {
  stdout: "Partial output",
  stderr: "Error: connection refused",
  exit_code: 1,
};

describe("ScriptExecutor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Cas 1 : script null → message "Aucun script sélectionné"
  it("affiche 'Aucun script sélectionné' quand script est null", () => {
    render(<ScriptExecutor script={null} />);

    expect(screen.getByText("Aucun script sélectionné")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });

  // Cas 2 : script non-null → affiche le nom du script et le bouton
  it("affiche le nom du script et le bouton Exécuter quand script est fourni", () => {
    render(<ScriptExecutor script={mockScript} />);

    expect(screen.getByText("deploy.sh")).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: "Exécuter" });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  // Cas 3 : bouton désactivé pendant l'exécution (isRunning)
  it("désactive le bouton et affiche 'En cours...' pendant l'invoke", async () => {
    // invoke ne résout jamais → on reste en isRunning
    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));

    render(<ScriptExecutor script={mockScript} />);

    const btn = screen.getByRole("button", { name: "Exécuter" });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "En cours..." })).toBeDisabled();
    });

    expect(invoke).toHaveBeenCalledWith("run_script", {
      path: "/scripts/deploy.sh",
    });
  });

  // Cas 4 : succès exit_code=0 → badge Succès + stdout affiché
  it("affiche le badge Succès et stdout quand exit_code est 0", async () => {
    vi.mocked(invoke).mockResolvedValue(mockOutputSuccess);

    render(<ScriptExecutor script={mockScript} />);

    fireEvent.click(screen.getByRole("button", { name: "Exécuter" }));

    await waitFor(() => {
      expect(screen.getByText("Succès")).toBeInTheDocument();
    });

    // Le texte multilignes dans <pre> est cherché via un matcher personnalisé
    expect(
      screen.getByText((content) =>
        content.includes("Deployment complete") && content.includes("All services running"),
      ),
    ).toBeInTheDocument();
    // stderr vide → section stderr non affichée
    expect(screen.queryByText("Erreur standard")).not.toBeInTheDocument();
    // bouton réactivé
    expect(screen.getByRole("button", { name: "Exécuter" })).not.toBeDisabled();
  });

  // Cas 5 : erreur exit_code≠0 → badge Erreur (code : X) + stdout + stderr affichés
  it("affiche le badge Erreur et les sorties quand exit_code est non-nul", async () => {
    vi.mocked(invoke).mockResolvedValue(mockOutputError);

    render(<ScriptExecutor script={mockScript} />);

    fireEvent.click(screen.getByRole("button", { name: "Exécuter" }));

    await waitFor(() => {
      expect(screen.getByText("Erreur (code : 1)")).toBeInTheDocument();
    });

    expect(screen.getByText("Partial output")).toBeInTheDocument();
    expect(screen.getByText("Error: connection refused")).toBeInTheDocument();
    expect(screen.getByText("Erreur standard")).toBeInTheDocument();
  });

  // Cas 6 : erreur Rust (invoke rejette) → message d'erreur affiché
  it("affiche le message d'erreur Rust quand invoke rejette", async () => {
    vi.mocked(invoke).mockRejectedValue("Path does not exist: /scripts/deploy.sh");

    render(<ScriptExecutor script={mockScript} />);

    fireEvent.click(screen.getByRole("button", { name: "Exécuter" }));

    await waitFor(() => {
      expect(
        screen.getByText("Path does not exist: /scripts/deploy.sh"),
      ).toBeInTheDocument();
    });

    // Pas de section output
    expect(screen.queryByText("Succès")).not.toBeInTheDocument();
    expect(screen.queryByText(/Erreur \(code/)).not.toBeInTheDocument();
  });

  // Cas 7 : stdout vide → affiche "(vide)"
  it("affiche '(vide)' quand stdout est une chaîne vide", async () => {
    vi.mocked(invoke).mockResolvedValue({
      stdout: "",
      stderr: "",
      exit_code: 0,
    } satisfies ScriptOutput);

    render(<ScriptExecutor script={mockScript} />);

    fireEvent.click(screen.getByRole("button", { name: "Exécuter" }));

    await waitFor(() => {
      expect(screen.getByText("(vide)")).toBeInTheDocument();
    });
  });

  // Cas 8 : stderr non vide avec exit_code=0 → badge Succès ET section stderr
  it("affiche le badge Succès ET la section stderr quand stderr est non vide avec exit_code=0", async () => {
    vi.mocked(invoke).mockResolvedValue({
      stdout: "done",
      stderr: "warning: deprecated API",
      exit_code: 0,
    } satisfies ScriptOutput);

    render(<ScriptExecutor script={mockScript} />);

    fireEvent.click(screen.getByRole("button", { name: "Exécuter" }));

    await waitFor(() => {
      expect(screen.getByText("Succès")).toBeInTheDocument();
    });

    expect(screen.getByText("warning: deprecated API")).toBeInTheDocument();
    expect(screen.getByText("Erreur standard")).toBeInTheDocument();
  });

  // Cas 9 : changement de script → reset des états
  it("efface la sortie précédente quand le script change", async () => {
    vi.mocked(invoke).mockResolvedValue(mockOutputSuccess);

    const { rerender } = render(<ScriptExecutor script={mockScript} />);

    fireEvent.click(screen.getByRole("button", { name: "Exécuter" }));

    await waitFor(() => {
      expect(screen.getByText("Succès")).toBeInTheDocument();
    });

    const newScript: ScriptInfo = {
      name: "backup.py",
      path: "/scripts/backup.py",
      extension: "py",
    };
    rerender(<ScriptExecutor script={newScript} />);

    expect(screen.queryByText("Succès")).not.toBeInTheDocument();
    expect(
      screen.queryByText((content) =>
        content.includes("Deployment complete") && content.includes("All services running"),
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByText("backup.py")).toBeInTheDocument();
  });

  // Cas 10 : exit_code=-1 (signal killed) → badge Erreur
  it("affiche le badge Erreur quand exit_code est -1 (signal killed)", async () => {
    vi.mocked(invoke).mockResolvedValue({
      stdout: "",
      stderr: "",
      exit_code: -1,
    } satisfies ScriptOutput);

    render(<ScriptExecutor script={mockScript} />);

    fireEvent.click(screen.getByRole("button", { name: "Exécuter" }));

    await waitFor(() => {
      expect(screen.getByText("Erreur (code : -1)")).toBeInTheDocument();
    });
  });
});
