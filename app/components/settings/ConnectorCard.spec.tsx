import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConnectorCard } from './ConnectorCard';
import { connectorsStore, type ConnectorConfig, CONNECTORS } from '~/lib/stores/connectors';
import { validateConnector } from '~/lib/connectors';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  cubicBezier: () => (t: number) => t,
}));

// Mock easings
vi.mock('~/utils/easings', () => ({
  cubicEasingFn: (t: number) => t,
}));

// Mock react-toastify
vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock validators
vi.mock('~/lib/connectors', () => ({
  validateConnector: vi.fn(),
  hasValidator: vi.fn().mockReturnValue(true),
}));

// OAuth connector (GitHub)
const mockGithubConnector: ConnectorConfig = {
  id: 'github',
  name: 'GitHub',
  description: 'Gestion de code et repositories',
  category: 'personal',
  icon: 'github',
  docsUrl: 'https://docs.github.com',
  authMethod: 'oauth',
  fields: [
    { key: 'token', label: "Token d'accès personnel", type: 'password', placeholder: 'ghp_...', required: true },
  ],
};

// API key connector with multiple required fields (ElevenLabs)
const mockElevenLabsConnector: ConnectorConfig = {
  id: 'elevenlabs',
  name: 'ElevenLabs',
  description: 'Synthèse vocale IA',
  category: 'shared',
  icon: 'elevenlabs',
  fields: [
    { key: 'apiKey', label: 'Clé API', type: 'password', placeholder: 'sk_...', required: true },
    { key: 'voiceId', label: 'ID de voix', type: 'text', placeholder: 'voice_...', required: true },
  ],
};

// API key connector with single field (Stripe)
const mockStripeConnector: ConnectorConfig = {
  id: 'stripe',
  name: 'Stripe',
  description: 'Paiements et abonnements',
  category: 'shared',
  icon: 'stripe',
  docsUrl: 'https://stripe.com/docs',
  fields: [
    { key: 'publishableKey', label: 'Clé publique', type: 'text', placeholder: 'pk_test_...', required: true },
    { key: 'secretKey', label: 'Clé secrète', type: 'password', placeholder: 'sk_test_...', required: true },
  ],
};

describe('ConnectorCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // reset store to disconnected state
    const defaultState: Record<string, { isConnected: boolean; credentials: Record<string, string> }> = {};

    for (const connector of CONNECTORS) {
      defaultState[connector.id] = { isConnected: false, credentials: {} };
    }

    connectorsStore.set(defaultState as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('should render connector name and description', () => {
      render(<ConnectorCard connector={mockGithubConnector} />);

      expect(screen.getByText('GitHub')).toBeInTheDocument();
      expect(screen.getByText('Gestion de code et repositories')).toBeInTheDocument();
    });

    it('should show "Connecter" button for API key connector when disconnected', () => {
      render(<ConnectorCard connector={mockElevenLabsConnector} />);

      expect(screen.getByText('Connecter')).toBeInTheDocument();
    });

    it('should show "Se connecter" button for OAuth connector when disconnected', () => {
      render(<ConnectorCard connector={mockGithubConnector} />);

      expect(screen.getByText('Se connecter')).toBeInTheDocument();
    });

    it('should show OAuth badge for OAuth connector when disconnected', () => {
      render(<ConnectorCard connector={mockGithubConnector} />);

      expect(screen.getByText('OAuth')).toBeInTheDocument();
    });

    it('should NOT show OAuth badge for API key connector', () => {
      render(<ConnectorCard connector={mockElevenLabsConnector} />);

      expect(screen.queryByText('OAuth')).not.toBeInTheDocument();
    });

    it('should show "Déconnecter" button when connected', () => {
      // set connected state
      connectorsStore.set({
        ...connectorsStore.get(),
        github: { isConnected: true, credentials: { token: 'test' }, lastConnected: Date.now() },
      });

      render(<ConnectorCard connector={mockGithubConnector} />);

      expect(screen.getByText('Déconnecter')).toBeInTheDocument();
    });

    it('should show "Connecté" badge when connected', () => {
      connectorsStore.set({
        ...connectorsStore.get(),
        github: { isConnected: true, credentials: { token: 'test' }, lastConnected: Date.now() },
      });

      render(<ConnectorCard connector={mockGithubConnector} />);

      expect(screen.getByText('Connecté')).toBeInTheDocument();
    });

    it('should NOT show OAuth badge when connected', () => {
      connectorsStore.set({
        ...connectorsStore.get(),
        github: { isConnected: true, credentials: { token: 'test' }, lastConnected: Date.now() },
      });

      render(<ConnectorCard connector={mockGithubConnector} />);

      expect(screen.queryByText('OAuth')).not.toBeInTheDocument();
    });
  });

  describe('form interaction (API key connectors)', () => {
    it('should expand form when clicking Connecter button for API key connector', () => {
      render(<ConnectorCard connector={mockStripeConnector} />);

      const connectButton = screen.getByText('Connecter');
      fireEvent.click(connectButton);

      expect(screen.getByPlaceholderText('pk_test_...')).toBeInTheDocument();
    });

    it('should NOT expand form for OAuth connector - redirects instead', () => {
      render(<ConnectorCard connector={mockGithubConnector} />);

      const connectButton = screen.getByText('Se connecter');
      fireEvent.click(connectButton);

      // OAuth connectors redirect, so no form fields should appear
      expect(screen.queryByPlaceholderText('ghp_...')).not.toBeInTheDocument();
    });

    it('should show all required fields with asterisk', () => {
      render(<ConnectorCard connector={mockElevenLabsConnector} />);

      fireEvent.click(screen.getByText('Connecter'));

      // check for asterisks indicating required fields
      const labels = screen.getAllByText('*');

      expect(labels).toHaveLength(2); // apiKey and voiceId are both required
    });

    it('should close form when clicking Annuler', () => {
      render(<ConnectorCard connector={mockStripeConnector} />);

      fireEvent.click(screen.getByText('Connecter'));

      expect(screen.getByPlaceholderText('pk_test_...')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Annuler'));

      expect(screen.queryByPlaceholderText('pk_test_...')).not.toBeInTheDocument();
    });
  });

  describe('validation (API key connectors)', () => {
    it('should show validation error for missing required fields', async () => {
      vi.mocked(validateConnector).mockResolvedValue({ success: true });

      const { container } = render(<ConnectorCard connector={mockStripeConnector} />);

      fireEvent.click(screen.getByText('Connecter'));

      // submit with empty form - use form element
      const form = container.querySelector('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText(/Champs requis:/)).toBeInTheDocument();
      });
    });

    it('should show API validation error on failed validation', async () => {
      vi.mocked(validateConnector).mockResolvedValue({
        success: false,
        error: 'Clé API invalide',
      });

      render(<ConnectorCard connector={mockStripeConnector} />);

      fireEvent.click(screen.getByText('Connecter'));

      // fill the form
      const pubKeyInput = screen.getByPlaceholderText('pk_test_...');
      const secretKeyInput = screen.getByPlaceholderText('sk_test_...');
      fireEvent.change(pubKeyInput, { target: { value: 'pk_test_123' } });
      fireEvent.change(secretKeyInput, { target: { value: 'sk_test_invalid' } });

      // submit
      const submitButtons = screen.getAllByText('Connecter');
      const formSubmit = submitButtons[submitButtons.length - 1];
      fireEvent.click(formSubmit);

      await waitFor(() => {
        expect(screen.getByText('Clé API invalide')).toBeInTheDocument();
      });
    });

    it('should show loading state during validation', async () => {
      // make validation take time
      vi.mocked(validateConnector).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100)),
      );

      render(<ConnectorCard connector={mockStripeConnector} />);

      fireEvent.click(screen.getByText('Connecter'));

      const pubKeyInput = screen.getByPlaceholderText('pk_test_...');
      const secretKeyInput = screen.getByPlaceholderText('sk_test_...');
      fireEvent.change(pubKeyInput, { target: { value: 'pk_test_123' } });
      fireEvent.change(secretKeyInput, { target: { value: 'sk_test_456' } });

      const submitButtons = screen.getAllByText('Connecter');
      const formSubmit = submitButtons[submitButtons.length - 1];
      fireEvent.click(formSubmit);

      // should show validation text while loading
      await waitFor(() => {
        expect(screen.getByText('Validation...')).toBeInTheDocument();
      });
    });

    it('should close form and connect on successful validation', async () => {
      vi.mocked(validateConnector).mockResolvedValue({
        success: true,
        details: { id: 'acct_123' },
      });

      render(<ConnectorCard connector={mockStripeConnector} />);

      fireEvent.click(screen.getByText('Connecter'));

      const pubKeyInput = screen.getByPlaceholderText('pk_test_...');
      const secretKeyInput = screen.getByPlaceholderText('sk_test_...');
      fireEvent.change(pubKeyInput, { target: { value: 'pk_test_123' } });
      fireEvent.change(secretKeyInput, { target: { value: 'sk_test_456' } });

      const submitButtons = screen.getAllByText('Connecter');
      const formSubmit = submitButtons[submitButtons.length - 1];
      fireEvent.click(formSubmit);

      await waitFor(() => {
        // form should be closed after success
        expect(screen.queryByPlaceholderText('pk_test_...')).not.toBeInTheDocument();
      });
    });
  });

  describe('disconnect', () => {
    it('should disconnect when clicking Déconnecter', async () => {
      const { toast } = await import('react-toastify');

      connectorsStore.set({
        ...connectorsStore.get(),
        github: { isConnected: true, credentials: { token: 'test' }, lastConnected: Date.now() },
      });

      render(<ConnectorCard connector={mockGithubConnector} />);

      fireEvent.click(screen.getByText('Déconnecter'));

      // should show info toast
      expect(toast.info).toHaveBeenCalledWith('GitHub déconnecté');

      // connector should be disconnected
      expect(connectorsStore.get().github.isConnected).toBe(false);
    });
  });

  describe('documentation link', () => {
    it('should render documentation link when docsUrl is provided (API key connector)', () => {
      render(<ConnectorCard connector={mockStripeConnector} />);

      fireEvent.click(screen.getByText('Connecter'));

      const link = screen.getByText('Documentation →');

      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://stripe.com/docs');
      expect(link).toHaveAttribute('target', '_blank');
    });
  });

  describe('OAuth connector behavior', () => {
    it('should show toast when OAuth connector button is clicked', async () => {
      const { toast } = await import('react-toastify');

      render(<ConnectorCard connector={mockGithubConnector} />);

      fireEvent.click(screen.getByText('Se connecter'));

      expect(toast.info).toHaveBeenCalledWith('Redirection vers GitHub...');
    });

    it('should disconnect OAuth connector correctly', async () => {
      const { toast } = await import('react-toastify');

      connectorsStore.set({
        ...connectorsStore.get(),
        github: { isConnected: true, credentials: { accessToken: 'test' }, lastConnected: Date.now(), isOAuth: true },
      });

      render(<ConnectorCard connector={mockGithubConnector} />);

      fireEvent.click(screen.getByText('Déconnecter'));

      expect(toast.info).toHaveBeenCalledWith('GitHub déconnecté');
      expect(connectorsStore.get().github.isConnected).toBe(false);
    });
  });
});
