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

  // Case 1: folderPath is null
  it("shows 'No folder selected' when folderPath is null", () => {
    render(<ScriptList folderPath={null} onScriptSelected={vi.fn()} />);

    expect(
      screen.getByText("No folder selected"),
    ).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });

  // Case 2: loading state
  it("shows 'Loading...' while invoke is pending", async () => {
    // invoke never resolves → stays in loading state
    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));

    render(<ScriptList folderPath="/scripts" onScriptSelected={vi.fn()} />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  // Case 3: empty list
  it("shows 'No scripts found' when invoke returns an empty array", async () => {
    vi.mocked(invoke).mockResolvedValue([]);

    render(<ScriptList folderPath="/scripts" onScriptSelected={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByText("No scripts found in this folder"),
      ).toBeInTheDocument();
    });
  });

  // Case 4: list with items
  it("displays scripts returned by invoke", async () => {
    vi.mocked(invoke).mockResolvedValue(mockScripts);

    render(<ScriptList folderPath="/scripts" onScriptSelected={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("deploy.sh")).toBeInTheDocument();
      expect(screen.getByText("backup.py")).toBeInTheDocument();
      expect(screen.getByText("build.js")).toBeInTheDocument();
    });

    // Extensions shown separately with a dot prefix
    expect(screen.getByText(".sh")).toBeInTheDocument();
    expect(screen.getByText(".py")).toBeInTheDocument();
    expect(screen.getByText(".js")).toBeInTheDocument();
  });

  // Case 5: Rust error
  it("shows the error message returned by Rust when invoke rejects", async () => {
    vi.mocked(invoke).mockRejectedValue("Folder not found: /scripts");

    render(<ScriptList folderPath="/scripts" onScriptSelected={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByText("Folder not found: /scripts"),
      ).toBeInTheDocument();
    });
  });

  // Case 6: invoke called with correct parameters
  it("calls invoke with 'list_scripts' and the correct folderPath", async () => {
    vi.mocked(invoke).mockResolvedValue([]);

    render(<ScriptList folderPath="/my/folder" onScriptSelected={vi.fn()} />);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("list_scripts", {
        folder: "/my/folder",
      });
    });
  });

  // Case 7: onScriptSelected called on click
  it("calls onScriptSelected with the correct script on click", async () => {
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

  // Case 8: folderPath change triggers a new invoke
  it("re-runs invoke when folderPath changes", async () => {
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

  // Case 9: folderPath changes from null to a value → triggers invoke
  it("triggers invoke when folderPath changes from null to a value", async () => {
    vi.mocked(invoke).mockResolvedValue(mockScripts);

    const { rerender } = render(
      <ScriptList folderPath={null} onScriptSelected={vi.fn()} />,
    );

    expect(invoke).not.toHaveBeenCalled();
    expect(screen.getByText("No folder selected")).toBeInTheDocument();

    rerender(<ScriptList folderPath="/scripts" onScriptSelected={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("deploy.sh")).toBeInTheDocument();
    });

    expect(invoke).toHaveBeenCalledOnce();
  });

  // Case 10: script without extension — no extension span rendered
  it("does not render the extension span when extension is empty", async () => {
    const scriptWithoutExt: ScriptInfo[] = [
      { name: "Makefile", path: "/scripts/Makefile", extension: "" },
    ];
    vi.mocked(invoke).mockResolvedValue(scriptWithoutExt);

    render(<ScriptList folderPath="/scripts" onScriptSelected={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Makefile")).toBeInTheDocument();
    });

    // The extension span with "." must not be present
    expect(screen.queryByText(/^\./)).not.toBeInTheDocument();
  });
});
