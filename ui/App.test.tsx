import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock @tauri-apps/plugin-dialog (utilisé par FolderSelector)
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

// Mock @tauri-apps/api/core (utilisé par ScriptList et ScriptExecutor)
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('App', () => {
  // Cas 1 : structure deux colonnes — app-shell présent
  it('rend la structure two-panel avec la classe app-shell', () => {
    const { container } = render(<App />);
    const shell = container.querySelector('.app-shell');
    expect(shell).toBeInTheDocument();
  });

  // Cas 2 : sidebar visible avec le bouton FolderSelector
  it('rend la sidebar avec le bouton de sélection de dossier', () => {
    render(<App />);
    const button = screen.getByRole('button', { name: 'Sélectionner un dossier' });
    expect(button).toBeInTheDocument();
    // Le bouton est bien dans l'aside.sidebar
    const sidebar = button.closest('aside.sidebar');
    expect(sidebar).toBeInTheDocument();
  });

  // Cas 3 : panel droit visible avec ScriptExecutor
  it('rend le panel droit avec le message Aucun script sélectionné', () => {
    render(<App />);
    const emptyMsg = screen.getByText('Aucun script sélectionné');
    expect(emptyMsg).toBeInTheDocument();
    // Le message est bien dans le main.main-panel
    const mainPanel = emptyMsg.closest('main.main-panel');
    expect(mainPanel).toBeInTheDocument();
  });

  // Cas 4 : ScriptList visible dans la sidebar
  it('rend ScriptList dans la sidebar', () => {
    render(<App />);
    const emptyFolderMsg = screen.getByText('Aucun dossier sélectionné');
    expect(emptyFolderMsg).toBeInTheDocument();
    const sidebar = emptyFolderMsg.closest('aside.sidebar');
    expect(sidebar).toBeInTheDocument();
  });

  // Cas 5 : snapshot du rendu initial (structure two-panel)
  it('snapshot du rendu initial two-panel', () => {
    const { container } = render(<App />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
