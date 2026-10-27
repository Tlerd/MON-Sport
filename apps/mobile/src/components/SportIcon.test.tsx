import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SPORT_LABEL, SportIcon } from './SportIcon';

describe('SportIcon', () => {
  afterEach(cleanup);

  it('names the two sports in Vietnamese', () => {
    expect(SPORT_LABEL).toEqual({ BADMINTON: 'Cầu lông', FOOTBALL: 'Bóng đá' });
  });

  it('draws a hidden svg for each sport', () => {
    const { container } = render(
      <>
        <SportIcon sport="BADMINTON" />
        <SportIcon sport="FOOTBALL" size={16} />
      </>,
    );
    const svgs = container.querySelectorAll('svg');
    expect(svgs).toHaveLength(2);
    expect(svgs[0].getAttribute('aria-hidden')).toBe('true');
    expect(svgs[1].getAttribute('width')).toBe('16');
    expect(svgs[0].innerHTML).not.toBe(svgs[1].innerHTML);
  });
});
