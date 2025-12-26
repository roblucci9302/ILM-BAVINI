import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConnectorsPanel } from './ConnectorsPanel';
import { connectorsStore, CONNECTORS } from '~/lib/stores/connectors';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  cubicBezier: () => (t: number) => t,
}));

// Mock easings
vi.mock('~/utils/easings', () => ({
  cubicEasingFn: (t: number) => t,
}));

// Mock ConnectorCard to simplify testing
vi.mock('./ConnectorCard', () => ({
  ConnectorCard: ({ connector }: any) => <div data-testid={`connector-card-${connector.id}`}>{connector.name}</div>,
}));

describe('ConnectorsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset store to disconnected state
    const defaultState: Record<string, { isConnected: boolean; credentials: Record<string, string> }> = {};

    for (const connector of CONNECTORS) {
      defaultState[connector.id] = { isConnected: false, credentials: {} };
    }

    connectorsStore.set(defaultState as any);
  });

  describe('rendering', () => {
    it('should render the main title', () => {
      render(<ConnectorsPanel />);

      expect(screen.getByText('Connecteurs')).toBeInTheDocument();
    });

    it('should render shared connectors section', () => {
      render(<ConnectorsPanel />);

      expect(screen.getByText('Connecteurs partagés')).toBeInTheDocument();
      expect(screen.getByText("Services accessibles par tous les membres de l'équipe")).toBeInTheDocument();
    });

    it('should render personal connectors section', () => {
      render(<ConnectorsPanel />);

      expect(screen.getByText('Connecteurs personnels')).toBeInTheDocument();
      expect(screen.getByText('Services liés à votre compte personnel')).toBeInTheDocument();
    });

    it('should render all connector cards', () => {
      render(<ConnectorsPanel />);

      for (const connector of CONNECTORS) {
        expect(screen.getByTestId(`connector-card-${connector.id}`)).toBeInTheDocument();
      }
    });
  });

  describe('category filtering', () => {
    it('should separate shared and personal connectors', () => {
      render(<ConnectorsPanel />);

      const sharedConnectors = CONNECTORS.filter((c) => c.category === 'shared');
      const personalConnectors = CONNECTORS.filter((c) => c.category === 'personal');

      // Verify shared connectors exist
      for (const connector of sharedConnectors) {
        expect(screen.getByTestId(`connector-card-${connector.id}`)).toBeInTheDocument();
      }

      // Verify personal connectors exist
      for (const connector of personalConnectors) {
        expect(screen.getByTestId(`connector-card-${connector.id}`)).toBeInTheDocument();
      }
    });
  });

  describe('connected count', () => {
    it('should show 0/total when no connectors are connected', () => {
      render(<ConnectorsPanel />);

      expect(screen.getByText(`0/${CONNECTORS.length} actifs`)).toBeInTheDocument();
    });

    it('should update count when connectors are connected', () => {
      const sharedConnectors = CONNECTORS.filter((c) => c.category === 'shared');
      const personalConnectors = CONNECTORS.filter((c) => c.category === 'personal');

      // Connect 2 shared and 1 personal
      connectorsStore.set({
        ...connectorsStore.get(),
        supabase: { isConnected: true, credentials: { url: 'test', anonKey: 'test' }, lastConnected: Date.now() },
        stripe: { isConnected: true, credentials: { secretKey: 'sk_test' }, lastConnected: Date.now() },
        github: { isConnected: true, credentials: { token: 'ghp_test' }, lastConnected: Date.now() },
      });

      render(<ConnectorsPanel />);

      // Total count
      expect(screen.getByText(`3/${CONNECTORS.length} actifs`)).toBeInTheDocument();

      // Category counts
      expect(screen.getByText(`2/${sharedConnectors.length}`)).toBeInTheDocument();
      expect(screen.getByText(`1/${personalConnectors.length}`)).toBeInTheDocument();
    });

    it('should show correct count for only shared connectors connected', () => {
      const sharedConnectors = CONNECTORS.filter((c) => c.category === 'shared');
      const personalConnectors = CONNECTORS.filter((c) => c.category === 'personal');

      connectorsStore.set({
        ...connectorsStore.get(),
        supabase: { isConnected: true, credentials: { url: 'test', anonKey: 'test' }, lastConnected: Date.now() },
      });

      render(<ConnectorsPanel />);

      expect(screen.getByText(`1/${CONNECTORS.length} actifs`)).toBeInTheDocument();
      expect(screen.getByText(`1/${sharedConnectors.length}`)).toBeInTheDocument();
      expect(screen.getByText(`0/${personalConnectors.length}`)).toBeInTheDocument();
    });
  });

  describe('description', () => {
    it('should render the description text', () => {
      render(<ConnectorsPanel />);

      expect(screen.getByText('Connectez vos services tiers pour étendre les capacités de BAVINI')).toBeInTheDocument();
    });
  });
});
