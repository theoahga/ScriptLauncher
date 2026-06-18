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

// Mock ScriptList to isolate CategoryManager
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
    { id: "cat-1", name: "System", path: "/scripts/system" },
    { id: "cat-2", name: "Network", path: "/scripts/network" },
  ],
};

describe("CategoryManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Case 1: empty config → "No categories" shown
  it("shows 'No categories' when get_config returns an empty config", async () => {
    vi.mocked(invoke).mockResolvedValue(emptyConfig);

    render(<CategoryManager onScriptSelected={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("No categories")).toBeInTheDocument();
    });
    expect(invoke).toHaveBeenCalledWith("get_config");
  });

  // Case 2: categories shown with a ScriptList per category
  it("shows categories with a ScriptList for each", async () => {
    vi.mocked(invoke).mockResolvedValue(configWithCategories);

    render(<CategoryManager onScriptSelected={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("System")).toBeInTheDocument();
      expect(screen.getByText("Network")).toBeInTheDocument();
    });

    // Both ScriptLists are rendered (categories expanded by default)
    expect(screen.getByTestId("scriptlist-/scripts/system")).toBeInTheDocument();
    expect(screen.getByTestId("scriptlist-/scripts/network")).toBeInTheDocument();
  });

  // Case 3: collapse/expand a category
  it("collapses and expands a category on header click", async () => {
    vi.mocked(invoke).mockResolvedValue(configWithCategories);

    render(<CategoryManager onScriptSelected={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("System")).toBeInTheDocument();
    });

    // Initially expanded: ScriptList visible
    expect(screen.getByTestId("scriptlist-/scripts/system")).toBeInTheDocument();

    // Click the "System" header to collapse
    // Use getAllByRole + filter to avoid collision with the delete button
    // Header has aria-label "Category System", delete has "Delete category System"
    const headers = screen.getAllByRole("button", {
      name: /Category System/i,
    });
    // Pick the one with aria-label exactly "Category System"
    const systemHeader = headers.find(
      (el) => el.getAttribute("aria-label") === "Category System"
    )!;
    fireEvent.click(systemHeader);

    // After collapse: System ScriptList is no longer visible
    expect(
      screen.queryByTestId("scriptlist-/scripts/system")
    ).not.toBeInTheDocument();

    // "Network" remains expanded
    expect(screen.getByTestId("scriptlist-/scripts/network")).toBeInTheDocument();

    // Re-click to expand again
    fireEvent.click(systemHeader);
    await waitFor(() => {
      expect(
        screen.getByTestId("scriptlist-/scripts/system")
      ).toBeInTheDocument();
    });
  });

  // Case 4: add a category → save_config called
  it("calls save_config with the new category on add", async () => {
    vi.mocked(invoke).mockResolvedValue(emptyConfig);
    vi.mocked(open).mockResolvedValue("/scripts/new-folder");

    render(<CategoryManager onScriptSelected={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("No categories")).toBeInTheDocument();
    });

    // Click "+"
    const addBtn = screen.getByRole("button", {
      name: /Add a category/i,
    });
    fireEvent.click(addBtn);

    // Inline form visible, enter a name
    const input = screen.getByPlaceholderText("Category name");
    fireEvent.change(input, { target: { value: "Backup" } });

    // Click "Choose folder" — triggers open() then invoke save_config
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "save_config") return Promise.resolve(undefined);
      return Promise.resolve(emptyConfig);
    });

    const confirmBtn = screen.getByRole("button", { name: /Choose folder/i });
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

  // Case 5: delete a category → save_config called
  it("calls save_config without the deleted category on delete", async () => {
    vi.mocked(invoke).mockResolvedValue(configWithCategories);

    render(<CategoryManager onScriptSelected={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("System")).toBeInTheDocument();
    });

    vi.mocked(invoke).mockResolvedValue(undefined);

    // Click the delete button for "System"
    const deleteBtn = screen.getByRole("button", {
      name: /Delete category System/i,
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

  // Case 6: script selection → callback passed to ScriptLists
  it("passes onScriptSelected to the ScriptLists of each category", async () => {
    vi.mocked(invoke).mockResolvedValue(configWithCategories);

    const onScriptSelected = vi.fn();
    render(<CategoryManager onScriptSelected={onScriptSelected} />);

    await waitFor(() => {
      // Verify ScriptLists are rendered with the correct folderPath
      expect(
        screen.getByTestId("scriptlist-/scripts/system")
      ).toBeInTheDocument();
    });

    expect(onScriptSelected).not.toHaveBeenCalled();
  });

  // Case 7: loading state
  it("shows 'Loading...' during initial load", () => {
    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));

    render(<CategoryManager onScriptSelected={vi.fn()} />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  // Case 8: cancel add form
  it("hides the form when the user cancels adding", async () => {
    vi.mocked(invoke).mockResolvedValue(emptyConfig);

    render(<CategoryManager onScriptSelected={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("No categories")).toBeInTheDocument();
    });

    // Open the form
    fireEvent.click(
      screen.getByRole("button", { name: /Add a category/i })
    );
    expect(
      screen.getByPlaceholderText("Category name")
    ).toBeInTheDocument();

    // Cancel
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(
      screen.queryByPlaceholderText("Category name")
    ).not.toBeInTheDocument();
  });
});
