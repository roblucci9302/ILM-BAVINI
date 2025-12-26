import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ConnectorIcon } from './ConnectorIcon';

describe('ConnectorIcon', () => {
  describe('known icons', () => {
    it('should render supabase icon', () => {
      const { container } = render(<ConnectorIcon icon="supabase" />);

      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render github icon', () => {
      const { container } = render(<ConnectorIcon icon="github" />);

      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render stripe icon', () => {
      const { container } = render(<ConnectorIcon icon="stripe" />);

      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render notion icon', () => {
      const { container } = render(<ConnectorIcon icon="notion" />);

      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render figma icon', () => {
      const { container } = render(<ConnectorIcon icon="figma" />);

      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render linear icon', () => {
      const { container } = render(<ConnectorIcon icon="linear" />);

      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('fallback icon', () => {
    it('should render fallback icon for unknown connector', () => {
      const { container } = render(<ConnectorIcon icon="unknown" />);

      expect(container.querySelector('.i-ph\\:plug')).toBeInTheDocument();
    });

    it('should have fallback background styling', () => {
      const { container } = render(<ConnectorIcon icon="unknown" />);
      const wrapper = container.firstChild as HTMLElement;

      expect(wrapper).toHaveClass('bg-bolt-elements-background-depth-2');
    });
  });

  describe('className prop', () => {
    it('should apply custom className to known icon', () => {
      const { container } = render(<ConnectorIcon icon="github" className="w-8 h-8" />);
      const wrapper = container.firstChild as HTMLElement;

      expect(wrapper).toHaveClass('w-8');
      expect(wrapper).toHaveClass('h-8');
    });

    it('should apply custom className to fallback icon', () => {
      const { container } = render(<ConnectorIcon icon="unknown" className="w-10 h-10" />);
      const wrapper = container.firstChild as HTMLElement;

      expect(wrapper).toHaveClass('w-10');
      expect(wrapper).toHaveClass('h-10');
    });
  });

  describe('all connector icons', () => {
    const connectorIds = [
      'supabase',
      'stripe',
      'shopify',
      'elevenlabs',
      'perplexity',
      'firecrawl',
      'netlify',
      'figma',
      'github',
      'atlassian',
      'linear',
      'miro',
      'n8n',
      'notion',
    ];

    it.each(connectorIds)('should render %s icon without error', (iconId) => {
      const { container } = render(<ConnectorIcon icon={iconId} />);

      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });
});
