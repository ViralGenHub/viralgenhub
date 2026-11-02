import { Injectable } from '@nestjs/common';
import { CreationMethod, Provider, State } from '@prisma/client';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

export interface InsightsUsersParams {
  page: number;
  limit: number;
  search?: string;
  provider?: string;
}

export interface FunnelParams {
  from?: Date;
  to?: Date;
  provider?: string;
}

export interface UserBase {
  id: string;
  email: string;
  providerName: string;
  activated: boolean;
  disabled: boolean;
  isSuperAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastOnline: Date | null;
  // only ever used inside the service to compute flags; never returned
  agent: string | null;
  ip: string | null;
  orgIds: string[];
}

export interface OrgFacts {
  integrations: Array<{ organizationId: string; createdAt: Date; deletedAt: Date | null }>;
  postGroups: Array<{
    organizationId: string;
    creationMethod: string;
    count: number;
    firstAt: Date | null;
  }>;
  firstScheduled: Array<{ organizationId: string; at: Date | null }>;
  firstPublished: Array<{ organizationId: string; at: Date | null }>;
  superAdminOrgIds: string[];
  subscriptions: Array<{ organizationId: string; isLifetime: boolean }>;
}

// Read-only queries for the super-admin Insights and Funnel pages. Selects
// never include tokens, passwords or API keys.
@Injectable()
export class AdminInsightsRepository {
  constructor(
    private _user: PrismaRepository<'user'>,
    private _integration: PrismaRepository<'integration'>,
    private _post: PrismaRepository<'post'>,
    private _userOrg: PrismaRepository<'userOrganization'>,
    private _subscription: PrismaRepository<'subscription'>,
    private _oauth: PrismaRepository<'oAuthAuthorization'>
  ) {}

  private providerFilter(provider?: string) {
    return provider && provider in Provider
      ? { providerName: provider as Provider }
      : {};
  }

  private toBase(u: any): UserBase {
    return {
      id: u.id,
      email: u.email,
      providerName: u.providerName,
      activated: u.activated,
      disabled: u.disabled,
      isSuperAdmin: u.isSuperAdmin,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      lastOnline: u.lastOnline ?? null,
      agent: u.agent ?? null,
      ip: u.ip ?? null,
      orgIds: (u.organizations || []).map((o: any) => o.organizationId),
    };
  }

  private readonly select = {
    id: true,
    email: true,
    providerName: true,
    activated: true,
    disabled: true,
    isSuperAdmin: true,
    createdAt: true,
    updatedAt: true,
    lastOnline: true,
    agent: true,
    ip: true,
    organizations: {
      where: { organization: { deletedAt: null } },
      select: { organizationId: true },
    },
  } as const;

  async usersPage(params: InsightsUsersParams) {
    const where = {
      deletedAt: null,
      ...this.providerFilter(params.provider),
      ...(params.search
        ? {
            email: { contains: params.search, mode: 'insensitive' as const },
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this._user.model.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.page * params.limit,
        take: params.limit,
        select: this.select,
      }),
      this._user.model.user.count({ where }),
    ]);
    return { items: rows.map((r) => this.toBase(r)), total };
  }

  async usersForFunnel(params: FunnelParams) {
    const rows = await this._user.model.user.findMany({
      where: {
        deletedAt: null,
        ...this.providerFilter(params.provider),
        ...(params.from || params.to
          ? {
              createdAt: {
                ...(params.from ? { gte: params.from } : {}),
                ...(params.to ? { lt: params.to } : {}),
              },
            }
          : {}),
      },
      select: this.select,
    });
    return rows.map((r) => this.toBase(r));
  }

  async orgFacts(orgIds: string[]): Promise<OrgFacts> {
    if (!orgIds.length) {
      return {
        integrations: [],
        postGroups: [],
        firstScheduled: [],
        firstPublished: [],
        superAdminOrgIds: [],
        subscriptions: [],
      };
    }
    const inOrgs = { in: orgIds };
    const livePosts = {
      organizationId: inOrgs,
      deletedAt: null,
      parentPostId: null,
    };
    const [integrations, groups, scheduled, published, superAdmins, subs] =
      await Promise.all([
        this._integration.model.integration.findMany({
          where: { organizationId: inOrgs },
          select: { organizationId: true, createdAt: true, deletedAt: true },
        }),
        this._post.model.post.groupBy({
          by: ['organizationId', 'creationMethod'],
          where: livePosts,
          _count: { _all: true },
          _min: { createdAt: true },
        }),
        this._post.model.post.groupBy({
          by: ['organizationId'],
          where: {
            ...livePosts,
            state: { in: [State.QUEUE, State.PUBLISHED, State.ERROR] },
          },
          _min: { createdAt: true },
        }),
        this._post.model.post.groupBy({
          by: ['organizationId'],
          where: { ...livePosts, state: State.PUBLISHED },
          _min: { publishDate: true },
        }),
        this._userOrg.model.userOrganization.findMany({
          where: {
            organizationId: inOrgs,
            user: { isSuperAdmin: true, deletedAt: null },
          },
          select: { organizationId: true },
        }),
        this._subscription.model.subscription.findMany({
          where: { organizationId: inOrgs, deletedAt: null },
          select: { organizationId: true, isLifetime: true },
        }),
      ]);

    return {
      integrations,
      postGroups: groups.map((g) => ({
        organizationId: g.organizationId,
        creationMethod: g.creationMethod as CreationMethod,
        count: g._count._all,
        firstAt: g._min.createdAt ?? null,
      })),
      firstScheduled: scheduled.map((g) => ({
        organizationId: g.organizationId,
        at: g._min.createdAt ?? null,
      })),
      firstPublished: published.map((g) => ({
        organizationId: g.organizationId,
        at: g._min.publishDate ?? null,
      })),
      superAdminOrgIds: superAdmins.map((s) => s.organizationId),
      subscriptions: subs,
    };
  }

  // MCP / OAuth-app authorisations per user (how many times they approved one)
  async authorizationCounts(userIds: string[]) {
    if (!userIds.length) return new Map<string, number>();
    const rows = await this._oauth.model.oAuthAuthorization.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds } },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.userId, r._count._all] as [string, number]));
  }

  // How many (non-deleted) accounts hold each address
  async ipCounts(ips: string[]) {
    if (!ips.length) return new Map<string, number>();
    const rows = await this._user.model.user.groupBy({
      by: ['ip'],
      where: { ip: { in: ips }, deletedAt: null },
      _count: { _all: true },
    });
    return new Map(
      rows
        .filter((r) => r.ip)
        .map((r) => [r.ip as string, r._count._all] as [string, number])
    );
  }
}
