import { describe, expect, it } from 'vitest';
import { Messages } from './account.ts';
import {
  ALREADY_IN_MATCH_MESSAGE,
  JOIN_REJECTED_MESSAGE,
  CreateMatchRequest,
  HOST_CANNOT_LEAVE_MESSAGE,
  LEAVE_STARTED_MESSAGE,
  MATCH_CAPACITY_MESSAGE,
  MATCH_FULL_MESSAGE,
  MATCH_PRICE_MESSAGE,
  MatchDetailView,
  matchErrorMessage,
  MatchLobbyQuery,
  MatchPlayerStatus,
  MatchPlayerView,
  MatchStatus,
  MatchSummary,
  MatchView,
  MatchRequestListView,
  MatchRequestView,
  MatchViewerRole,
  REQUEST_EXPIRED_MESSAGE,
  REQUEST_NOT_PENDING_MESSAGE,
  NOT_IN_MATCH_MESSAGE,
  NOT_JOINABLE_MESSAGE,
  NOT_LEAVABLE_MESSAGE,
} from './match.ts';

const bookingId = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';

describe('match contract, brief F-011', () => {
  it('AC-1, AC-2: accepts capacity 2..30 and pricePerSlot 0..10_000_000', () => {
    expect(CreateMatchRequest.parse({ bookingId, capacity: 4, pricePerSlot: 50_000 })).toEqual({
      bookingId,
      capacity: 4,
      pricePerSlot: 50_000,
    });
    expect(CreateMatchRequest.parse({ bookingId, capacity: 2, pricePerSlot: 0 })).toEqual({
      bookingId,
      capacity: 2,
      pricePerSlot: 0,
    });
    expect(CreateMatchRequest.parse({ bookingId, capacity: 30, pricePerSlot: 10_000_000 })).toEqual({
      bookingId,
      capacity: 30,
      pricePerSlot: 10_000_000,
    });
  });

  it('AC-5: refuses capacity outside 2..30 with the capacity text', () => {
    for (const capacity of [1, 31, 0, -2, 4.5]) {
      const parsed = CreateMatchRequest.safeParse({ bookingId, capacity, pricePerSlot: 50_000 });
      expect(parsed.success).toBe(false);
      expect(matchErrorMessage(parsed.error!)).toBe(MATCH_CAPACITY_MESSAGE);
    }
  });

  it('AC-5: refuses negative, >10_000_000, or fractional pricePerSlot with the price text', () => {
    for (const pricePerSlot of [-1, 10_000_001, 50.5]) {
      const parsed = CreateMatchRequest.safeParse({ bookingId, capacity: 4, pricePerSlot });
      expect(parsed.success).toBe(false);
      expect(matchErrorMessage(parsed.error!)).toBe(MATCH_PRICE_MESSAGE);
    }
  });

  it('AC-5: refuses a malformed bookingId or an unknown field with the generic Vietnamese text', () => {
    const badId = CreateMatchRequest.safeParse({ bookingId: 'abc', capacity: 4, pricePerSlot: 50_000 });
    expect(badId.success).toBe(false);
    expect(matchErrorMessage(badId.error!)).toBe('Dữ liệu không hợp lệ');
    const extra = CreateMatchRequest.safeParse({ bookingId, capacity: 4, pricePerSlot: 50_000, sport: 'BADMINTON' });
    expect(extra.success).toBe(false);
    expect(matchErrorMessage(extra.error!)).toBe('Dữ liệu không hợp lệ');
  });

  it('AC-6: parses MatchLobbyQuery with optional sport and ISO date', () => {
    expect(MatchLobbyQuery.parse({})).toEqual({});
    expect(MatchLobbyQuery.parse({ sport: 'BADMINTON', date: '2026-11-20' })).toEqual({
      sport: 'BADMINTON',
      date: '2026-11-20',
    });
    expect(MatchLobbyQuery.safeParse({ sport: 'TENNIS' }).success).toBe(false);
    expect(MatchLobbyQuery.safeParse({ date: '2026-13-45' }).success).toBe(false);
    expect(MatchLobbyQuery.safeParse({ date: '20-11-2026' }).success).toBe(false);
    expect(MatchLobbyQuery.safeParse({ extra: '1' }).success).toBe(false);
  });

  it('parses MatchStatus, MatchPlayerStatus, MatchSummary, and MatchView without phone numbers (BR-20)', () => {
    expect(MatchStatus.options).toEqual(['OPEN', 'FULL', 'CANCELLED', 'FINISHED']);
    expect(MatchPlayerStatus.options).toEqual(['ACTIVE', 'LEFT', 'PENDING', 'REJECTED']);
    const summary = {
      id: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c',
      status: 'OPEN',
      capacity: 4,
      joinedCount: 1,
      pricePerSlot: 50_000,
    };
    expect(MatchSummary.parse(summary)).toEqual(summary);
    const view = {
      ...summary,
      bookingId,
      hostId: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d',
      hostName: 'An',
      sport: 'BADMINTON',
      bookingStatus: 'PENDING',
      startAt: '2026-11-20T13:00:00.000Z',
      endAt: '2026-11-20T14:00:00.000Z',
      courtName: 'Sân 1',
      venueName: 'Cầu lông A',
      venueAddress: '10 Nguyễn Huệ',
      createdAt: '2026-11-20T03:00:00.000Z',
    };
    expect(MatchView.parse(view)).toEqual(view);
  });
});

describe('match contract, brief F-012', () => {
  const baseView = {
    id: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c',
    bookingId,
    hostId: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d',
    hostName: 'An',
    sport: 'BADMINTON',
    capacity: 4,
    joinedCount: 2,
    pricePerSlot: 50_000,
    status: 'OPEN',
    bookingStatus: 'PENDING',
    startAt: '2026-11-20T13:00:00.000Z',
    endAt: '2026-11-20T14:00:00.000Z',
    courtName: 'Sân 1',
    venueName: 'Cầu lông A',
    venueAddress: '10 Nguyễn Huệ',
    createdAt: '2026-11-20T03:00:00.000Z',
  };

  it('AC-1, AC-7: parses MatchViewerRole, MatchPlayerView, and MatchDetailView with BR-20 phone visibility', () => {
    expect(MatchViewerRole.options).toEqual(['HOST', 'PLAYER', 'NONE']);
    const hostPlayer = {
      userId: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d',
      name: 'An',
      phone: '0901234567',
      joinedAt: '2026-11-20T03:00:00.000Z',
    };
    const chiHidden = {
      userId: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e',
      name: 'Chi',
      phone: null,
      joinedAt: '2026-11-20T03:01:00.000Z',
    };
    expect(MatchPlayerView.parse(hostPlayer)).toEqual(hostPlayer);
    expect(MatchPlayerView.parse(chiHidden)).toEqual(chiHidden);

    const forHost = {
      ...baseView,
      viewerRole: 'HOST',
      players: [hostPlayer, { ...chiHidden, phone: '0901234568' }],
    };
    expect(MatchDetailView.parse(forHost)).toEqual(forHost);

    const forPlayer = {
      ...baseView,
      viewerRole: 'PLAYER',
      players: [{ ...hostPlayer, phone: null }, chiHidden],
    };
    expect(MatchDetailView.parse(forPlayer)).toEqual(forPlayer);

    const forNone = {
      ...baseView,
      viewerRole: 'NONE',
      players: [{ ...hostPlayer, phone: null }, chiHidden],
    };
    expect(MatchDetailView.parse(forNone)).toEqual(forNone);

    expect(
      MatchDetailView.safeParse({
        ...baseView,
        viewerRole: 'PLAYER',
        players: [hostPlayer, chiHidden],
      }).success,
    ).toBe(false);
    expect(
      MatchDetailView.safeParse({
        ...baseView,
        viewerRole: 'NONE',
        players: [hostPlayer, chiHidden],
      }).success,
    ).toBe(false);
    expect(
      MatchDetailView.safeParse({
        ...baseView,
        viewerRole: 'HOST',
        players: [{ ...hostPlayer, phone: null }, chiHidden],
      }).success,
    ).toBe(false);
  });

  it('AC-2, AC-5, AC-6: exports the exact Vietnamese error texts for join and leave', () => {
    expect(MATCH_FULL_MESSAGE).toBe('Trận đã đủ người');
    expect(ALREADY_IN_MATCH_MESSAGE).toBe('Bạn đã ở trong trận này');
    expect(NOT_JOINABLE_MESSAGE).toBe('Trận này không vào được nữa');
    expect(HOST_CANNOT_LEAVE_MESSAGE).toBe('Host không rời trận được. Hãy hủy trận');
    expect(NOT_IN_MATCH_MESSAGE).toBe('Bạn không ở trong trận này');
    expect(LEAVE_STARTED_MESSAGE).toBe('Đã tới giờ bắt đầu, không rời trận được nữa');
    expect(NOT_LEAVABLE_MESSAGE).toBe('Trận này không rời được nữa');
  });
});

describe('match contract, brief F-028', () => {
  const view = {
    id: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c',
    bookingId,
    hostId: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5d',
    hostName: 'An',
    sport: 'BADMINTON',
    capacity: 4,
    joinedCount: 1,
    pricePerSlot: 50_000,
    status: 'OPEN',
    bookingStatus: 'CONFIRMED',
    startAt: '2026-11-20T13:00:00.000Z',
    endAt: '2026-11-20T14:00:00.000Z',
    courtName: 'Sân 1',
    venueName: 'Cầu lông A',
    venueAddress: '10 Nguyễn Huệ',
    createdAt: '2026-11-20T03:00:00.000Z',
  };
  const detail = {
    ...view,
    viewerRole: 'NONE',
    players: [{ userId: view.hostId, name: 'An', phone: null, joinedAt: '2026-11-20T03:00:00.000Z' }],
  };

  it('AC-1: CreateMatchRequest accepts a missing joinMode and a valid one', () => {
    const base = { bookingId, capacity: 4, pricePerSlot: 50_000 };
    expect(CreateMatchRequest.parse(base).joinMode).toBeUndefined();
    expect(CreateMatchRequest.parse({ ...base, joinMode: 'APPROVAL' }).joinMode).toBe('APPROVAL');
    const parsed = CreateMatchRequest.safeParse({ ...base, joinMode: 'OTHER' });
    expect(parsed.success).toBe(false);
    expect(matchErrorMessage(parsed.error!)).toBe(Messages.invalid);
  });

  it('AC-1: MatchPlayerStatus accepts ACTIVE, LEFT, PENDING, REJECTED', () => {
    for (const status of ['ACTIVE', 'LEFT', 'PENDING', 'REJECTED']) {
      expect(MatchPlayerStatus.safeParse(status).success).toBe(true);
    }
    expect(MatchPlayerStatus.safeParse('OTHER').success).toBe(false);
  });

  it('AC-1: MatchView accepts a match with and without joinMode', () => {
    expect(MatchView.safeParse(view).success).toBe(true);
    expect(MatchView.safeParse({ ...view, joinMode: 'INSTANT' }).success).toBe(true);
    expect(MatchView.safeParse({ ...view, joinMode: 'APPROVAL' }).success).toBe(true);
    expect(MatchView.safeParse({ ...view, joinMode: 'OTHER' }).success).toBe(false);
  });

  it('AC-1: MatchDetailView accepts myRequest PENDING, REJECTED, null, and absent', () => {
    expect(MatchDetailView.safeParse(detail).success).toBe(true);
    for (const myRequest of ['PENDING', 'REJECTED', null]) {
      expect(MatchDetailView.safeParse({ ...detail, myRequest }).success).toBe(true);
    }
    expect(MatchDetailView.safeParse({ ...detail, myRequest: 'ACTIVE' }).success).toBe(false);
  });

  it('AC-1: MatchDetailView accepts pendingCount as an optional non-negative int', () => {
    expect(MatchDetailView.safeParse({ ...detail, pendingCount: 0 }).success).toBe(true);
    expect(MatchDetailView.safeParse({ ...detail, pendingCount: 3 }).success).toBe(true);
    expect(MatchDetailView.safeParse({ ...detail, pendingCount: -1 }).success).toBe(false);
    expect(MatchDetailView.safeParse({ ...detail, pendingCount: 1.5 }).success).toBe(false);
  });

  it('AC-1: MatchRequestListView parses the host queue', () => {
    const item = {
      userId: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e',
      name: 'Lan',
      phone: '0901234568',
      requestedAt: '2026-11-20T03:01:00.000Z',
    };
    expect(MatchRequestView.parse(item)).toEqual(item);
    expect(MatchRequestListView.parse([item, item])).toHaveLength(2);
    expect(MatchRequestView.safeParse({ ...item, phone: null }).success).toBe(false);
  });

  it('AC-1: exports the exact Vietnamese error texts for join requests', () => {
    expect(JOIN_REJECTED_MESSAGE).toBe('Host đã từ chối yêu cầu của bạn');
    expect(REQUEST_EXPIRED_MESSAGE).toBe('Yêu cầu này đã hết hạn');
    expect(REQUEST_NOT_PENDING_MESSAGE).toBe('Yêu cầu này không còn chờ duyệt');
  });
});
