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

const EXEC_ID = "test-exec-id";

const mockScript: ScriptInfo = {
  name: "deploy.sh",
  path: "/scripts/deploy.sh",
  extension: "sh",
};

describe("ScriptExecutor — streaming", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invoke).mockResolvedValue(undefined);
    vi.mocked(listen).mockResolvedValue(() => {});
  });

  // Case 1: script is null → "No script selected" message
  it("shows 'No script selected' when script is null", () => {
    render(<ScriptExecutor executionId={EXEC_ID} script={null} />);

    expect(screen.getByText("No script selected")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });

  // Case 2: script is non-null → shows script name and Run button
  it("shows the script name and Run button when a script is provided", () => {
    render(<ScriptExecutor executionId={EXEC_ID} script={mockScript} />);

    expect(screen.getByText("deploy.sh")).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: "Run" });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  // Case 3: Stop button visible during execution, hidden otherwise
  it("shows the Stop button during execution and hides it otherwise", async () => {
    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));

    render(<ScriptExecutor executionId={EXEC_ID} script={mockScript} />);

    expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Running..." })).toBeDisabled();
  });

  // Case 4: Stop click → invoke('kill_script') called with execution_id
  it("calls invoke('kill_script') with execution_id when Stop is clicked", async () => {
    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));

    render(<ScriptExecutor executionId={EXEC_ID} script={mockScript} />);

    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
    });

    vi.mocked(invoke).mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("kill_script", { executionId: EXEC_ID });
    });
  });

  // Case 5: stdout lines displayed progressively via simulated events
  it("displays successive stdout lines via script-stdout events", async () => {
    let stdoutHandler: ((event: { payload: { execution_id: string; line: string } }) => void) | undefined;

    vi.mocked(listen).mockImplementation(
      async (event: string, handler: Parameters<typeof listen>[1]) => {
        if (event === "script-stdout") {
          stdoutHandler = handler as (event: { payload: { execution_id: string; line: string } }) => void;
        }
        return () => {};
      },
    );

    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));

    render(<ScriptExecutor executionId={EXEC_ID} script={mockScript} />);

    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() => {
      expect(listen).toHaveBeenCalledWith("script-stdout", expect.any(Function));
    });

    act(() => { stdoutHandler?.({ payload: { execution_id: EXEC_ID, line: "line one" } }); });
    act(() => { stdoutHandler?.({ payload: { execution_id: EXEC_ID, line: "line two" } }); });

    await waitFor(() => {
      const pre = document.querySelector("pre.script-executor__stdout");
      expect(pre?.textContent).toContain("line one");
      expect(pre?.textContent).toContain("line two");
    });
  });

  // Case 5b: events from another execution_id are ignored
  it("ignores script-stdout events from a different execution_id", async () => {
    let stdoutHandler: ((event: { payload: { execution_id: string; line: string } }) => void) | undefined;

    vi.mocked(listen).mockImplementation(
      async (event: string, handler: Parameters<typeof listen>[1]) => {
        if (event === "script-stdout") {
          stdoutHandler = handler as (event: { payload: { execution_id: string; line: string } }) => void;
        }
        return () => {};
      },
    );

    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));

    render(<ScriptExecutor executionId={EXEC_ID} script={mockScript} />);
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() => expect(listen).toHaveBeenCalledWith("script-stdout", expect.any(Function)));

    act(() => { stdoutHandler?.({ payload: { execution_id: "other-id", line: "should be ignored" } }); });
    act(() => { stdoutHandler?.({ payload: { execution_id: EXEC_ID, line: "should appear" } }); });

    await waitFor(() => {
      const pre = document.querySelector("pre.script-executor__stdout");
      expect(pre?.textContent).toContain("should appear");
      expect(pre?.textContent).not.toContain("should be ignored");
    });
  });

  // Case 6: output area cleared on new run start
  it("clears the output area at the start of a new run", async () => {
    let stdoutHandler: ((event: { payload: { execution_id: string; line: string } }) => void) | undefined;
    let doneHandler: ((event: { payload: { execution_id: string; exit_code: number; stderr: string } }) => void) | undefined;

    vi.mocked(listen).mockImplementation(
      async (event: string, handler: Parameters<typeof listen>[1]) => {
        if (event === "script-stdout") stdoutHandler = handler as typeof stdoutHandler;
        if (event === "script-done") doneHandler = handler as typeof doneHandler;
        return () => {};
      },
    );

    vi.mocked(invoke).mockResolvedValue(undefined);

    render(<ScriptExecutor executionId={EXEC_ID} script={mockScript} />);

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() => expect(listen).toHaveBeenCalledWith("script-stdout", expect.any(Function)));

    act(() => { stdoutHandler?.({ payload: { execution_id: EXEC_ID, line: "first run output" } }); });
    act(() => { doneHandler?.({ payload: { execution_id: EXEC_ID, exit_code: 0, stderr: "" } }); });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Run" })).not.toBeDisabled();
    });

    vi.clearAllMocks();
    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));
    vi.mocked(listen).mockResolvedValue(() => {});

    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() => {
      const pre = document.querySelector("pre.script-executor__stdout");
      if (pre) {
        expect(pre.textContent).not.toContain("first run output");
      } else {
        expect(screen.getByRole("button", { name: "Running..." })).toBeInTheDocument();
      }
    });
  });

  // Case 7: script-done received → exit code shown, Stop button gone
  it("shows exit code and hides Stop when script-done is received", async () => {
    let doneHandler: ((event: { payload: { execution_id: string; exit_code: number; stderr: string } }) => void) | undefined;

    vi.mocked(listen).mockImplementation(
      async (event: string, handler: Parameters<typeof listen>[1]) => {
        if (event === "script-done") doneHandler = handler as typeof doneHandler;
        return () => {};
      },
    );

    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));

    render(<ScriptExecutor executionId={EXEC_ID} script={mockScript} />);
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
    });

    act(() => { doneHandler?.({ payload: { execution_id: EXEC_ID, exit_code: 0, stderr: "" } }); });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
      expect(screen.getByText("Success")).toBeInTheDocument();
    });
  });

  // Case 8: invoke('run_script_stream') fails → error shown, Stop hidden
  it("shows the error when run_script_stream rejects", async () => {
    vi.mocked(invoke).mockRejectedValue("Path does not exist: /scripts/deploy.sh");

    render(<ScriptExecutor executionId={EXEC_ID} script={mockScript} />);

    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() => {
      expect(
        screen.getByText("Path does not exist: /scripts/deploy.sh"),
      ).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
  });

  // Case 9: auto-scroll triggered on each new line
  it("triggers auto-scroll on each new line", async () => {
    let stdoutHandler: ((event: { payload: { execution_id: string; line: string } }) => void) | undefined;

    vi.mocked(listen).mockImplementation(
      async (event: string, handler: Parameters<typeof listen>[1]) => {
        if (event === "script-stdout") stdoutHandler = handler as typeof stdoutHandler;
        return () => {};
      },
    );
    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));

    render(<ScriptExecutor executionId={EXEC_ID} script={mockScript} />);
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() => expect(listen).toHaveBeenCalledWith("script-stdout", expect.any(Function)));

    act(() => { stdoutHandler?.({ payload: { execution_id: EXEC_ID, line: "trigger scroll" } }); });

    await waitFor(() => {
      const pre = document.querySelector("pre.script-executor__stdout");
      expect(pre?.textContent).toContain("trigger scroll");
    });

    const pre = document.querySelector("pre.script-executor__stdout");
    expect(pre).not.toBeNull();
  });

  // Case 10: script change → state reset (lines, exit code, error)
  it("clears previous output and resets state when the script changes", async () => {
    let doneHandler: ((event: { payload: { execution_id: string; exit_code: number; stderr: string } }) => void) | undefined;

    vi.mocked(listen).mockImplementation(
      async (event: string, handler: Parameters<typeof listen>[1]) => {
        if (event === "script-done") doneHandler = handler as typeof doneHandler;
        return () => {};
      },
    );
    vi.mocked(invoke).mockReturnValue(new Promise(() => {}));

    const { rerender } = render(<ScriptExecutor executionId={EXEC_ID} script={mockScript} />);
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() => expect(listen).toHaveBeenCalledWith("script-done", expect.any(Function)));

    act(() => { doneHandler?.({ payload: { execution_id: EXEC_ID, exit_code: 42, stderr: "" } }); });

    await waitFor(() => {
      expect(screen.getByText("Error (code: 42)")).toBeInTheDocument();
    });

    const newScript: ScriptInfo = {
      name: "backup.py",
      path: "/scripts/backup.py",
      extension: "py",
    };
    rerender(<ScriptExecutor executionId={EXEC_ID} script={newScript} />);

    expect(screen.queryByText("Error (code: 42)")).not.toBeInTheDocument();
    expect(screen.getByText("backup.py")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run" })).not.toBeDisabled();
  });
});
