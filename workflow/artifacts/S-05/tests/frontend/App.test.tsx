import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../ui/App";

// Mock @tauri-apps/plugin-dialog (utilisé par FolderSelector)
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

describe("App", () => {
  it("rend le composant FolderSelector avec le bouton de sélection", () => {
    render(<App />);
    const button = screen.getByRole("button", {
      name: "Sélectionner un dossier",
    });
    expect(button).toBeInTheDocument();
  });

  it("snapshot du rendu initial", () => {
    const { container } = render(<App />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
