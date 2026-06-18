import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Sidebar from "./Sidebar";

describe("Sidebar", () => {
  // Case 1: HTML structure (aside.sidebar)
  it("renders an <aside> element with the sidebar class", () => {
    const { container } = render(<Sidebar>content</Sidebar>);
    const aside = container.querySelector("aside.sidebar");
    expect(aside).toBeInTheDocument();
  });

  // Case 2: children are rendered inside the sidebar
  it("renders its children inside the sidebar", () => {
    render(
      <Sidebar>
        <p>Test content</p>
        <button type="button">Action</button>
      </Sidebar>,
    );
    expect(screen.getByText("Test content")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
  });

  // Case 3: multiple children are all rendered
  it("renders multiple children without altering their structure", () => {
    render(
      <Sidebar>
        <span data-testid="child-1">First child</span>
        <span data-testid="child-2">Second child</span>
      </Sidebar>,
    );
    expect(screen.getByTestId("child-1")).toBeInTheDocument();
    expect(screen.getByTestId("child-2")).toBeInTheDocument();
  });

  // Case 4: snapshot (detects structural regressions)
  it("snapshot with a single child", () => {
    const { container } = render(
      <Sidebar>
        <p>Snapshot content</p>
      </Sidebar>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
