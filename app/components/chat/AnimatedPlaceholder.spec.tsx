import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AnimatedPlaceholder } from './AnimatedPlaceholder';

// mock framer-motion to avoid animation complexities in tests
vi.mock('framer-motion', () => ({
  motion: {
    span: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('AnimatedPlaceholder', () => {
  it('should not render when show is false', () => {
    const { container } = render(<AnimatedPlaceholder show={false} />);

    expect(container.firstChild).toBeNull();
  });

  it('should render when show is true', () => {
    render(<AnimatedPlaceholder show={true} />);

    expect(screen.getByText('Créer')).toBeInTheDocument();
  });

  it('should have aria-hidden attribute for accessibility', () => {
    render(<AnimatedPlaceholder show={true} />);

    const container = screen.getByText('Créer').parentElement;

    expect(container).toHaveAttribute('aria-hidden', 'true');
  });

  it('should have pointer-events-none class', () => {
    render(<AnimatedPlaceholder show={true} />);

    const container = screen.getByText('Créer').parentElement;

    expect(container).toHaveClass('pointer-events-none');
  });

  it('should render the cursor character', () => {
    render(<AnimatedPlaceholder show={true} />);

    expect(screen.getByText('|')).toBeInTheDocument();
  });

  it('should start typing after initial render', async () => {
    render(<AnimatedPlaceholder show={true} />);

    // wait for the first character to be typed
    await waitFor(
      () => {
        const container = screen.getByText('Créer').parentElement;

        // the animated text should contain at least one character
        expect(container?.textContent).toContain('u');
      },
      { timeout: 500 },
    );
  });
});
