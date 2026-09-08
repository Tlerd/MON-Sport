import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthProvider, ExternalIdentity } from '@monsport/shared';
import { PrismaService } from '../../common/prisma/prisma.service';

// Ban cai dat cu the dau tien cua cong AuthProvider (docs/PROMPT.md muc 1.3).
// "externalId" mo phong id Zalo — o day chinh la User.zaloId da seed san.
@Injectable()
export class MockZaloProvider implements AuthProvider {
  constructor(private readonly prisma: PrismaService) {}

  async resolveIdentity(credential: { externalId: string }): Promise<ExternalIdentity> {
    const user = await this.prisma.user.findUnique({
      where: { zaloId: credential.externalId },
    });
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản mock với zaloId này.');
    }

    return {
      externalId: user.zaloId,
      name: user.name,
      avatarUrl: user.avatarUrl ?? undefined,
    };
  }
}
