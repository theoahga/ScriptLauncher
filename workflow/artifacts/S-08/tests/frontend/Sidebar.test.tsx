import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Sidebar from "./Sidebar";

describe("Sidebar", () => {
  // Cas 1 : rendu de la structure HTML (aside.sidebar)
  it("rend un élément <aside> avec la classe sidebar", () => {
    const { container } = render(<Sidebar>contenu</Sidebar>);
    const aside = container.querySelector("aside.sidebar");
    expect(aside).toBeInTheDocument();
  });

  // Cas 2 : les enfants sont rendus dans la sidebar
  it("affiche ses children dans la sidebar", () => {
    render(
      <Sidebar>
        <p>Contenu de test</p>
        <button type="button">Action</button>
      </Sidebar>,
    );
    expect(screen.getByText("Contenu de test")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
  });

  // Cas 3 : plusieurs enfants sont tous rendus
  it("affiche plusieurs enfants sans altérer leur structure", () => {
    render(
      <Sidebar>
        <span data-testid="child-1">Premier enfant</span>
        <span data-testid="child-2">Deuxième enfant</span>
      </Sidebar>,
    );
    expect(screen.getByTestId("child-1")).toBeInTheDocument();
    expect(screen.getByTestId("child-2")).toBeInTheDocument();
  });

  // Cas 4 : snapshot du rendu (détecte les régressions de structure)
  it("snapshot du rendu avec un enfant", () => {
    const { container } = render(
      <Sidebar>
        <p>Snapshot content</p>
      </Sidebar>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
