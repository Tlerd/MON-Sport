import { describe, expect, it } from 'vitest';
import {
  RATE_CANCELLED,
  RATE_NOT_PLAYER,
  RATE_TOO_EARLY,
  RATE_TOO_LATE,
  RATE_WINDOW_DAYS,
  PlayerRatingView,
  PlayerReputation,
  RatePlayerRequest,
} from './rating.ts';

describe('rating contract, brief F-032', () => {
  it('AC-1: exports exact constants for rating rules', () => {
    expect(RATE_WINDOW_DAYS).toBe(7);
    expect(RATE_TOO_EARLY).toBe('Trận chưa bắt đầu, chưa chấm điểm được');
    expect(RATE_TOO_LATE).toBe('Đã quá 7 ngày sau trận, không chấm điểm được nữa');
    expect(RATE_CANCELLED).toBe('Trận đã hủy, không chấm điểm được');
    expect(RATE_NOT_PLAYER).toBe('Người này không có suất trong trận');
  });

  it('AC-1: RatePlayerRequest accepts stars 1..5 when noShow is false', () => {
    for (const stars of [1, 2, 3, 4, 5]) {
      expect(RatePlayerRequest.parse({ stars, noShow: false })).toEqual({ stars, noShow: false });
    }
  });

  it('AC-1: RatePlayerRequest accepts stars null when noShow is true', () => {
    expect(RatePlayerRequest.parse({ stars: null, noShow: true })).toEqual({ stars: null, noShow: true });
  });

  it('AC-1: RatePlayerRequest rejects stars 0, 6, 2.5 and extra fields', () => {
    for (const stars of [0, 6, 2.5, -1]) {
      expect(RatePlayerRequest.safeParse({ stars, noShow: false }).success).toBe(false);
    }
    expect(RatePlayerRequest.safeParse({ stars: 5, noShow: false, extra: true }).success).toBe(false);
  });

  it('AC-1: RatePlayerRequest rejects mismatched pairs with the refine message', () => {
    const withStarsAndNoShow = RatePlayerRequest.safeParse({ stars: 5, noShow: true });
    expect(withStarsAndNoShow.success).toBe(false);
    expect(withStarsAndNoShow.error?.issues[0]?.message).toBe('Chọn số sao, hoặc chọn Vắng mặt');

    const withNullStarsAndNotNoShow = RatePlayerRequest.safeParse({ stars: null, noShow: false });
    expect(withNullStarsAndNotNoShow.success).toBe(false);
    expect(withNullStarsAndNotNoShow.error?.issues[0]?.message).toBe('Chọn số sao, hoặc chọn Vắng mặt');
  });

  it('AC-1: PlayerRatingView parses rating view with stars, noShow, or unrated', () => {
    const rated = {
      userId: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
      name: 'Bình',
      stars: 5,
      noShow: false,
    };
    expect(PlayerRatingView.parse(rated)).toEqual(rated);

    const noShow = {
      ...rated,
      stars: null,
      noShow: true,
    };
    expect(PlayerRatingView.parse(noShow)).toEqual(noShow);

    const unrated = {
      ...rated,
      stars: null,
      noShow: null,
    };
    expect(PlayerRatingView.parse(unrated)).toEqual(unrated);

    expect(PlayerRatingView.safeParse({ ...rated, stars: 0 }).success).toBe(false);
    expect(PlayerRatingView.safeParse({ ...rated, stars: 6 }).success).toBe(false);
    expect(PlayerRatingView.safeParse({ ...rated, userId: 'bad-uuid' }).success).toBe(false);
  });

  it('AC-1: PlayerReputation parses ratingAvg, ratingCount, noShowCount', () => {
    const rep = {
      ratingAvg: 4.5,
      ratingCount: 12,
      noShowCount: 1,
    };
    expect(PlayerReputation.parse(rep)).toEqual(rep);

    const emptyRep = {
      ratingAvg: null,
      ratingCount: 0,
      noShowCount: 0,
    };
    expect(PlayerReputation.parse(emptyRep)).toEqual(emptyRep);

    expect(PlayerReputation.safeParse({ ...rep, ratingCount: -1 }).success).toBe(false);
    expect(PlayerReputation.safeParse({ ...rep, noShowCount: -1 }).success).toBe(false);
    expect(PlayerReputation.safeParse({ ...rep, ratingCount: 1.5 }).success).toBe(false);
  });
});
