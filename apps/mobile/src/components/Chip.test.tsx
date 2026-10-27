import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chip } from './Chip';

describe('Chip', () => {
  afterEach(cleanup);

  it('shows its pressed state and a 44px touch target', () => {
    render(<Chip selected>Tất cả</Chip>);
    const chip = screen.getByRole('button', { name: 'Tất cả' });
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(chip.style.minHeight).toBe('44px');
  });

  it('calls onClick and draws the icon', () => {
    const onClick = vi.fn();
    render(
      <Chip icon={<svg data-testid="icon" />} onClick={onClick}>
        Bóng đá
      </Chip>,
    );
    const chip = screen.getByRole('button', { name: 'Bóng đá' });
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('icon')).toBeDefined();
    fireEvent.click(chip);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
