import { Injectable, NotFoundException } from '@nestjs/common';
import {
  type FinancialChartPoint,
  type FinancialDashboardView,
  type FinancialPeriod,
  type FinancialQuery,
  minuteOfDayVN,
} from '@monsport/shared';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';

const VN_OFFSET_HOURS = 7;
const VN_OFFSET_MS = VN_OFFSET_HOURS * 60 * 60 * 1000;

function formatVN(d: Date): string {
  const vnTime = new Date(d.getTime() + VN_OFFSET_MS);
  return vnTime.toISOString().slice(0, 10);
}

function getVNParts(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { year: y, month: m, day: d };
}

function createVNMidnight(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, -VN_OFFSET_HOURS, 0, 0, 0));
}

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async getDashboard(ownerId: string, venueId: string, query: FinancialQuery): Promise<FinancialDashboardView> {
    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
      include: { courts: true },
    });
    if (!venue || venue.ownerId !== ownerId) {
      throw new NotFoundException('Không tìm thấy đơn vị');
    }

    const period: FinancialPeriod = query.period ?? 'week';
    const dateStr = query.date ?? formatVN(this.clock.now());

    const { year, month, day } = getVNParts(dateStr);
    const anchorMidnight = createVNMidnight(year, month, day);

    let startDate: Date;
    let endDate: Date;
    let totalDays: number;
    const chartSlots: { label: string; start: Date; end: Date }[] = [];

    if (period === 'day') {
      startDate = anchorMidnight;
      endDate = new Date(anchorMidnight.getTime() + 24 * 60 * 60 * 1000 - 1);
      totalDays = 1;

      const startHour = Math.floor(venue.opensAt / 60);
      const endHour = Math.ceil(venue.closesAt / 60);
      for (let h = startHour; h < endHour; h++) {
        const slotStart = new Date(startDate.getTime() + h * 60 * 60 * 1000);
        const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
        chartSlots.push({
          label: `${h.toString().padStart(2, '0')}:00`,
          start: slotStart,
          end: slotEnd,
        });
      }
    } else if (period === 'week') {
      const vnMidnightTime = new Date(anchorMidnight.getTime() + VN_OFFSET_MS);
      const dayOfWeek = vnMidnightTime.getUTCDay();
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

      startDate = new Date(anchorMidnight.getTime() - daysFromMonday * 24 * 60 * 60 * 1000);
      endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
      totalDays = 7;

      const dayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
      for (let i = 0; i < 7; i++) {
        const dayStart = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const dayVN = new Date(dayStart.getTime() + VN_OFFSET_MS);
        const dNum = dayVN.getUTCDate().toString().padStart(2, '0');
        const mNum = (dayVN.getUTCMonth() + 1).toString().padStart(2, '0');
        chartSlots.push({
          label: `${dayLabels[i]} ${dNum}/${mNum}`,
          start: dayStart,
          end: dayEnd,
        });
      }
    } else {
      startDate = createVNMidnight(year, month, 1);
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      endDate = new Date(createVNMidnight(year, month, lastDay).getTime() + 24 * 60 * 60 * 1000 - 1);
      totalDays = lastDay;

      for (let i = 1; i <= lastDay; i++) {
        const dayStart = createVNMidnight(year, month, i);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const dNum = i.toString().padStart(2, '0');
        const mNum = month.toString().padStart(2, '0');
        chartSlots.push({
          label: `${dNum}/${mNum}`,
          start: dayStart,
          end: dayEnd,
        });
      }
    }

    const bookings = await this.prisma.booking.findMany({
      where: {
        court: { venueId },
        startAt: { gte: startDate, lte: endDate },
      },
      include: {
        createdBy: {
          select: { phone: true },
        },
      },
    });

    const totalBookings = bookings.length;
    const confirmedBookings = bookings.filter((b) => b.status === 'CONFIRMED');
    const cancelledBookings = bookings.filter((b) => b.status === 'CANCELLED').length;
    const rejectedBookings = bookings.filter((b) => b.status === 'REJECTED').length;

    const paidBookings = confirmedBookings.filter((b) => b.paidAtVenue).length;
    const unpaidBookings = confirmedBookings.filter((b) => !b.paidAtVenue).length;

    const revenue = confirmedBookings
      .filter((b) => b.paidAtVenue)
      .reduce((sum, b) => sum + b.priceTotal, 0);

    let bookedHours = 0;
    let peakHours = 0;
    let normalHours = 0;

    for (const b of confirmedBookings) {
      const durationHours = (b.endAt.getTime() - b.startAt.getTime()) / (60 * 60 * 1000);
      bookedHours += durationHours;

      for (let t = b.startAt.getTime(); t < b.endAt.getTime(); t += 30 * 60 * 1000) {
        const minute = minuteOfDayVN(new Date(t));
        if (minute >= 17 * 60 && minute < 22 * 60) {
          peakHours += 0.5;
        } else {
          normalHours += 0.5;
        }
      }
    }

    const courtCount = venue.courts.length;
    const dailyOpenHours = Math.max(0, (venue.closesAt - venue.opensAt) / 60);
    const openingHours = courtCount * dailyOpenHours * totalDays;
    const occupancyRate = openingHours > 0 ? Number((bookedHours / openingHours).toFixed(4)) : 0;

    const cancellationRate = totalBookings > 0 ? Number((cancelledBookings / totalBookings).toFixed(4)) : 0;
    const rejectionRate = totalBookings > 0 ? Number((rejectedBookings / totalBookings).toFixed(4)) : 0;

    const phoneCounts = new Map<string, number>();
    for (const b of confirmedBookings) {
      const phone = b.source === 'PHONE' ? b.customerPhone : (b.createdBy?.phone ?? null);
      if (phone && phone.trim() !== '') {
        phoneCounts.set(phone, (phoneCounts.get(phone) ?? 0) + 1);
      }
    }

    const totalCustomers = phoneCounts.size;
    let returningCustomers = 0;
    for (const count of phoneCounts.values()) {
      if (count >= 2) returningCustomers++;
    }

    const chartData: FinancialChartPoint[] = chartSlots.map((slot) => {
      const slotBookings = confirmedBookings.filter(
        (b) => b.startAt.getTime() >= slot.start.getTime() && b.startAt.getTime() < slot.end.getTime(),
      );
      const slotRevenue = slotBookings.filter((b) => b.paidAtVenue).reduce((sum, b) => sum + b.priceTotal, 0);
      const slotBookedHours = slotBookings.reduce(
        (sum, b) => sum + (b.endAt.getTime() - b.startAt.getTime()) / (60 * 60 * 1000),
        0,
      );
      return {
        label: slot.label,
        revenue: slotRevenue,
        bookedHours: slotBookedHours,
        bookingCount: slotBookings.length,
      };
    });

    return {
      venueId: venue.id,
      venueName: venue.name,
      period,
      date: dateStr,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      revenue,
      totalBookings,
      paidBookings,
      unpaidBookings,
      bookedHours,
      openingHours,
      occupancyRate,
      peakHours,
      normalHours,
      cancelledBookings,
      rejectedBookings,
      cancellationRate,
      rejectionRate,
      totalCustomers,
      returningCustomers,
      chartData,
    };
  }
}
