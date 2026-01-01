import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Create mock stores
const {
  mockChatStore,
  mockPendingBatchStore,
  mockApprovalModalOpenStore,
  mockActiveAgentCountStore,
} = vi.hoisted(() => {
  const { map, atom } = require('nanostores');
  const chatStore = map({ mode: 'agent', controlMode: 'auto' });
  return {
    mockChatStore: chatStore,
    mockPendingBatchStore: atom(null),
    mockApprovalModalOpenStore: atom(false),
    mockActiveAgentCountStore: atom(0),
  };
});

// Mock stores
vi.mock('~/lib/stores/chat', () => ({
  chatStore: mockChatStore,
  pendingBatchStore: mockPendingBatchStore,
  approvalModalOpenStore: mockApprovalModalOpenStore,
  approveAllActions: vi.fn(),
  approveSelectedActions: vi.fn(),
  rejectAllActions: vi.fn(),
}));

vi.mock('~/lib/stores/agents', () => ({
  activeAgentCountStore: mockActiveAgentCountStore,
  resetAgentStores: vi.fn(),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(({ children, className, ...props }: any, ref: any) => (
      <div ref={ref} className={className} {...props}>{children}</div>
    )),
    button: React.forwardRef(({ children, className, onClick, ...props }: any, ref: any) => (
      <button ref={ref} className={className} onClick={onClick} {...props}>{children}</button>
    )),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock child components
vi.mock('./ActionApprovalModal', () => ({
  ActionApprovalModal: ({ isOpen, onApproveAll, onRejectAll, onClose }: any) => (
    isOpen ? (
      <div data-testid="approval-modal">
        <button onClick={onApproveAll} data-testid="approve-all">Approve All</button>
        <button onClick={onRejectAll} data-testid="reject-all">Reject All</button>
        <button onClick={onClose} data-testid="close-modal">Close</button>
      </div>
    ) : null
  ),
}));

vi.mock('./AgentActivityLog', () => ({
  AgentActivityLog: ({ isOpen, onClose }: any) => (
    isOpen ? (
      <div data-testid="activity-log">
        <button onClick={onClose} data-testid="close-activity-log">Close</button>
      </div>
    ) : null
  ),
}));

vi.mock('./AgentStatusBadge', () => ({
  AgentStatusBadge: ({ onClick, className }: any) => (
    <button onClick={onClick} className={className} data-testid="status-badge">
      Status Badge
    </button>
  ),
  AgentStopButton: ({ onStop, className }: any) => (
    <button onClick={onStop} className={className} data-testid="stop-button">
      Stop All
    </button>
  ),
}));

// Import after mocks
import { AgentChatIntegration, AgentModeToggle, ControlModeSelector } from './AgentChatIntegration';
import { resetAgentStores } from '~/lib/stores/agents';
import { approveAllActions, rejectAllActions } from '~/lib/stores/chat';

describe('AgentChatIntegration', () => {
  const mockOnStopAll = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockChatStore.set({ mode: 'agent', controlMode: 'auto' });
    mockPendingBatchStore.set(null);
    mockApprovalModalOpenStore.set(false);
    mockActiveAgentCountStore.set(0);
  });

  describe('rendering', () => {
    it('should not render when in chat mode', () => {
      mockChatStore.set({ mode: 'chat', controlMode: 'auto' });

      render(<AgentChatIntegration onStopAll={mockOnStopAll} />);

      expect(screen.queryByTestId('status-badge')).not.toBeInTheDocument();
    });

    it('should render in agent mode', () => {
      mockActiveAgentCountStore.set(1);

      render(<AgentChatIntegration onStopAll={mockOnStopAll} />);

      expect(screen.getByTestId('status-badge')).toBeInTheDocument();
    });

    it('should not show floating UI when no active agents', () => {
      mockActiveAgentCountStore.set(0);

      render(<AgentChatIntegration onStopAll={mockOnStopAll} />);

      expect(screen.queryByTestId('status-badge')).not.toBeInTheDocument();
    });

    it('should show floating UI when agents are active', () => {
      mockActiveAgentCountStore.set(2);

      render(<AgentChatIntegration onStopAll={mockOnStopAll} />);

      expect(screen.getByTestId('status-badge')).toBeInTheDocument();
      expect(screen.getByTestId('stop-button')).toBeInTheDocument();
    });

    it('should have displayName set', () => {
      expect(AgentChatIntegration.displayName).toBe('AgentChatIntegration');
    });
  });

  describe('activity log', () => {
    it('should open activity log when status badge clicked', () => {
      mockActiveAgentCountStore.set(1);

      render(<AgentChatIntegration onStopAll={mockOnStopAll} />);

      fireEvent.click(screen.getByTestId('status-badge'));

      expect(screen.getByTestId('activity-log')).toBeInTheDocument();
    });

    it('should close activity log when close clicked', () => {
      mockActiveAgentCountStore.set(1);

      render(<AgentChatIntegration onStopAll={mockOnStopAll} />);

      // Open activity log
      fireEvent.click(screen.getByTestId('status-badge'));
      expect(screen.getByTestId('activity-log')).toBeInTheDocument();

      // Close activity log
      fireEvent.click(screen.getByTestId('close-activity-log'));
      expect(screen.queryByTestId('activity-log')).not.toBeInTheDocument();
    });

    it('should not show activity log button when showActivityLog is false', () => {
      mockActiveAgentCountStore.set(1);

      render(<AgentChatIntegration onStopAll={mockOnStopAll} showActivityLog={false} />);

      fireEvent.click(screen.getByTestId('status-badge'));

      // Activity log should not be available
      expect(screen.queryByTestId('activity-log')).not.toBeInTheDocument();
    });
  });

  describe('stop functionality', () => {
    it('should call onStopAll when stop button clicked', () => {
      mockActiveAgentCountStore.set(1);

      render(<AgentChatIntegration onStopAll={mockOnStopAll} />);

      fireEvent.click(screen.getByTestId('stop-button'));

      expect(resetAgentStores).toHaveBeenCalled();
      expect(mockOnStopAll).toHaveBeenCalled();
    });
  });

  describe('approval modal', () => {
    it('should show approval modal when open', () => {
      mockApprovalModalOpenStore.set(true);
      mockPendingBatchStore.set({
        id: 'batch-1',
        agent: 'coder',
        actions: [{ id: 'action-1', type: 'file_create', details: {} }],
        createdAt: new Date(),
      });

      render(<AgentChatIntegration onStopAll={mockOnStopAll} />);

      expect(screen.getByTestId('approval-modal')).toBeInTheDocument();
    });

    it('should call approveAllActions when approve all clicked', () => {
      mockApprovalModalOpenStore.set(true);
      mockPendingBatchStore.set({
        id: 'batch-1',
        agent: 'coder',
        actions: [{ id: 'action-1', type: 'file_create', details: {} }],
        createdAt: new Date(),
      });

      render(<AgentChatIntegration onStopAll={mockOnStopAll} />);

      fireEvent.click(screen.getByTestId('approve-all'));

      expect(approveAllActions).toHaveBeenCalled();
    });

    it('should call rejectAllActions when reject all clicked', () => {
      mockApprovalModalOpenStore.set(true);
      mockPendingBatchStore.set({
        id: 'batch-1',
        agent: 'coder',
        actions: [{ id: 'action-1', type: 'file_create', details: {} }],
        createdAt: new Date(),
      });

      render(<AgentChatIntegration onStopAll={mockOnStopAll} />);

      fireEvent.click(screen.getByTestId('reject-all'));

      expect(rejectAllActions).toHaveBeenCalled();
    });
  });

  describe('props defaults', () => {
    it('should default showStatusBadge to true', () => {
      mockActiveAgentCountStore.set(1);

      render(<AgentChatIntegration onStopAll={mockOnStopAll} />);

      expect(screen.getByTestId('status-badge')).toBeInTheDocument();
    });

    it('should default showActivityLog to true', () => {
      mockActiveAgentCountStore.set(1);

      render(<AgentChatIntegration onStopAll={mockOnStopAll} />);

      fireEvent.click(screen.getByTestId('status-badge'));

      expect(screen.getByTestId('activity-log')).toBeInTheDocument();
    });

    it('should default position to bottom-right', () => {
      mockActiveAgentCountStore.set(1);

      const { container } = render(<AgentChatIntegration onStopAll={mockOnStopAll} />);

      const floatingContainer = container.querySelector('.bottom-4.right-4');
      expect(floatingContainer).toBeInTheDocument();
    });
  });

  describe('position prop', () => {
    it('should apply bottom-left position', () => {
      mockActiveAgentCountStore.set(1);

      const { container } = render(<AgentChatIntegration onStopAll={mockOnStopAll} position="bottom-left" />);

      const floatingContainer = container.querySelector('.bottom-4.left-4');
      expect(floatingContainer).toBeInTheDocument();
    });

    it('should apply top-right position', () => {
      mockActiveAgentCountStore.set(1);

      const { container } = render(<AgentChatIntegration onStopAll={mockOnStopAll} position="top-right" />);

      const floatingContainer = container.querySelector('.top-4.right-4');
      expect(floatingContainer).toBeInTheDocument();
    });
  });
});

describe('AgentModeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChatStore.set({ mode: 'agent', controlMode: 'auto' });
  });

  describe('rendering', () => {
    it('should render in agent mode', () => {
      render(<AgentModeToggle />);

      expect(screen.getByText('Agent')).toBeInTheDocument();
    });

    it('should render in chat mode', () => {
      mockChatStore.set({ mode: 'chat', controlMode: 'auto' });

      render(<AgentModeToggle />);

      expect(screen.getByText('Chat')).toBeInTheDocument();
    });

    it('should have displayName set', () => {
      expect(AgentModeToggle.displayName).toBe('AgentModeToggle');
    });
  });

  describe('interaction', () => {
    it('should toggle mode when clicked', () => {
      render(<AgentModeToggle />);

      // Initially in agent mode, clicking should toggle to chat mode
      fireEvent.click(screen.getByRole('button'));

      // Store's setKey is called and mode changes to 'chat'
      expect(mockChatStore.get().mode).toBe('chat');
    });
  });

  describe('styling', () => {
    it('should apply custom className', () => {
      render(<AgentModeToggle className="custom-toggle-class" />);

      expect(screen.getByRole('button')).toHaveClass('custom-toggle-class');
    });
  });
});

describe('ControlModeSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChatStore.set({ mode: 'agent', controlMode: 'moderate' });
  });

  describe('rendering', () => {
    it('should not render when in chat mode', () => {
      mockChatStore.set({ mode: 'chat', controlMode: 'auto' });

      render(<ControlModeSelector />);

      expect(screen.queryByText('Strict')).not.toBeInTheDocument();
    });

    it('should render mode buttons in agent mode', () => {
      render(<ControlModeSelector />);

      expect(screen.getByText('Strict')).toBeInTheDocument();
      expect(screen.getByText('Moderate')).toBeInTheDocument();
      expect(screen.getByText('Permissive')).toBeInTheDocument();
    });

    it('should render compact dropdown when compact is true', () => {
      render(<ControlModeSelector compact={true} />);

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should have displayName set', () => {
      expect(ControlModeSelector.displayName).toBe('ControlModeSelector');
    });
  });

  describe('styling', () => {
    it('should apply custom className', () => {
      const { container } = render(<ControlModeSelector className="custom-selector-class" />);

      expect(container.firstChild).toHaveClass('custom-selector-class');
    });
  });

  describe('compact mode', () => {
    it('should render as select dropdown in compact mode', () => {
      render(<ControlModeSelector compact={true} />);

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      expect(select.tagName).toBe('SELECT');
    });

    it('should have all options in dropdown', () => {
      render(<ControlModeSelector compact={true} />);

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(3);
    });
  });
});
