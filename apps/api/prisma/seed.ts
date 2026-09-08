// Seed tối giản cho M0: chỉ đủ để chứng minh pipeline `prisma migrate reset`
// chạy lại được nhiều lần trên toàn bộ schema. Bộ dữ liệu đầy đủ theo
// docs/PROMPT.md mục 7 (40 user, 6 sân, 3 giải...) dựng dần theo từng mốc
// cần tới nó (M1 cần user thật để đăng nhập, M4/M5 cần giải...).
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

  const admin = await prisma.user.create({
    data: {
      zaloId: 'mock-admin',
      name: 'Nguyễn Văn Quân',
      role: 'ADMIN',
    },
  });

  const player = await prisma.user.create({
    data: {
      zaloId: 'mock-player-1',
      name: 'Trần Thị Bình',
      role: 'PLAYER',
      skills: {
        create: [{ sport: 'FOOTBALL', level: 'AVERAGE' }],
      },
    },
  });

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

  console.log('Seed tối giản M0 xong: 2 người dùng, 1 sân, 1 trận.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
