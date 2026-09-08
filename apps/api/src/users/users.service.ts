import { Injectable, NotFoundException } from '@nestjs/common';
import type { UpdateProfileRequest, UserProfile } from '@monsport/shared';
import type { PlayerSkill, User } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

type UserWithSkills = User & { skills: PlayerSkill[] };

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { skills: true },
    });
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng.');
    }
    return toProfile(user);
  }

  async updateProfile(userId: string, input: UpdateProfileRequest): Promise<UserProfile> {
    const { skills, ...fields } = input;

    const user = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: fields });

      if (skills) {
        // Client gui nguyen mang trinh do hien tai moi lan luu — upsert tung mon,
        // dua vao @@unique([userId, sport]) trong schema.prisma.
        await Promise.all(
          skills.map((skill) =>
            tx.playerSkill.upsert({
              where: { userId_sport: { userId, sport: skill.sport } },
              update: { level: skill.level },
              create: { userId, sport: skill.sport, level: skill.level },
            }),
          ),
        );
      }

      return tx.user.findUniqueOrThrow({ where: { id: userId }, include: { skills: true } });
    });

    return toProfile(user);
  }
}

function toProfile(user: UserWithSkills): UserProfile {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    role: user.role,
    skills: user.skills.map((skill) => ({ sport: skill.sport, level: skill.level })),
  };
}
