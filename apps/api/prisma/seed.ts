// Seed M1: nang tu 2 len 10 user (1 ADMIN + 2 ORGANIZER + 7 PLAYER), du de dang
// nhap thu nhieu vai va rai deu 4 muc trinh do (docs/quyet-dinh.md muc M1). Bo du
// lieu day du 40 user o docs/PROMPT.md muc 7 dung dan theo tung moc can toi no
// (Venue/Tournament thuc su o M2/M4).
import { PrismaClient, type Role, type Sport, type SkillLevel } from '@prisma/client';

const prisma = new PrismaClient();

interface SeedUser {
  zaloId: string;
  name: string;
  role: Role;
  skill?: { sport: Sport; level: SkillLevel };
}

const SEED_USERS: SeedUser[] = [
  {
    zaloId: 'mock-admin',
    name: 'Nguyễn Văn Quân',
    role: 'ADMIN',
    skill: { sport: 'FOOTBALL', level: 'STRONG' },
  },
  {
    zaloId: 'mock-player-1',
    name: 'Trần Thị Bình',
    role: 'PLAYER',
    skill: { sport: 'FOOTBALL', level: 'AVERAGE' },
  },
  {
    zaloId: 'mock-organizer-1',
    name: 'Lê Thị Hương',
    role: 'ORGANIZER',
    skill: { sport: 'BADMINTON', level: 'GOOD' },
  },
  {
    zaloId: 'mock-organizer-2',
    name: 'Phạm Văn Tùng',
    role: 'ORGANIZER',
    skill: { sport: 'FOOTBALL', level: 'STRONG' },
  },
  {
    zaloId: 'mock-player-2',
    name: 'Hoàng Văn Nam',
    role: 'PLAYER',
    skill: { sport: 'FOOTBALL', level: 'NEW' },
  },
  {
    zaloId: 'mock-player-3',
    name: 'Vũ Thị Lan',
    role: 'PLAYER',
    skill: { sport: 'VOLLEYBALL', level: 'GOOD' },
  },
  {
    zaloId: 'mock-player-4',
    name: 'Đặng Văn Hùng',
    role: 'PLAYER',
    skill: { sport: 'PICKLEBALL', level: 'STRONG' },
  },
  {
    zaloId: 'mock-player-5',
    name: 'Bùi Thị Mai',
    role: 'PLAYER',
    skill: { sport: 'BADMINTON', level: 'NEW' },
  },
  {
    zaloId: 'mock-player-6',
    name: 'Ngô Văn Sơn',
    role: 'PLAYER',
    skill: { sport: 'FOOTBALL', level: 'GOOD' },
  },
  {
    zaloId: 'mock-player-7',
    name: 'Đỗ Thị Thu',
    role: 'PLAYER',
    skill: { sport: 'VOLLEYBALL', level: 'AVERAGE' },
  },
];

async function clear(): Promise<void> {
  // Xóa theo thứ tự ngược với khóa ngoại để không vi phạm ràng buộc FK.
  await prisma.matchEvent.deleteMany();
  await prisma.fixture.deleteMany();
  await prisma.group.deleteMany();
  await prisma.player.deleteMany();
  await prisma.team.deleteMany();
  await prisma.tournament.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.matchEntry.deleteMany();
  await prisma.match.deleteMany();
  await prisma.court.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.playerSkill.deleteMany();
  await prisma.user.deleteMany();
}

async function main(): Promise<void> {
  await clear();

  const users = await Promise.all(
    SEED_USERS.map((seedUser) =>
      prisma.user.create({
        data: {
          zaloId: seedUser.zaloId,
          name: seedUser.name,
          role: seedUser.role,
          skills: seedUser.skill ? { create: [seedUser.skill] } : undefined,
        },
      }),
    ),
  );

  const admin = users.find((user) => user.zaloId === 'mock-admin');
  const player = users.find((user) => user.zaloId === 'mock-player-1');
  if (!admin || !player) {
    throw new Error('Seed lỗi: thiếu user mock-admin hoặc mock-player-1.');
  }

  const venue = await prisma.venue.create({
    data: {
      name: 'Sân bóng Đại Thắng',
      commune: 'Xã Đại Thắng',
      district: 'Huyện Đại Lộc',
      address: 'Thôn 1, Xã Đại Thắng',
      sports: ['FOOTBALL'],
      pricePerHour: 200_000,
      courts: {
        create: [{ name: 'Sân 1', sport: 'FOOTBALL' }],
      },
    },
    include: { courts: true },
  });

  const court = venue.courts[0];
  if (!court) {
    throw new Error('Seed lỗi: sân con vừa tạo không tồn tại.');
  }

  await prisma.match.create({
    data: {
      courtId: court.id,
      hostId: admin.id,
      sport: 'FOOTBALL',
      startAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      endAt: new Date(Date.now() + 25 * 60 * 60 * 1000),
      capacity: 14,
      pricePerSlot: 30_000,
      entries: {
        create: [{ userId: player.id }],
      },
    },
  });

  console.log(`Seed M1 xong: ${String(users.length)} người dùng, 1 sân, 1 trận.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
