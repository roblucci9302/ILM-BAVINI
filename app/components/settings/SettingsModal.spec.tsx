import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsModal } from './SettingsModal';
import { settingsModalOpen, activeSettingsTab } from '~/lib/stores/connectors';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  cubicBezier: () => (t: number) => t,
}));

// Mock ConnectorsPanel to avoid deep rendering
vi.mock('./ConnectorsPanel', () => ({
  ConnectorsPanel: () => <div data-testid="connectors-panel">ConnectorsPanel</div>,
}));

// mock Radix Dialog
vi.mock('@radix-ui/react-dialog', () => ({
  Root: ({ children, open }: any) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  Portal: ({ children, forceMount: _forceMount }: any) => <div data-testid="dialog-portal">{children}</div>,
  Overlay: ({ children, asChild: _asChild }: any) => <div data-testid="dialog-overlay">{children}</div>,
  Content: ({ children, asChild: _asChild }: any) => <div data-testid="dialog-content">{children}</div>,
  Close: ({ children, asChild: _asChild, onClick }: any) => (
    <button data-testid="dialog-close" onClick={onClick}>
      {children}
    </button>
  ),
}));

// Mock IconButton
vi.mock('~/components/ui/IconButton', () => ({
  IconButton: ({ icon, ...props }: any) => (
    <button data-testid="icon-button" data-icon={icon} {...props}>
      close
    </button>
  ),
}));

describe('SettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsModalOpen.set(false);
    activeSettingsTab.set('connectors');
  });

  describe('visibility', () => {
    it('should not render when modal is closed', () => {
      settingsModalOpen.set(false);
      render(<SettingsModal />);

      expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
    });

    it('should render when modal is open', () => {
      settingsModalOpen.set(true);
      render(<SettingsModal />);

      expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
    });
  });

  describe('tabs', () => {
    beforeEach(() => {
      settingsModalOpen.set(true);
    });

    it('should render both tabs', () => {
      render(<SettingsModal />);

      expect(screen.getByText('Connecteurs')).toBeInTheDocument();
      expect(screen.getByText('Compte')).toBeInTheDocument();
    });

    it('should show ConnectorsPanel when connectors tab is active', () => {
      activeSettingsTab.set('connectors');
      render(<SettingsModal />);

      expect(screen.getByTestId('connectors-panel')).toBeInTheDocument();
    });

    it('should show AccountPanel when account tab is active', () => {
      activeSettingsTab.set('account');
      render(<SettingsModal />);

      expect(screen.getByText('Gérez les paramètres de votre compte')).toBeInTheDocument();
    });

    it('should switch tabs when clicking tab buttons', () => {
      activeSettingsTab.set('connectors');
      render(<SettingsModal />);

      // Initially shows connectors
      expect(screen.getByTestId('connectors-panel')).toBeInTheDocument();

      // Click account tab
      fireEvent.click(screen.getByText('Compte'));

      // Should update store
      expect(activeSettingsTab.get()).toBe('account');
    });
  });

  describe('closing', () => {
    it('should close when close button is clicked', () => {
      settingsModalOpen.set(true);
      render(<SettingsModal />);

      const closeButton = screen.getByTestId('dialog-close');
      fireEvent.click(closeButton);

      expect(settingsModalOpen.get()).toBe(false);
    });
  });

  describe('header', () => {
    it('should render Paramètres title', () => {
      settingsModalOpen.set(true);
      render(<SettingsModal />);

      expect(screen.getByText('Paramètres')).toBeInTheDocument();
    });
  });
});
