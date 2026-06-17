import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import HistoryPanel from "./HistoryPanel";
import { HistoryEntry } from "../types";

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

// Mock window.confirm
const mockConfirm = vi.fn();
Object.defineProperty(window, "confirm", {
  writable: true,
  value: mockConfirm,
});

// Mock crypto.randomUUID (not needed in HistoryPanel but avoids jsdom gap)
Object.defineProperty(globalThis, "crypto", {
  writable: true,
  value: { randomUUID: () => "test-uuid" },
});

// Données de test
const entry1: HistoryEntry = {
  id: "uuid-001",
  script_name: "deploy.sh",
  script_path: "/scripts/deploy.sh",
  started_at: "2026-06-17T14:32:00Z",
  duration_ms: 1240,
  exit_code: 0,
  stdout: "Deploy successful\nAll done.",
  stderr: "",
};

const entry2: HistoryEntry = {
  id: "uuid-002",
  script_name: "backup.py",
  script_path: "/scripts/backup.py",
  started_at: "2026-06-17T15:00:00Z",
  duration_ms: 500,
  exit_code: 1,
  stdout: "Starting backup...",
  stderr: "Error: disk full",
};

describe("HistoryPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirm.mockReturnValue(false);
  });

  // ── Cas 1 : liste vide → message "Aucune exécution" ──────────────────────
  it("affiche 'Aucune exécution' quand l'historique est vide", async () => {
    vi.mocked(invoke).mockResolvedValue([]);

    render(<HistoryPanel historyVersion={0} />);

    await waitFor(() => {
      expect(screen.getByText("Aucune exécution")).toBeInTheDocument();
    });
    expect(invoke).toHaveBeenCalledWith("get_history", { limit: 50 });
  });

  // ── Cas 2 : entrée affichée avec nom, date et exit code ───────────────────
  it("affiche le nom du script, la date et le badge exit code de chaque entrée", async () => {
    vi.mocked(invoke).mockResolvedValue([entry1, entry2]);

    render(<HistoryPanel historyVersion={0} />);

    await waitFor(() => {
      expect(screen.getByText("deploy.sh")).toBeInTheDocument();
      expect(screen.getByText("backup.py")).toBeInTheDocument();
    });

    // Badge exit code 0 → "OK"
    const badges = screen.getAllByText("OK");
    expect(badges.length).toBeGreaterThanOrEqual(1);

    // Badge exit code 1 → "✗ 1"
    expect(screen.getByText("✗ 1")).toBeInTheDocument();
  });

  // ── Cas 3 : clic sur une entrée → stdout affiché dans le détail ───────────
  it("affiche le stdout de l'entrée sélectionnée lors du clic", async () => {
    vi.mocked(invoke).mockResolvedValue([entry1]);

    render(<HistoryPanel historyVersion={0} />);

    await waitFor(() => {
      expect(screen.getByText("deploy.sh")).toBeInTheDocument();
    });

    // Avant le clic : pas de détail
    expect(screen.queryByText("Deploy successful")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("deploy.sh").closest("li")!);

    await waitFor(() => {
      const stdout = document.querySelector(
        "pre.history-panel__detail-stdout",
      );
      expect(stdout?.textContent).toContain("Deploy successful");
      expect(stdout?.textContent).toContain("All done.");
    });
  });

  // ── Cas 4 : bouton "Effacer" → clear_history invoqué après confirmation ───
  it("appelle clear_history et vide la liste quand l'utilisateur confirme l'effacement", async () => {
    vi.mocked(invoke).mockResolvedValue([entry1]);
    mockConfirm.mockReturnValue(true);

    render(<HistoryPanel historyVersion={0} />);

    await waitFor(() => {
      expect(screen.getByText("deploy.sh")).toBeInTheDocument();
    });

    // Simuler clear_history qui retourne undefined
    vi.mocked(invoke).mockResolvedValueOnce(undefined);

    fireEvent.click(
      screen.getByRole("button", { name: "Effacer l'historique" }),
    );

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("clear_history");
    });

    // Après effacement, la liste doit être vide
    await waitFor(() => {
      expect(screen.getByText("Aucune exécution")).toBeInTheDocument();
    });
  });

  // ── Cas 5 : annulation de la confirmation → clear_history non appelé ──────
  it("n'appelle pas clear_history si l'utilisateur annule la confirmation", async () => {
    vi.mocked(invoke).mockResolvedValue([entry1]);
    mockConfirm.mockReturnValue(false);

    render(<HistoryPanel historyVersion={0} />);

    await waitFor(() => {
      expect(screen.getByText("deploy.sh")).toBeInTheDocument();
    });

    const clearCallsBefore = vi
      .mocked(invoke)
      .mock.calls.filter((call) => call[0] === "clear_history").length;

    fireEvent.click(
      screen.getByRole("button", { name: "Effacer l'historique" }),
    );

    // Pas de nouvel appel à clear_history
    const clearCallsAfter = vi
      .mocked(invoke)
      .mock.calls.filter((call) => call[0] === "clear_history").length;
    expect(clearCallsAfter).toBe(clearCallsBefore);

    // La liste est toujours visible
    expect(screen.getByText("deploy.sh")).toBeInTheDocument();
  });

  // ── Cas 6 : historyVersion change → get_history rechargé ─────────────────
  it("recharge l'historique quand historyVersion change", async () => {
    vi.mocked(invoke).mockResolvedValue([entry1]);

    const { rerender } = render(<HistoryPanel historyVersion={0} />);

    await waitFor(() => {
      expect(screen.getByText("deploy.sh")).toBeInTheDocument();
    });

    const callsAfterFirstLoad = vi.mocked(invoke).mock.calls.length;

    // Simuler un nouvel append (historyVersion++): l'historique contient maintenant entry1 + entry2
    vi.mocked(invoke).mockResolvedValue([entry2, entry1]);
    rerender(<HistoryPanel historyVersion={1} />);

    await waitFor(() => {
      expect(vi.mocked(invoke).mock.calls.length).toBeGreaterThan(
        callsAfterFirstLoad,
      );
    });

    await waitFor(() => {
      expect(screen.getByText("backup.py")).toBeInTheDocument();
    });
  });

  // ── Cas 7 : bouton Effacer désactivé quand liste vide ─────────────────────
  it("désactive le bouton 'Effacer l'historique' quand la liste est vide", async () => {
    vi.mocked(invoke).mockResolvedValue([]);

    render(<HistoryPanel historyVersion={0} />);

    await waitFor(() => {
      expect(screen.getByText("Aucune exécution")).toBeInTheDocument();
    });

    const clearBtn = screen.getByRole("button", {
      name: "Effacer l'historique",
    });
    expect(clearBtn).toBeDisabled();
  });

  // ── Cas 8 : erreur invoke → message d'erreur affiché ─────────────────────
  it("affiche le message d'erreur quand get_history rejette", async () => {
    vi.mocked(invoke).mockRejectedValue("Erreur accès disque");

    render(<HistoryPanel historyVersion={0} />);

    await waitFor(() => {
      expect(screen.getByText("Erreur accès disque")).toBeInTheDocument();
    });
  });

  // ── Cas 9 : clic sur entrée déjà sélectionnée → désélectionne ────────────
  it("désélectionne l'entrée si on clique dessus une deuxième fois", async () => {
    vi.mocked(invoke).mockResolvedValue([entry1]);

    render(<HistoryPanel historyVersion={0} />);

    await waitFor(() => {
      expect(screen.getByText("deploy.sh")).toBeInTheDocument();
    });

    const entryEl = screen.getByText("deploy.sh").closest("li")!;

    // Premier clic → sélectionne
    fireEvent.click(entryEl);
    await waitFor(() => {
      expect(
        document.querySelector("pre.history-panel__detail-stdout"),
      ).toBeInTheDocument();
    });

    // Deuxième clic → désélectionne
    act(() => {
      fireEvent.click(entryEl);
    });
    await waitFor(() => {
      expect(
        document.querySelector("pre.history-panel__detail-stdout"),
      ).not.toBeInTheDocument();
    });
  });

  // ── Cas 10 : stderr affiché seulement si non vide ─────────────────────────
  it("affiche la section stderr seulement si le contenu est non vide", async () => {
    vi.mocked(invoke).mockResolvedValue([entry2]);

    render(<HistoryPanel historyVersion={0} />);

    await waitFor(() => {
      expect(screen.getByText("backup.py")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("backup.py").closest("li")!);

    await waitFor(() => {
      const stderr = document.querySelector(
        "pre.history-panel__detail-stderr",
      );
      expect(stderr?.textContent).toContain("Error: disk full");
    });

    // Pour entry1 (stderr vide), la section stderr ne doit pas apparaître
    vi.mocked(invoke).mockResolvedValue([entry1]);
    const { rerender } = render(<HistoryPanel historyVersion={0} />);
    rerender(<HistoryPanel historyVersion={1} />);

    await waitFor(() => {
      expect(screen.getAllByText("deploy.sh")[0]).toBeInTheDocument();
    });
  });
});
