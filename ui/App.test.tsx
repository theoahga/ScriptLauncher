import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock @tauri-apps/plugin-dialog (used by CategoryManager)
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

// Mock @tauri-apps/api/core (used by CategoryManager and ScriptExecutor)
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({ categories: [] }),
}));

describe('App', () => {
  // Case 1: two-column layout — app-shell present
  it('renders the two-panel layout with app-shell class', () => {
    const { container } = render(<App />);
    const shell = container.querySelector('.app-shell');
    expect(shell).toBeInTheDocument();
  });

  // Case 2: sidebar visible with CategoryManager
  it('renders the sidebar with CategoryManager', () => {
    const { container } = render(<App />);
    const sidebar = container.querySelector('aside.sidebar');
    expect(sidebar).toBeInTheDocument();
    const categoryManager = sidebar?.querySelector('.category-manager');
    expect(categoryManager).toBeInTheDocument();
  });

  // Case 3: main panel shows empty message when no tab is open
  it('renders the main panel with empty message when no tab is open', () => {
    render(<App />);
    const emptyMsg = screen.getByText('Select a script from the sidebar');
    expect(emptyMsg).toBeInTheDocument();
    const mainPanel = emptyMsg.closest('main.main-panel');
    expect(mainPanel).toBeInTheDocument();
  });

  // Case 4: CategoryManager loaded in sidebar
  it('renders CategoryManager in the sidebar', async () => {
    const { container } = render(<App />);
    const sidebar = container.querySelector('aside.sidebar');
    expect(sidebar).toBeInTheDocument();
    const { waitFor } = await import('@testing-library/react');
    await waitFor(() => {
      const title = screen.queryByText('Loading...') || container.querySelector('.category-manager');
      expect(title).toBeInTheDocument();
    });
  });

  // Case 5: snapshot of initial two-panel render
  it('snapshot of initial two-panel render', () => {
    const { container } = render(<App />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
