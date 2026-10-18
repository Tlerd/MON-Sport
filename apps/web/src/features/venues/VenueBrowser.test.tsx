import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VenueBrowser } from './VenueBrowser.tsx';

const COURT_1 = '0199a1b2-0000-7000-8000-000000000002';
const COURT_B = '0199a1b2-0000-7000-8000-000000000012';
const venue = (id: string, name: string, phone: string, closesAt: number, courts: { id: string; name: string }[]) => ({
  id, name, address: 'A', phone, opensAt: 360, closesAt,
  courts: courts.map((c) => ({ ...c, sport: 'BADMINTON', priceNormal: 80_000, pricePeak: 120_000 })),
});
const VENUES = [
  venue('0199a1b2-0000-7000-8000-000000000001', 'Cầu lông A', '0912345678', 1380, [{ id: COURT_1, name: 'Sân 1' }, { id: '0199a1b2-0000-7000-8000-000000000004', name: 'Sân 2' }]),
  venue('0199a1b2-0000-7000-8000-000000000011', 'Cầu lông B', '0912345679', 1440, [{ id: COURT_B, name: 'Sân 1' }]),
];
const COURT_C = '0199a1b2-0000-7000-8000-000000000022';
VENUES.push(venue('0199a1b2-0000-7000-8000-000000000021', 'Bóng đá C', '0912345680', 1380, [{ id: COURT_C, name: 'Sân Đông' }]));
const NOTICE = 'App mới ra mắt. Hãy gọi chủ sân và xem kỹ thông tin trước khi đặt.';
const vn = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+07:00`).toISOString();

type Reply = [number, unknown];
function stubApi(availability: (url: string) => Reply | Promise<Reply>) {
  const fetch = vi.fn(async (url: string) => {
    const [status, json] = url === '/api/venues' ? ([200, VENUES] as Reply) : await availability(url);
    return { ok: status < 400, status, json: () => Promise.resolve(json) };
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
const availability = (courtId: string, date: string, free: { startAt: string; endAt: string }[]): Reply => [200, { courtId, date, opensAt: 360, closesAt: 1380, free }];

async function pick(venueName: string, court: string, date: string) {
  const venueSelect = await screen.findByLabelText('Chọn đơn vị');
  await screen.findByRole('option', { name: venueName });
  fireEvent.change(venueSelect, { target: { value: VENUES.find((v) => v.name === venueName)!.id } });
  fireEvent.change(screen.getByLabelText('Chọn sân'), { target: { value: VENUES.flatMap((v) => v.courts).find((c) => c.name === court && c.id === (venueName === 'Cầu lông A' ? COURT_1 : COURT_B))!.id } });
  fireEvent.change(screen.getByLabelText('Chọn ngày'), { target: { value: date } });
}

describe('VenueBrowser', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('AC-11: a guest picks Sân 1 and 20/11/2026, and sees two free ranges with a tel: link, but not 19:00–20:00', async () => {
    const fetch = stubApi(() => availability(COURT_1, '2026-11-20', [
      { startAt: vn('2026-11-20', '10:30'), endAt: vn('2026-11-20', '19:00') },
      { startAt: vn('2026-11-20', '20:00'), endAt: vn('2026-11-20', '23:00') },
    ]));
    render(<VenueBrowser notice />);
    expect(screen.getByText(NOTICE)).toBeTruthy();
    await pick('Cầu lông A', 'Sân 1', '2026-11-20');

    const items = await screen.findAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([expect.stringContaining('10:30–19:00'), expect.stringContaining('20:00–23:00')]);
    for (const li of items) {
      const link = within(li).getByRole('link', { name: 'Gọi chủ sân 0912345678' });
      expect(link.getAttribute('href')).toBe('tel:0912345678');
    }
    expect(screen.queryByText(/19:00–20:00/)).toBeNull();
    expect(fetch).toHaveBeenCalledWith(`/api/courts/${COURT_1}/availability?date=2026-11-20`, expect.anything());
  });

  it('AC-12: no free range shows the sentence and no call link', async () => {
    stubApi(() => availability(COURT_1, '2026-11-20', []));
    render(<VenueBrowser notice />);
    await pick('Cầu lông A', 'Sân 1', '2026-11-20');

    const status = await screen.findByText('Hết giờ trống trong ngày này. Hãy chọn ngày khác.');
    expect(status.closest('[role="status"]')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Gọi chủ sân/ })).toBeNull();
  });

  it('AC-13: a 500 after a good load shows an alert and clears the old list', async () => {
    stubApi((url) => (url.endsWith('date=2026-11-20')
      ? availability(COURT_1, '2026-11-20', [{ startAt: vn('2026-11-20', '10:30'), endAt: vn('2026-11-20', '19:00') }])
      : [500, { message: 'Có lỗi, hãy thử lại' }]));
    render(<VenueBrowser notice />);
    await pick('Cầu lông A', 'Sân 1', '2026-11-20');
    expect(await screen.findByText(/10:30–19:00/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Chọn ngày'), { target: { value: '2026-11-21' } });
    expect((await screen.findByRole('alert')).textContent).toBe('Không tải được giờ trống');
    expect(screen.queryByText(/10:30–19:00/)).toBeNull();
  });

  it('AC-13: after a 500, a new pick clears the alert', async () => {
    stubApi(() => [500, { message: 'Có lỗi, hãy thử lại' }]);
    render(<VenueBrowser notice />);
    await pick('Cầu lông A', 'Sân 1', '2026-11-20');
    expect(await screen.findByRole('alert')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Chọn ngày'), { target: { value: '' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('AC-11: the live region says how many ranges are free', async () => {
    stubApi(() => availability(COURT_1, '2026-11-20', [
      { startAt: vn('2026-11-20', '10:30'), endAt: vn('2026-11-20', '19:00') },
      { startAt: vn('2026-11-20', '20:00'), endAt: vn('2026-11-20', '23:00') },
    ]));
    render(<VenueBrowser notice />);
    await pick('Cầu lông A', 'Sân 1', '2026-11-20');

    expect((await screen.findByText('Có 2 khoảng giờ trống.')).closest('[role="status"]')).toBeTruthy();
  });

  it('AC-13: a late answer for an earlier pick does not replace the list of the newer pick', async () => {
    let releaseFirst!: () => void;
    const first = new Promise<void>((resolve) => (releaseFirst = resolve));
    stubApi(async (url) => {
      if (url.endsWith('date=2026-11-20')) {
        await first;
        return availability(COURT_1, '2026-11-20', [{ startAt: vn('2026-11-20', '10:30'), endAt: vn('2026-11-20', '19:00') }]);
      }
      return availability(COURT_1, '2026-11-21', [{ startAt: vn('2026-11-21', '06:00'), endAt: vn('2026-11-21', '09:00') }]);
    });
    render(<VenueBrowser notice />);
    await pick('Cầu lông A', 'Sân 1', '2026-11-20');
    fireEvent.change(screen.getByLabelText('Chọn ngày'), { target: { value: '2026-11-21' } });
    expect(await screen.findByText(/06:00–09:00/)).toBeTruthy();

    releaseFirst();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await waitFor(() => expect(screen.queryByText(/10:30–19:00/)).toBeNull());
    expect(screen.getByText(/06:00–09:00/)).toBeTruthy();
  });

  it('AC-15: a range that ends at 00:00 of the next day shows 24:00', async () => {
    stubApi(() => availability(COURT_B, '2026-11-21', [{ startAt: vn('2026-11-21', '08:00'), endAt: '2026-11-21T17:00:00.000Z' }]));
    render(<VenueBrowser notice />);
    await pick('Cầu lông B', 'Sân 1', '2026-11-21');

    expect((await screen.findByRole('listitem')).textContent).toContain('08:00–24:00');
    expect(screen.getByRole('link', { name: 'Gọi chủ sân 0912345679' })).toBeTruthy();
  });

  it('AC-14: without the notice prop, the notice does not show', async () => {
    stubApi(() => availability(COURT_1, '2026-11-20', []));
    render(<VenueBrowser />);
    await screen.findByLabelText('Chọn đơn vị');
    expect(screen.queryByText(NOTICE)).toBeNull();
  });
});

describe('VenueBrowser search by court name', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  async function open() {
    stubApi(() => availability(COURT_1, '2026-11-20', [{ startAt: vn('2026-11-20', '10:30'), endAt: vn('2026-11-20', '19:00') }]));
    render(<VenueBrowser notice />);
    await screen.findByRole('option', { name: 'Cầu lông A' });
    return screen.getByLabelText('Tìm theo tên sân') as HTMLInputElement;
  }
  const type = (box: HTMLInputElement, text: string) => fireEvent.change(box, { target: { value: text } });
  const results = () => within(screen.getByRole('list', { name: 'Kết quả tìm sân' }));

  it('AC-1: "Sân 1" lists Cầu lông A and Cầu lông B with their courts, and not Bóng đá C', async () => {
    type(await open(), 'Sân 1');

    const buttons = results().getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual([expect.stringContaining('Cầu lông A'), expect.stringContaining('Cầu lông B')]);
    expect(buttons[0].textContent).toContain('Sân 1');
    expect(results().queryByText(/Bóng đá C/)).toBeNull();
  });

  it('AC-2: "san 1" and "SÂN 1" give the same list, and "san dong" finds Bóng đá C with Sân Đông', async () => {
    const box = await open();
    type(box, 'san 1');
    const first = results().getAllByRole('button').map((b) => b.textContent);
    type(box, 'SÂN 1');
    expect(results().getAllByRole('button').map((b) => b.textContent)).toEqual(first);
    type(box, 'san dong');
    const only = results().getAllByRole('button');
    expect(only).toHaveLength(1);
    expect(only[0].textContent).toContain('Bóng đá C');
    expect(only[0].textContent).toContain('Sân Đông');
  });

  it('AC-3: a click on a result sets the venue, lists its courts with none picked, focuses "Chọn sân", and keeps the search', async () => {
    const box = await open();
    type(box, 'Sân 1');
    fireEvent.click(results().getByRole('button', { name: /Cầu lông A/ }));

    expect((screen.getByLabelText('Chọn đơn vị') as HTMLSelectElement).selectedOptions[0].textContent).toBe('Cầu lông A');
    const court = screen.getByLabelText('Chọn sân') as HTMLSelectElement;
    expect([...court.options].map((o) => o.textContent)).toEqual(['Chọn sân', 'Sân 1', 'Sân 2']);
    expect(court.value).toBe('');
    await waitFor(() => expect(document.activeElement).toBe(court));
    expect(box.value).toBe('Sân 1');
    expect(results().getAllByRole('button')).toHaveLength(2);
  });

  it('AC-4: "xyz" shows the sentence in a status region and no result', async () => {
    type(await open(), 'xyz');

    const note = screen.getByText('Không có sân nào tên như vậy');
    expect(note.closest('[role="status"]')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Kết quả tìm sân' })).toBeNull();
  });

  it('AC-5: clearing the box, and spaces only, show no result and no sentence', async () => {
    const box = await open();
    type(box, 'Sân 1');
    type(box, '');
    expect(screen.queryByRole('list', { name: 'Kết quả tìm sân' })).toBeNull();
    type(box, '   ');
    expect(screen.queryByRole('list', { name: 'Kết quả tìm sân' })).toBeNull();
    expect(screen.queryByText('Không có sân nào tên như vậy')).toBeNull();
  });

  it('AC-6: a click on another venue resets the court and the free ranges, and keeps the date and shows no alert', async () => {
    const box = await open();
    await pick('Cầu lông A', 'Sân 1', '2026-11-20');
    expect(await screen.findByText(/10:30–19:00/)).toBeTruthy();

    type(box, 'Sân Đông');
    fireEvent.click(results().getByRole('button', { name: /Bóng đá C/ }));

    expect((screen.getByLabelText('Chọn đơn vị') as HTMLSelectElement).selectedOptions[0].textContent).toBe('Bóng đá C');
    expect((screen.getByLabelText('Chọn sân') as HTMLSelectElement).value).toBe('');
    expect(screen.queryByText(/10:30–19:00/)).toBeNull();
    expect((screen.getByLabelText('Chọn ngày') as HTMLInputElement).value).toBe('2026-11-20');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('AC-8: two clicks on the venue that is picked reset the court and move focus each time', async () => {
    const box = await open();
    await pick('Cầu lông A', 'Sân 1', '2026-11-20');
    expect(await screen.findByText(/10:30–19:00/)).toBeTruthy();
    type(box, 'Sân 1');

    for (let click = 0; click < 2; click++) {
      fireEvent.click(results().getByRole('button', { name: /Cầu lông A/ }));
      const court = screen.getByLabelText('Chọn sân') as HTMLSelectElement;
      await waitFor(() => expect(document.activeElement).toBe(court));
      expect(court.value).toBe('');
      expect(screen.queryByText(/10:30–19:00/)).toBeNull();
      expect((screen.getByLabelText('Chọn ngày') as HTMLInputElement).value).toBe('2026-11-20');
      (document.activeElement as HTMLElement).blur();
    }
  });
});
