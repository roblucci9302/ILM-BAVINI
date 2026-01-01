import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  describe('rendering', () => {
    it('should render with icon', () => {
      const { container } = render(<IconButton icon="i-ph:plus" />);

      expect(container.querySelector('.i-ph\\:plus')).toBeInTheDocument();
    });

    it('should render with children instead of icon', () => {
      render(<IconButton>Custom Content</IconButton>);

      expect(screen.getByText('Custom Content')).toBeInTheDocument();
    });

    it('should render as a button', () => {
      render(<IconButton icon="i-ph:plus" />);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('should apply sm size', () => {
      const { container } = render(<IconButton icon="i-ph:plus" size="sm" />);

      expect(container.querySelector('.text-sm')).toBeInTheDocument();
    });

    it('should apply md size', () => {
      const { container } = render(<IconButton icon="i-ph:plus" size="md" />);

      expect(container.querySelector('.text-md')).toBeInTheDocument();
    });

    it('should apply lg size', () => {
      const { container } = render(<IconButton icon="i-ph:plus" size="lg" />);

      expect(container.querySelector('.text-lg')).toBeInTheDocument();
    });

    it('should apply xl size by default', () => {
      const { container } = render(<IconButton icon="i-ph:plus" />);

      expect(container.querySelector('.text-xl')).toBeInTheDocument();
    });

    it('should apply xxl size', () => {
      const { container } = render(<IconButton icon="i-ph:plus" size="xxl" />);

      expect(container.querySelector('.text-2xl')).toBeInTheDocument();
    });
  });

  describe('title and aria-label', () => {
    it('should set title attribute', () => {
      render(<IconButton icon="i-ph:plus" title="Add item" />);

      expect(screen.getByTitle('Add item')).toBeInTheDocument();
    });

    it('should use title as aria-label when aria-label not provided', () => {
      render(<IconButton icon="i-ph:plus" title="Add item" />);

      expect(screen.getByLabelText('Add item')).toBeInTheDocument();
    });

    it('should use explicit aria-label when provided', () => {
      render(<IconButton icon="i-ph:plus" title="Add" aria-label="Add new item" />);

      expect(screen.getByLabelText('Add new item')).toBeInTheDocument();
    });
  });

  describe('disabled state', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<IconButton icon="i-ph:plus" disabled={true} />);

      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('should apply opacity when disabled', () => {
      render(<IconButton icon="i-ph:plus" disabled={true} />);

      expect(screen.getByRole('button')).toHaveClass('opacity-30');
    });

    it('should apply custom disabledClassName', () => {
      render(<IconButton icon="i-ph:plus" disabled={true} disabledClassName="custom-disabled" />);

      expect(screen.getByRole('button')).toHaveClass('custom-disabled');
    });

    it('should not call onClick when disabled', () => {
      const handleClick = vi.fn();
      render(<IconButton icon="i-ph:plus" disabled={true} onClick={handleClick} />);

      fireEvent.click(screen.getByRole('button'));

      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('click handling', () => {
    it('should call onClick when clicked', () => {
      const handleClick = vi.fn();
      render(<IconButton icon="i-ph:plus" onClick={handleClick} />);

      fireEvent.click(screen.getByRole('button'));

      expect(handleClick).toHaveBeenCalled();
    });

    it('should pass event to onClick handler', () => {
      const handleClick = vi.fn();
      render(<IconButton icon="i-ph:plus" onClick={handleClick} />);

      fireEvent.click(screen.getByRole('button'));

      expect(handleClick).toHaveBeenCalledWith(expect.any(Object));
    });
  });

  describe('styling', () => {
    it('should apply custom className', () => {
      render(<IconButton icon="i-ph:plus" className="custom-class" />);

      expect(screen.getByRole('button')).toHaveClass('custom-class');
    });

    it('should apply iconClassName to icon element', () => {
      const { container } = render(<IconButton icon="i-ph:plus" iconClassName="icon-custom" />);

      expect(container.querySelector('.icon-custom')).toBeInTheDocument();
    });

    it('should have base styling classes', () => {
      render(<IconButton icon="i-ph:plus" />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('flex', 'items-center', 'rounded-md', 'p-1');
    });
  });

  describe('memoization', () => {
    it('should be memoized', () => {
      expect(IconButton).toBeDefined();
      expect(typeof IconButton).toBe('object'); // memo components are objects
    });
  });
});
