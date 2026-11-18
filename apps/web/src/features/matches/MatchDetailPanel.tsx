import {
  SKILL_LEVEL_LABELS,
  type MatchDetailView,
  type MatchRequestView,
  type MatchView,
  type PlayerReputation,
  type SessionUser,
} from '@monsport/shared';
import { formatDay, formatTime, formatVnd } from '@monsport/client';
import { ArrowLeft } from 'lucide-react';
import { Avatar } from '../../components/Avatar.tsx';
import { CourtArt } from '../../components/CourtArt.tsx';
import { EmptyState } from '../../components/EmptyState.tsx';
import { BOOKING_BADGE, SPORT_LABEL } from '../../components/MatchCard.tsx';
import { SportIcon } from '../../components/SportIcon.tsx';
import { StatusBadge } from '../../components/StatusBadge.tsx';

export function formatReputation(rep?: PlayerReputation | null): string {
  if (!rep) return 'Chưa có đánh giá';
  const { ratingAvg, ratingCount, noShowCount } = rep;
  if (ratingAvg !== null && ratingCount > 0) {
    const avgStr = ratingAvg.toLocaleString('vi-VN');
    const starPart = `${avgStr} ★ (${ratingCount})`;
    return noShowCount > 0 ? `${starPart} · ${noShowCount} lần vắng` : starPart;
  }
  if (noShowCount > 0) {
    return `Chưa có sao · ${noShowCount} lần vắng`;
  }
  return 'Chưa có đánh giá';
}

interface MatchDetailPanelProps {
  selectedMatch: MatchView | null;
  detail: MatchDetailView | null;
  requests: MatchRequestView[];
  busyRequestUserIds: Set<string>;
  user?: SessionUser | null;
  detailError: string;
  actionError: string;
  loadingAction: boolean;
  onClose: () => void;
  onJoin: (id: string) => void;
  onLeave: (id: string) => void;
  onRequestDecision: (matchId: string, requestUserId: string, action: 'approve' | 'reject') => void;
  onComingSoon: () => void;
}

export function MatchDetailPanel({
  selectedMatch,
  detail,
  requests,
  busyRequestUserIds,
  user,
  detailError,
  actionError,
  loadingAction,
  onClose,
  onJoin,
  onLeave,
  onRequestDecision,
  onComingSoon,
}: MatchDetailPanelProps) {
  const remaining = selectedMatch ? selectedMatch.capacity - selectedMatch.joinedCount : 0;
  const selectedIsApproval = ((detail?.joinMode ?? selectedMatch?.joinMode) ?? 'INSTANT') === 'APPROVAL';

  return (
    <div className={`lobby-detail-pane md-detail ${selectedMatch ? 'open' : ''}`}>
      {selectedMatch ? (
        <div className="match-detail card detail">
          <div className="md-back-bar">
            <button type="button" className="back md-back" onClick={onClose}>
              <ArrowLeft size={16} className="ic" aria-hidden="true" />
              <span>Quay lại</span>
            </button>
          </div>
          <header className="hero">
            <CourtArt sport={selectedMatch.sport} />
            <div className="hero-in">
              <div>
                <span className="stub-sport">
                  <SportIcon sport={selectedMatch.sport} size={14} />
                  <span>{SPORT_LABEL[selectedMatch.sport]}</span>
                </span>
                <h3>{`${selectedMatch.venueName} · ${selectedMatch.courtName}`}</h3>
              </div>
              <div className="hero-when">
                <b>{formatTime(selectedMatch.startAt)}</b>
                <span>
                  {`Ngày ${formatDay(selectedMatch.startAt)}`}
                  <br />
                  {`đến ${formatTime(selectedMatch.endAt)}`}
                </span>
              </div>
            </div>
          </header>

          <div className="detail-b">
            <div className="tags">
              <span className="tag solo">Trận đơn</span>
              <StatusBadge
                className="status"
                status={selectedMatch.bookingStatus}
                label={BOOKING_BADGE[selectedMatch.bookingStatus]}
              />
              {selectedIsApproval && <span className="tag warn">Host duyệt</span>}
            </div>

            <dl className="facts">
              <div>
                <dt>Đơn vị và sân</dt>
                <dd>
                  {selectedMatch.venueName}
                  <small>{`${selectedMatch.courtName} · ${selectedMatch.venueAddress}`}</small>
                </dd>
              </div>
              <div>
                <dt>Trình độ</dt>
                <dd>
                  {selectedMatch.hostSkillLevel
                    ? SKILL_LEVEL_LABELS[selectedMatch.hostSkillLevel]
                    : 'Mọi trình độ'}
                  <small>{`${SPORT_LABEL[selectedMatch.sport]} · Ngày ${formatDay(selectedMatch.startAt)}`}</small>
                </dd>
              </div>
              <div>
                <dt>Giá mỗi suất</dt>
                <dd>
                  <span>{`${formatVnd(selectedMatch.pricePerSlot)}/suất`}</span>
                  <small>{`Còn ${remaining} suất trống`}</small>
                </dd>
              </div>
              <div>
                <dt>Host</dt>
                <dd data-field="customer">{selectedMatch.hostName}</dd>
              </div>
            </dl>

            {!user && <p className="hint">Đăng nhập để vào trận</p>}

            {user && detail && detail.id === selectedMatch.id && (
              <>
                <div className="players-section">
                  <h4>
                    <strong>Người tham gia:</strong>{' '}
                    <span>{`${detail.players.length}/${selectedMatch.capacity}`}</span>
                  </h4>
                  <div className="meter">
                    <i
                      style={{
                        width: `${Math.min(100, Math.round((detail.players.length / selectedMatch.capacity) * 100))}%`,
                      }}
                    />
                  </div>
                  <ul className="roster players-list">
                    {detail.players.map((p) => (
                      <li key={p.userId} className="rp">
                        <Avatar
                          name={p.name}
                          size={36}
                          color={p.userId === selectedMatch.hostId ? 'var(--ink)' : 'var(--ok)'}
                        />
                        <div>
                          {detail.viewerRole === 'HOST' && p.phone ? (
                            <a href={`tel:${p.phone}`}>
                              {p.name} ({p.phone})
                            </a>
                          ) : (
                            <b>{p.name}</b>
                          )}
                        </div>
                        {p.userId === selectedMatch.hostId && <span className="tag ghost">Host</span>}
                      </li>
                    ))}
                  </ul>
                </div>

                {detail.viewerRole === 'HOST' && selectedIsApproval && (
                  <div className="queue-section reqs">
                    <h4 className="queue-heading">{`Hàng chờ (${requests.length})`}</h4>
                    {requests.length === 0 ? (
                      <p className="hint">Chưa có yêu cầu</p>
                    ) : (
                      <ul className="queue-list">
                        {requests.map((r) => {
                          const rowBusy = busyRequestUserIds.has(r.userId);
                          return (
                            <li key={r.userId} className="queue-row rp">
                              <div className="queue-user">
                                <a href={`tel:${r.phone}`}>
                                  <span>{r.name}</span> <span>({r.phone})</span>
                                </a>
                                <span className="queue-reputation">{formatReputation(r.reputation)}</span>
                              </div>
                              <div className="queue-actions">
                                <button
                                  type="button"
                                  className="btn sm lime"
                                  disabled={rowBusy}
                                  onClick={() => onRequestDecision(selectedMatch.id, r.userId, 'approve')}
                                >
                                  Duyệt
                                </button>
                                <button
                                  type="button"
                                  className="btn sm ghost"
                                  disabled={rowBusy}
                                  onClick={() => onRequestDecision(selectedMatch.id, r.userId, 'reject')}
                                >
                                  Từ chối
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}

            <section className="detail-chat">
              <h4>Trò chuyện trong trận</h4>
              <p className="dim small">Sắp ra mắt</p>
            </section>

            {detailError && (
              <p className="error bad" role="alert">
                {detailError}
              </p>
            )}
            {actionError && (
              <p className="error bad" role="alert">
                {actionError}
              </p>
            )}
          </div>

          <footer className="detail-f actions match-actions">
            <button type="button" className="btn ghost" onClick={onComingSoon}>
              Chia sẻ trận
            </button>
            {user && detail && detail.id === selectedMatch.id && (
              <>
                {detail.viewerRole === 'PLAYER' && (
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={loadingAction}
                    onClick={() => onLeave(selectedMatch.id)}
                  >
                    Rời trận
                  </button>
                )}
                {detail.viewerRole === 'NONE' &&
                  (detail.myRequest === 'REJECTED' ? (
                    <p className="hint">Host đã từ chối yêu cầu của bạn</p>
                  ) : selectedIsApproval && detail.myRequest === 'PENDING' ? (
                    <>
                      <p className="hint" role="status">
                        Đã gửi yêu cầu. Chờ host duyệt
                      </p>
                      <button
                        type="button"
                        className="btn ghost"
                        disabled={loadingAction}
                        onClick={() => onLeave(selectedMatch.id)}
                      >
                        Hủy yêu cầu
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn lime"
                      disabled={loadingAction}
                      onClick={() => onJoin(selectedMatch.id)}
                    >
                      {selectedIsApproval ? 'Xin vào' : 'Vào trận'}
                    </button>
                  ))}
              </>
            )}
          </footer>
        </div>
      ) : (
        <div className="card empty empty-detail-card">
          <EmptyState message="Chọn một trận bên danh sách để xem người tham gia và vào trận." />
        </div>
      )}
    </div>
  );
}
