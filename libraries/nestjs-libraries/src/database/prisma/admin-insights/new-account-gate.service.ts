import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import {
  isExcludedOrg,
} from '@gitroom/nestjs-libraries/admin-insights/exclusions';
import {
  NEW_ACCOUNT_API_DELAY_MS,
  NewAccountGate,
  newAccountApiGate,
} from '@gitroom/nestjs-libraries/admin-insights/new.account.gate';

// Asked by the Public API auth middleware for API-key requests. Workspaces
// older than 24 hours are allowed without touching the database.
@Injectable()
export class NewAccountGateService {
  constructor(
    private _integration: PrismaRepository<'integration'>,
    private _userOrg: PrismaRepository<'userOrganization'>
  ) {}

  async check(
    org: {
      id: string;
      createdAt: Date;
      subscription?: { isLifetime?: boolean | null } | null;
    },
    now: Date = new Date()
  ): Promise<NewAccountGate> {
    if (now.getTime() - new Date(org.createdAt).getTime() >= NEW_ACCOUNT_API_DELAY_MS) {
      return { allowed: true };
    }

    const [channelCount, superAdmin] = await Promise.all([
      this._integration.model.integration.count({
        where: { organizationId: org.id, deletedAt: null },
      }),
      this._userOrg.model.userOrganization.count({
        where: {
          organizationId: org.id,
          user: { isSuperAdmin: true, deletedAt: null },
        },
      }),
    ]);

    return newAccountApiGate({
      createdAt: org.createdAt,
      now,
      channelCount,
      exempt: isExcludedOrg({
        id: org.id,
        isLifetime: org.subscription?.isLifetime,
        hasSuperAdmin: superAdmin > 0,
      }),
    });
  }
}
