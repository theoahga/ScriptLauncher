import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock @tauri-apps/plugin-dialog (utilisé par CategoryManager)
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

// Mock @tauri-apps/api/core (utilisé par CategoryManager et ScriptExecutor)
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({ categories: [] }),
}));

describe('App', () => {
  // Cas 1 : structure deux colonnes — app-shell présent
  it('rend la structure two-panel avec la classe app-shell', () => {
    const { container } = render(<App />);
    const shell = container.querySelector('.app-shell');
    expect(shell).toBeInTheDocument();
  });

  // Cas 2 : sidebar visible avec CategoryManager (S-09 remplace FolderSelector)
  it('rend la sidebar avec le CategoryManager', () => {
    const { container } = render(<App />);
    const sidebar = container.querySelector('aside.sidebar');
    expect(sidebar).toBeInTheDocument();
    const categoryManager = sidebar?.querySelector('.category-manager');
    expect(categoryManager).toBeInTheDocument();
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

  // Cas 4 : CategoryManager chargé dans la sidebar (S-09 — remplace ScriptList direct)
  it('rend CategoryManager dans la sidebar (S-09)', async () => {
    const { container } = render(<App />);
    const sidebar = container.querySelector('aside.sidebar');
    expect(sidebar).toBeInTheDocument();
    // Titre "Catégories" affiché par CategoryManager
    const { waitFor } = await import('@testing-library/react');
    await waitFor(() => {
      const title = screen.queryByText('Chargement...') || container.querySelector('.category-manager');
      expect(title).toBeInTheDocument();
    });
  });

  // Cas 5 : snapshot du rendu initial (structure two-panel)
  it('snapshot du rendu initial two-panel', () => {
    const { container } = render(<App />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
