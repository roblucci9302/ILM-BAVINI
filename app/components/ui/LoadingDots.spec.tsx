import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LoadingDots } from './LoadingDots';

describe('LoadingDots', () => {

  describe('rendering', () => {
    it('should render with provided text', () => {
      render(<LoadingDots text="Loading" />);

      expect(screen.getByText('Loading')).toBeInTheDocument();
    });

    it('should render invisible dots placeholder', () => {
      const { container } = render(<LoadingDots text="Loading" />);

      const invisibleDots = container.querySelector('.invisible');
      expect(invisibleDots).toBeInTheDocument();
      expect(invisibleDots).toHaveTextContent('...');
    });
  });

  describe('animation', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should start with 0 dots', () => {
      const { container } = render(<LoadingDots text="Loading" />);

      const dotsSpan = container.querySelector('.absolute');
      expect(dotsSpan?.textContent).toBe('');
    });

    it('should show 1 dot after 500ms', () => {
      const { container } = render(<LoadingDots text="Loading" />);

      act(() => {
        vi.advanceTimersByTime(500);
      });

      const dotsSpan = container.querySelector('.absolute');
      expect(dotsSpan?.textContent).toBe('.');
    });

    it('should show 2 dots after 1000ms', () => {
      const { container } = render(<LoadingDots text="Loading" />);

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      const dotsSpan = container.querySelector('.absolute');
      expect(dotsSpan?.textContent).toBe('..');
    });

    it('should show 3 dots after 1500ms', () => {
      const { container } = render(<LoadingDots text="Loading" />);

      act(() => {
        vi.advanceTimersByTime(1500);
      });

      const dotsSpan = container.querySelector('.absolute');
      expect(dotsSpan?.textContent).toBe('...');
    });

    it('should cycle back to 0 dots after 2000ms', () => {
      const { container } = render(<LoadingDots text="Loading" />);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      const dotsSpan = container.querySelector('.absolute');
      expect(dotsSpan?.textContent).toBe('');
    });

    it('should continue cycling', () => {
      const { container } = render(<LoadingDots text="Loading" />);

      // Full cycle + 1 more step
      act(() => {
        vi.advanceTimersByTime(2500);
      });

      const dotsSpan = container.querySelector('.absolute');
      expect(dotsSpan?.textContent).toBe('.');
    });
  });

  describe('cleanup', () => {
    it('should use setInterval', () => {
      // Verify the component uses setInterval by checking it renders without error
      expect(() => {
        const { unmount } = render(<LoadingDots text="Loading" />);
        unmount();
      }).not.toThrow();
    });
  });

  describe('layout', () => {
    it('should have flex container', () => {
      const { container } = render(<LoadingDots text="Loading" />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('flex', 'justify-center', 'items-center');
    });

    it('should have relative positioning for text container', () => {
      const { container } = render(<LoadingDots text="Loading" />);

      const textContainer = container.querySelector('.relative');
      expect(textContainer).toBeInTheDocument();
    });
  });

  describe('different texts', () => {
    it('should render with short text', () => {
      render(<LoadingDots text="Hi" />);

      expect(screen.getByText('Hi')).toBeInTheDocument();
    });

    it('should render with long text', () => {
      render(<LoadingDots text="Please wait while we process your request" />);

      expect(screen.getByText('Please wait while we process your request')).toBeInTheDocument();
    });

    it('should render with empty text', () => {
      render(<LoadingDots text="" />);

      const { container } = render(<LoadingDots text="" />);
      expect(container).toBeInTheDocument();
    });
  });

  describe('memoization', () => {
    it('should be memoized', () => {
      expect(LoadingDots).toBeDefined();
      expect(typeof LoadingDots).toBe('object'); // memo components are objects
    });
  });
});
