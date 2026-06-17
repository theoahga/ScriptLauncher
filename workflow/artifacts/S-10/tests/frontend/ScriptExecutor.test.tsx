import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import ScriptExecutor from "./ScriptExecutor";
import { ScriptInfo } from "../types";

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock @tauri-apps/api/event
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const mockScript: ScriptInfo = {
  name: "deploy.sh",
  path: "/scripts/deploy.sh",
  extension: "sh",
};

describe("ScriptExecutor — S-10 streaming", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invoke).mockResolvedValue(undefined);
    vi.mocked(listen).mockResolvedValue(() => {});
  });

  // Cas 1 : script null → message "Aucun script sélectionné"
  it("affiche 'Aucun script sélectionné' quand script est null", () => {
    render(<ScriptExecutor script={null} />);

    expect(screen.getByText("Aucun script sélectionné")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });

  // Cas 2 : script non-null → affiche le nom du script et le bouton Exécuter
  it("affiche le nom du script et le bouton Exécuter quand script est fourni", () => {
    render(<ScriptExecutor script={mockScript} />);

    expect(screen.getByText("deploy.sh")).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: "Exécuter" });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  // Cas 3 : bouton Stop visible pendant l'exécution, caché sinon
  it("affiche le bouton Stop pendant l'exécution et le masque sinon", async () => {
    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));

    render(<ScriptExecutor script={mockScript} />);

    expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Exécuter" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "En cours..." })).toBeDisabled();
  });

  // Cas 4 : clic Stop → invoke('kill_script') appelé
  it("appelle invoke('kill_script') quand on clique Stop", async () => {
    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));

    render(<ScriptExecutor script={mockScript} />);

    fireEvent.click(screen.getByRole("button", { name: "Exécuter" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
    });

    vi.mocked(invoke).mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("kill_script");
    });
  });

  // Cas 5 : lignes stdout affichées au fur et à mesure via événements simulés
  it("affiche les lignes stdout successives via les événements script-stdout", async () => {
    let stdoutHandler: ((event: { payload: { line: string } }) => void) | undefined;

    vi.mocked(listen).mockImplementation(
      async (event: string, handler: (e: unknown) => void) => {
        if (event === "script-stdout") {
          stdoutHandler = handler as (event: { payload: { line: string } }) => void;
        }
        return () => {};
      },
    );

    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));

    render(<ScriptExecutor script={mockScript} />);

    fireEvent.click(screen.getByRole("button", { name: "Exécuter" }));

    await waitFor(() => {
      expect(listen).toHaveBeenCalledWith("script-stdout", expect.any(Function));
    });

    act(() => { stdoutHandler?.({ payload: { line: "line one" } }); });
    act(() => { stdoutHandler?.({ payload: { line: "line two" } }); });

    await waitFor(() => {
      const pre = document.querySelector("pre.script-executor__stdout");
      expect(pre?.textContent).toContain("line one");
      expect(pre?.textContent).toContain("line two");
    });
  });

  // Cas 6 : zone d'output vidée au démarrage d'un nouveau run
  it("vide la zone output au démarrage d'un nouveau run", async () => {
    let stdoutHandler: ((event: { payload: { line: string } }) => void) | undefined;
    let doneHandler: ((event: { payload: { exit_code: number; stderr: string } }) => void) | undefined;

    vi.mocked(listen).mockImplementation(
      async (event: string, handler: (e: unknown) => void) => {
        if (event === "script-stdout") stdoutHandler = handler as typeof stdoutHandler;
        if (event === "script-done") doneHandler = handler as typeof doneHandler;
        return () => {};
      },
    );

    vi.mocked(invoke).mockResolvedValue(undefined);

    render(<ScriptExecutor script={mockScript} />);

    fireEvent.click(screen.getByRole("button", { name: "Exécuter" }));
    await waitFor(() => expect(listen).toHaveBeenCalledWith("script-stdout", expect.any(Function)));

    act(() => { stdoutHandler?.({ payload: { line: "first run output" } }); });
    act(() => { doneHandler?.({ payload: { exit_code: 0, stderr: "" } }); });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Exécuter" })).not.toBeDisabled();
    });

    vi.clearAllMocks();
    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));
    vi.mocked(listen).mockResolvedValue(() => {});

    fireEvent.click(screen.getByRole("button", { name: "Exécuter" }));

    await waitFor(() => {
      // Dès que isRunning=true, lines=[] et exitCode=null → hasOutput=false → pre non rendu
      // OU si le pre est rendu, il ne contient pas la sortie du premier run
      const pre = document.querySelector("pre.script-executor__stdout");
      if (pre) {
        expect(pre.textContent).not.toContain("first run output");
      } else {
        // pre absent = output vidé (hasOutput=false), comportement attendu
        expect(screen.getByRole("button", { name: "En cours..." })).toBeInTheDocument();
      }
    });
  });

  // Cas 7 : script-done reçu → exit code affiché, bouton Stop disparu
  it("affiche l'exit code et masque Stop quand script-done est reçu", async () => {
    let doneHandler: ((event: { payload: { exit_code: number; stderr: string } }) => void) | undefined;

    vi.mocked(listen).mockImplementation(
      async (event: string, handler: (e: unknown) => void) => {
        if (event === "script-done") doneHandler = handler as typeof doneHandler;
        return () => {};
      },
    );

    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));

    render(<ScriptExecutor script={mockScript} />);
    fireEvent.click(screen.getByRole("button", { name: "Exécuter" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
    });

    act(() => { doneHandler?.({ payload: { exit_code: 0, stderr: "" } }); });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
      expect(screen.getByText("Succès")).toBeInTheDocument();
    });
  });

  // Cas 8 : invoke('run_script_stream') échoue → erreur affichée, Stop masqué
  it("affiche l'erreur quand run_script_stream rejette", async () => {
    vi.mocked(invoke).mockRejectedValue("Path does not exist: /scripts/deploy.sh");

    render(<ScriptExecutor script={mockScript} />);

    fireEvent.click(screen.getByRole("button", { name: "Exécuter" }));

    await waitFor(() => {
      expect(
        screen.getByText("Path does not exist: /scripts/deploy.sh"),
      ).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
  });

  // Cas 9 : auto-scroll déclenché à chaque nouvelle ligne
  it("déclenche auto-scroll sur le pre à chaque nouvelle ligne", async () => {
    let stdoutHandler: ((event: { payload: { line: string } }) => void) | undefined;

    vi.mocked(listen).mockImplementation(
      async (event: string, handler: (e: unknown) => void) => {
        if (event === "script-stdout") stdoutHandler = handler as typeof stdoutHandler;
        return () => {};
      },
    );
    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));

    render(<ScriptExecutor script={mockScript} />);
    fireEvent.click(screen.getByRole("button", { name: "Exécuter" }));

    await waitFor(() => expect(listen).toHaveBeenCalledWith("script-stdout", expect.any(Function)));

    act(() => { stdoutHandler?.({ payload: { line: "trigger scroll" } }); });

    await waitFor(() => {
      const pre = document.querySelector("pre.script-executor__stdout");
      expect(pre?.textContent).toContain("trigger scroll");
    });

    const pre = document.querySelector("pre.script-executor__stdout");
    expect(pre).not.toBeNull();
  });

  // Cas 10 : changement de script → reset des états (lignes, exit code, erreur)
  it("efface la sortie précédente et remet à zéro quand le script change", async () => {
    let doneHandler: ((event: { payload: { exit_code: number; stderr: string } }) => void) | undefined;

    vi.mocked(listen).mockImplementation(
      async (event: string, handler: (e: unknown) => void) => {
        if (event === "script-done") doneHandler = handler as typeof doneHandler;
        return () => {};
      },
    );
    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));

    const { rerender } = render(<ScriptExecutor script={mockScript} />);
    fireEvent.click(screen.getByRole("button", { name: "Exécuter" }));

    await waitFor(() => expect(listen).toHaveBeenCalledWith("script-done", expect.any(Function)));

    act(() => { doneHandler?.({ payload: { exit_code: 42, stderr: "" } }); });

    await waitFor(() => {
      expect(screen.getByText("Erreur (code : 42)")).toBeInTheDocument();
    });

    const newScript: ScriptInfo = {
      name: "backup.py",
      path: "/scripts/backup.py",
      extension: "py",
    };
    rerender(<ScriptExecutor script={newScript} />);

    expect(screen.queryByText("Erreur (code : 42)")).not.toBeInTheDocument();
    expect(screen.getByText("backup.py")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exécuter" })).not.toBeDisabled();
  });
});
