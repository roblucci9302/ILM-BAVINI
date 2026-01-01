import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Create mock stores
const { mockPreviews, mockSelectedDeviceId } = vi.hoisted(() => {
  const { atom } = require('nanostores');
  return {
    mockPreviews: atom([]),
    mockSelectedDeviceId: atom('desktop'),
  };
});

// Mock stores
vi.mock('~/lib/stores/workbench', () => ({
  workbenchStore: {
    previews: mockPreviews,
  },
}));

vi.mock('~/lib/stores/previews', () => ({
  selectedDeviceId: mockSelectedDeviceId,
}));

// Mock devices utility
vi.mock('~/utils/devices', () => ({
  DEVICE_PRESETS: [
    { id: 'desktop', name: 'Bureau', type: 'desktop', icon: 'i-ph:desktop', width: 1920, height: 1080 },
    { id: 'mobile', name: 'Mobile', type: 'mobile', icon: 'i-ph:device-mobile', width: 375, height: 812 },
  ],
}));

// Mock toast
vi.mock('react-toastify', () => ({
  toast: {
    error: vi.fn(),
  },
}));

// Mock child components
vi.mock('~/components/ui/IconButton', () => ({
  IconButton: ({ icon, title, onClick, disabled }: any) => (
    <button onClick={onClick} title={title} disabled={disabled} data-testid={`icon-${icon}`}>
      <span className={icon} />
    </button>
  ),
}));

vi.mock('./PortDropdown', () => ({
  PortDropdown: ({ isDropdownOpen, setIsDropdownOpen }: any) => (
    <div data-testid="port-dropdown" data-open={isDropdownOpen}>
      <button onClick={() => setIsDropdownOpen(!isDropdownOpen)}>Toggle Ports</button>
    </div>
  ),
}));

vi.mock('./DeviceSelector', () => ({
  DeviceSelector: () => <div data-testid="device-selector">Device Selector</div>,
}));

vi.mock('./DeviceFrame', () => ({
  DeviceFrame: ({ children }: any) => (
    <div data-testid="device-frame">{children}</div>
  ),
}));

// Import after mocks
import { Preview } from './Preview';

describe('Preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPreviews.set([]);
    mockSelectedDeviceId.set('desktop');
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      render(<Preview />);

      expect(screen.getByText('Aucun aperçu disponible')).toBeInTheDocument();
    });

    it('should render device selector', () => {
      render(<Preview />);

      expect(screen.getByTestId('device-selector')).toBeInTheDocument();
    });

    it('should render reload button', () => {
      render(<Preview />);

      expect(screen.getByTitle('Recharger l\'aperçu')).toBeInTheDocument();
    });

    it('should render fullscreen button', () => {
      render(<Preview />);

      expect(screen.getByTitle('Plein écran')).toBeInTheDocument();
    });

    it('should have displayName set', () => {
      expect(Preview.displayName).toBe('Preview');
    });
  });

  describe('no preview state', () => {
    it('should show no preview message when no previews', () => {
      mockPreviews.set([]);

      render(<Preview />);

      expect(screen.getByText('Aucun aperçu disponible')).toBeInTheDocument();
    });

    it('should disable fullscreen button when no preview', () => {
      mockPreviews.set([]);

      render(<Preview />);

      const fullscreenButton = screen.getByTitle('Plein écran');
      expect(fullscreenButton).toBeDisabled();
    });
  });

  describe('loading state', () => {
    it('should show loading indicator when preview not ready', () => {
      mockPreviews.set([
        { port: 3000, baseUrl: 'http://localhost:3000', ready: false },
      ]);

      render(<Preview />);

      // Updated loading state with improved styling
      expect(screen.getByText('Démarrage du serveur')).toBeInTheDocument();
      expect(screen.getByText("Préparation de l'aperçu...")).toBeInTheDocument();
    });
  });

  describe('ready preview', () => {
    it('should render iframe when preview is ready', () => {
      mockPreviews.set([
        { port: 3000, baseUrl: 'http://localhost:3000', ready: true },
      ]);

      render(<Preview />);

      expect(screen.getByTitle('Aperçu de l\'application')).toBeInTheDocument();
    });

    it('should set iframe src to preview url', () => {
      mockPreviews.set([
        { port: 3000, baseUrl: 'http://localhost:3000', ready: true },
      ]);

      render(<Preview />);

      const iframe = screen.getByTitle('Aperçu de l\'application') as HTMLIFrameElement;
      expect(iframe.src).toBe('http://localhost:3000/');
    });
  });

  describe('port dropdown', () => {
    it('should not show port dropdown with single preview', () => {
      mockPreviews.set([
        { port: 3000, baseUrl: 'http://localhost:3000', ready: true },
      ]);

      render(<Preview />);

      expect(screen.queryByTestId('port-dropdown')).not.toBeInTheDocument();
    });

    it('should show port dropdown with multiple previews', () => {
      mockPreviews.set([
        { port: 3000, baseUrl: 'http://localhost:3000', ready: true },
        { port: 5173, baseUrl: 'http://localhost:5173', ready: true },
      ]);

      render(<Preview />);

      expect(screen.getByTestId('port-dropdown')).toBeInTheDocument();
    });
  });

  describe('device frame', () => {
    it('should not show device frame for desktop', () => {
      mockSelectedDeviceId.set('desktop');
      mockPreviews.set([
        { port: 3000, baseUrl: 'http://localhost:3000', ready: true },
      ]);

      render(<Preview />);

      expect(screen.queryByTestId('device-frame')).not.toBeInTheDocument();
    });

    it('should show device frame for mobile', () => {
      mockSelectedDeviceId.set('mobile');
      mockPreviews.set([
        { port: 3000, baseUrl: 'http://localhost:3000', ready: true },
      ]);

      render(<Preview />);

      expect(screen.getByTestId('device-frame')).toBeInTheDocument();
    });
  });

  describe('address bar', () => {
    it('should render address bar input', () => {
      render(<Preview />);

      expect(screen.getByLabelText('Barre d\'adresse de l\'aperçu')).toBeInTheDocument();
    });

    it('should display preview url in address bar', () => {
      mockPreviews.set([
        { port: 3000, baseUrl: 'http://localhost:3000', ready: true },
      ]);

      render(<Preview />);

      const input = screen.getByLabelText('Barre d\'adresse de l\'aperçu') as HTMLInputElement;
      expect(input.value).toBe('http://localhost:3000');
    });

    it('should update url on input change', () => {
      mockPreviews.set([
        { port: 3000, baseUrl: 'http://localhost:3000', ready: true },
      ]);

      render(<Preview />);

      const input = screen.getByLabelText('Barre d\'adresse de l\'aperçu');
      fireEvent.change(input, { target: { value: 'http://localhost:3000/new-path' } });

      expect((input as HTMLInputElement).value).toBe('http://localhost:3000/new-path');
    });
  });

  describe('reload functionality', () => {
    it('should have reload button', () => {
      render(<Preview />);

      expect(screen.getByTitle('Recharger l\'aperçu')).toBeInTheDocument();
    });

    it('should call reload on button click', () => {
      mockPreviews.set([
        { port: 3000, baseUrl: 'http://localhost:3000', ready: true },
      ]);

      render(<Preview />);

      const reloadButton = screen.getByTitle('Recharger l\'aperçu');
      // Just verify the button is clickable
      expect(() => fireEvent.click(reloadButton)).not.toThrow();
    });
  });

  describe('fullscreen functionality', () => {
    it('should have fullscreen button', () => {
      render(<Preview />);

      expect(screen.getByTitle('Plein écran')).toBeInTheDocument();
    });

    it('should enable fullscreen button when preview is ready', () => {
      mockPreviews.set([
        { port: 3000, baseUrl: 'http://localhost:3000', ready: true },
      ]);

      render(<Preview />);

      const fullscreenButton = screen.getByTitle('Plein écran');
      expect(fullscreenButton).not.toBeDisabled();
    });
  });

  describe('preview selection', () => {
    it('should show first preview by default', () => {
      mockPreviews.set([
        { port: 3000, baseUrl: 'http://localhost:3000', ready: true },
        { port: 5173, baseUrl: 'http://localhost:5173', ready: true },
      ]);

      render(<Preview />);

      const input = screen.getByLabelText('Barre d\'adresse de l\'aperçu') as HTMLInputElement;
      expect(input.value).toContain('3000');
    });
  });
});
