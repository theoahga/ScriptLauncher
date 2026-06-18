import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import FolderSelector from "./FolderSelector";

// Mock @tauri-apps/plugin-dialog
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

import { open } from "@tauri-apps/plugin-dialog";

describe("FolderSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the 'Select a folder' button on initial render", () => {
    render(<FolderSelector onFolderSelected={vi.fn()} />);

    const button = screen.getByRole("button", {
      name: "Select a folder",
    });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("type", "button");
  });

  it("does not show a path on initial render", () => {
    render(<FolderSelector onFolderSelected={vi.fn()} />);

    // No path paragraph should be present
    expect(screen.queryByRole("paragraph")).not.toBeInTheDocument();
  });

  it("opens the native dialog on button click", async () => {
    vi.mocked(open).mockResolvedValue(null);

    render(<FolderSelector onFolderSelected={vi.fn()} />);

    const button = screen.getByRole("button", {
      name: "Select a folder",
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(open).toHaveBeenCalledOnce();
      expect(open).toHaveBeenCalledWith({ directory: true });
    });
  });

  it("shows the path and calls onFolderSelected when a folder is selected", async () => {
    const mockPath = "/Users/test/scripts";
    vi.mocked(open).mockResolvedValue(mockPath);
    const onFolderSelected = vi.fn();

    render(<FolderSelector onFolderSelected={onFolderSelected} />);

    const button = screen.getByRole("button", {
      name: "Select a folder",
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(mockPath)).toBeInTheDocument();
    });

    expect(onFolderSelected).toHaveBeenCalledOnce();
    expect(onFolderSelected).toHaveBeenCalledWith(mockPath);
  });

  it("does not update state or call onFolderSelected when the user cancels (null)", async () => {
    vi.mocked(open).mockResolvedValue(null);
    const onFolderSelected = vi.fn();

    render(<FolderSelector onFolderSelected={onFolderSelected} />);

    const button = screen.getByRole("button", {
      name: "Select a folder",
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(open).toHaveBeenCalledOnce();
    });

    // No path shown, callback not called
    expect(screen.queryByRole("paragraph")).not.toBeInTheDocument();
    expect(onFolderSelected).not.toHaveBeenCalled();
  });

  it("handles a dialog error silently without showing an error or changing state", async () => {
    vi.mocked(open).mockRejectedValue(new Error("Permission denied"));
    const onFolderSelected = vi.fn();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<FolderSelector onFolderSelected={onFolderSelected} />);

    const button = screen.getByRole("button", {
      name: "Select a folder",
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to open dialog:",
        expect.any(Error),
      );
    });

    // No state change
    expect(screen.queryByRole("paragraph")).not.toBeInTheDocument();
    expect(onFolderSelected).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("updates the displayed path when a new folder is selected after the first", async () => {
    const firstPath = "/Users/test/folder1";
    const secondPath = "/Users/test/folder2";
    vi.mocked(open)
      .mockResolvedValueOnce(firstPath)
      .mockResolvedValueOnce(secondPath);

    const onFolderSelected = vi.fn();

    render(<FolderSelector onFolderSelected={onFolderSelected} />);

    const button = screen.getByRole("button", {
      name: "Select a folder",
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
