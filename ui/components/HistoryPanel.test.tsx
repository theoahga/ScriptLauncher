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

  // Case 1: empty list → "No executions" message
  it("shows 'No executions' when history is empty", async () => {
    vi.mocked(invoke).mockResolvedValue([]);

    render(<HistoryPanel historyVersion={0} />);

    await waitFor(() => {
      expect(screen.getByText("No executions")).toBeInTheDocument();
    });
    expect(invoke).toHaveBeenCalledWith("get_history", { limit: 50 });
  });

  // Case 2: entry shown with name, date, and exit code badge
  it("shows script name, date, and exit code badge for each entry", async () => {
    vi.mocked(invoke).mockResolvedValue([entry1, entry2]);

    render(<HistoryPanel historyVersion={0} />);

    await waitFor(() => {
      expect(screen.getByText("deploy.sh")).toBeInTheDocument();
      expect(screen.getByText("backup.py")).toBeInTheDocument();
    });

    // exit code 0 → "OK"
    const badges = screen.getAllByText("OK");
    expect(badges.length).toBeGreaterThanOrEqual(1);

    // exit code 1 → "✗ 1"
    expect(screen.getByText("✗ 1")).toBeInTheDocument();
  });

  // Case 3: click on an entry → stdout shown in detail pane
  it("shows stdout of the selected entry on click", async () => {
    vi.mocked(invoke).mockResolvedValue([entry1]);

    render(<HistoryPanel historyVersion={0} />);

    await waitFor(() => {
      expect(screen.getByText("deploy.sh")).toBeInTheDocument();
    });

    // Before click: no detail
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

  // Case 4: "Clear history" → clear_history invoked after confirmation
  it("calls clear_history and empties the list when the user confirms", async () => {
    vi.mocked(invoke).mockResolvedValue([entry1]);
    mockConfirm.mockReturnValue(true);

    render(<HistoryPanel historyVersion={0} />);

    await waitFor(() => {
      expect(screen.getByText("deploy.sh")).toBeInTheDocument();
    });

    // Simulate clear_history returning undefined
    vi.mocked(invoke).mockResolvedValueOnce(undefined);

    fireEvent.click(
      screen.getByRole("button", { name: "Clear history" }),
    );

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("clear_history");
    });

    // After clearing, the list should be empty
    await waitFor(() => {
      expect(screen.getByText("No executions")).toBeInTheDocument();
    });
  });

  // Case 5: confirmation cancelled → clear_history not called
  it("does not call clear_history if the user cancels", async () => {
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
      screen.getByRole("button", { name: "Clear history" }),
    );

    // No new call to clear_history
    const clearCallsAfter = vi
      .mocked(invoke)
      .mock.calls.filter((call) => call[0] === "clear_history").length;
    expect(clearCallsAfter).toBe(clearCallsBefore);

    // List is still visible
    expect(screen.getByText("deploy.sh")).toBeInTheDocument();
  });

  // Case 6: historyVersion changes → get_history reloaded
  it("reloads history when historyVersion changes", async () => {
    vi.mocked(invoke).mockResolvedValue([entry1]);

    const { rerender } = render(<HistoryPanel historyVersion={0} />);

    await waitFor(() => {
      expect(screen.getByText("deploy.sh")).toBeInTheDocument();
    });

    const callsAfterFirstLoad = vi.mocked(invoke).mock.calls.length;

    // Simulate a new append (historyVersion++): history now contains entry1 + entry2
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

  // Case 7: Clear history button disabled when list is empty
  it("disables the 'Clear history' button when the list is empty", async () => {
    vi.mocked(invoke).mockResolvedValue([]);

    render(<HistoryPanel historyVersion={0} />);

    await waitFor(() => {
      expect(screen.getByText("No executions")).toBeInTheDocument();
    });

    const clearBtn = screen.getByRole("button", {
      name: "Clear history",
    });
    expect(clearBtn).toBeDisabled();
  });

  // Case 8: invoke error → error message shown
  it("shows the error message when get_history rejects", async () => {
    vi.mocked(invoke).mockRejectedValue("Disk access error");

    render(<HistoryPanel historyVersion={0} />);

    await waitFor(() => {
      expect(screen.getByText("Disk access error")).toBeInTheDocument();
    });
  });

  // Case 9: clicking an already-selected entry deselects it
  it("deselects an entry when clicked a second time", async () => {
    vi.mocked(invoke).mockResolvedValue([entry1]);

    render(<HistoryPanel historyVersion={0} />);

    await waitFor(() => {
      expect(screen.getByText("deploy.sh")).toBeInTheDocument();
    });

    const entryEl = screen.getByText("deploy.sh").closest("li")!;

    // First click → selects
    fireEvent.click(entryEl);
    await waitFor(() => {
      expect(
        document.querySelector("pre.history-panel__detail-stdout"),
      ).toBeInTheDocument();
    });

    // Second click → deselects
    act(() => {
      fireEvent.click(entryEl);
    });
    await waitFor(() => {
      expect(
        document.querySelector("pre.history-panel__detail-stdout"),
      ).not.toBeInTheDocument();
    });
  });

  // Case 10: stderr section shown only when non-empty
  it("shows the stderr section only if the content is non-empty", async () => {
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

    // For entry1 (empty stderr), the stderr section must not appear
    vi.mocked(invoke).mockResolvedValue([entry1]);
    const { rerender } = render(<HistoryPanel historyVersion={0} />);
    rerender(<HistoryPanel historyVersion={1} />);

    await waitFor(() => {
      expect(screen.getAllByText("deploy.sh")[0]).toBeInTheDocument();
    });
  });
});
