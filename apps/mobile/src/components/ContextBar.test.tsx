import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ContextBar } from './ContextBar';

describe('ContextBar', () => {
  it('renders children elements', () => {
    render(
      <ContextBar>
        <button type="button">Tất cả</button>
        <button type="button">Cầu lông</button>
      </ContextBar>,
    );
    expect(screen.getByText('Tất cả')).toBeDefined();
    expect(screen.getByText('Cầu lông')).toBeDefined();
  });

  it('moves up with translateY(-52px) when hidden', () => {
    const { container } = render(
      <ContextBar hidden>
        <div>Content</div>
      </ContextBar>,
    );
    const nav = container.querySelector('nav');
    expect(nav?.style.transform).toBe('translateY(-52px)');
  });
});
