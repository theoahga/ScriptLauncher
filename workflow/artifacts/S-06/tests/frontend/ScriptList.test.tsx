import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ScriptList from "./ScriptList";
import { ScriptInfo } from "../types";

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

const mockScripts: ScriptInfo[] = [
  { name: "deploy.sh", path: "/scripts/deploy.sh", extension: "sh" },
  { name: "backup.py", path: "/scripts/backup.py", extension: "py" },
  { name: "build.js", path: "/scripts/build.js", extension: "js" },
];

describe("ScriptList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Cas 1 : folderPath null
  it("affiche 'Aucun dossier sélectionné' quand folderPath est null", () => {
    render(<ScriptList folderPath={null} onScriptSelected={vi.fn()} />);

    expect(
      screen.getByText("Aucun dossier sélectionné"),
    ).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });

  // Cas 2 : état de chargement
  it("affiche 'Chargement...' pendant que invoke est en cours", async () => {
    // invoke ne résout jamais → on reste en loading
    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));

    render(<ScriptList folderPath="/scripts" onScriptSelected={vi.fn()} />);

    expect(screen.getByText("Chargement...")).toBeInTheDocument();
  });

  // Cas 3 : liste vide
  it("affiche 'Aucun script trouvé' quand invoke retourne un tableau vide", async () => {
    vi.mocked(invoke).mockResolvedValue([]);

    render(<ScriptList folderPath="/scripts" onScriptSelected={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByText("Aucun script trouvé dans ce dossier"),
      ).toBeInTheDocument();
    });
  });

  // Cas 4 : liste avec items
  it("affiche les scripts retournés par invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(mockScripts);

    render(<ScriptList folderPath="/scripts" onScriptSelected={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("deploy.sh")).toBeInTheDocument();
      expect(screen.getByText("backup.py")).toBeInTheDocument();
      expect(screen.getByText("build.js")).toBeInTheDocument();
    });

    // Extensions affichées séparément avec le point
    expect(screen.getByText(".sh")).toBeInTheDocument();
    expect(screen.getByText(".py")).toBeInTheDocument();
    expect(screen.getByText(".js")).toBeInTheDocument();
  });

  // Cas 5 : erreur Rust
  it("affiche le message d'erreur retourné par Rust quand invoke rejette", async () => {
    vi.mocked(invoke).mockRejectedValue("Dossier introuvable : /scripts");

    render(<ScriptList folderPath="/scripts" onScriptSelected={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByText("Dossier introuvable : /scripts"),
      ).toBeInTheDocument();
    });
  });

  // Cas 6 : appel invoke avec les bons paramètres
  it("appelle invoke avec 'list_scripts' et le folderPath correct", async () => {
    vi.mocked(invoke).mockResolvedValue([]);

    render(<ScriptList folderPath="/my/folder" onScriptSelected={vi.fn()} />);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("list_scripts", {
        folder: "/my/folder",
      });
    });
  });

  // Cas 7 : appel onScriptSelected au clic
  it("appelle onScriptSelected avec le bon script au clic", async () => {
    vi.mocked(invoke).mockResolvedValue(mockScripts);
    const onScriptSelected = vi.fn();

    render(
      <ScriptList folderPath="/scripts" onScriptSelected={onScriptSelected} />,
    );

    await waitFor(() => {
      expect(screen.getByText("deploy.sh")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("deploy.sh"));

    expect(onScriptSelected).toHaveBeenCalledOnce();
    expect(onScriptSelected).toHaveBeenCalledWith(mockScripts[0]);
  });

  // Cas 8 : changement de folderPath déclenche un nouvel invoke
  it("relance invoke quand folderPath change", async () => {
    vi.mocked(invoke).mockResolvedValue([]);

    const { rerender } = render(
      <ScriptList folderPath="/folder1" onScriptSelected={vi.fn()} />,
    );

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("list_scripts", { folder: "/folder1" });
    });

    rerender(<ScriptList folderPath="/folder2" onScriptSelected={vi.fn()} />);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("list_scripts", { folder: "/folder2" });
    });

    expect(invoke).toHaveBeenCalledTimes(2);
  });

  // Cas 9 : folderPath passe de null à une valeur → déclenche invoke
  it("déclenche invoke quand folderPath passe de null à une valeur", async () => {
    vi.mocked(invoke).mockResolvedValue(mockScripts);

    const { rerender } = render(
      <ScriptList folderPath={null} onScriptSelected={vi.fn()} />,
    );

    expect(invoke).not.toHaveBeenCalled();
    expect(screen.getByText("Aucun dossier sélectionné")).toBeInTheDocument();

    rerender(<ScriptList folderPath="/scripts" onScriptSelected={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("deploy.sh")).toBeInTheDocument();
    });

    expect(invoke).toHaveBeenCalledOnce();
  });

  // Cas 10 : script sans extension — affichage sans span extension
  it("n'affiche pas le span extension quand extension est vide", async () => {
    const scriptWithoutExt: ScriptInfo[] = [
      { name: "Makefile", path: "/scripts/Makefile", extension: "" },
    ];
    vi.mocked(invoke).mockResolvedValue(scriptWithoutExt);

    render(<ScriptList folderPath="/scripts" onScriptSelected={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Makefile")).toBeInTheDocument();
    });

    // Le span extension avec "." ne doit pas être présent
    expect(screen.queryByText(/^\./)).not.toBeInTheDocument();
  });
});
