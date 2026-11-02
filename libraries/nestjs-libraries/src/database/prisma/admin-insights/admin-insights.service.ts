import { Injectable } from '@nestjs/common';
import {
  AdminInsightsRepository,
  FunnelParams,
  InsightsUsersParams,
  OrgFacts,
  UserBase,
} from '@gitroom/nestjs-libraries/database/prisma/admin-insights/admin-insights.repository';
import {
  ExclusionReason,
  exclusionReasons,
} from '@gitroom/nestjs-libraries/admin-insights/exclusions';
import { buildFunnel } from '@gitroom/nestjs-libraries/admin-insights/funnel';
import { riskFor } from '@gitroom/nestjs-libraries/admin-insights/risk.flags';

const METHODS = ['WEB', 'API', 'MCP', 'CLI', 'AUTOPOST', 'UNKNOWN'] as const;
const API_METHODS = ['API', 'MCP', 'CLI'];

const earliest = (dates: Array<Date | null | undefined>): Date | null => {
  const real = dates.filter((d): d is Date => !!d);
  return real.length
    ? new Date(Math.min(...real.map((d) => new Date(d).getTime())))
    : null;
};

// Per-user facts from the workspaces they belong to
const userFacts = (user: UserBase, facts: OrgFacts, env = process.env) => {
  const mine = new Set(user.orgIds);
  const integrations = facts.integrations.filter((i) => mine.has(i.organizationId));
  const groups = facts.postGroups.filter((g) => mine.has(g.organizationId));
  const postsByMethod: Record<string, number> = {};
  for (const m of METHODS) postsByMethod[m] = 0;
  for (const g of groups) {
    postsByMethod[g.creationMethod] =
      (postsByMethod[g.creationMethod] || 0) + g.count;
  }

  const reasons = new Set<ExclusionReason>();
  for (const orgId of user.orgIds) {
    const sub = facts.subscriptions.find((s) => s.organizationId === orgId);
    for (const r of exclusionReasons(
      {
        id: orgId,
        isLifetime: sub?.isLifetime,
        hasSuperAdmin: facts.superAdminOrgIds.includes(orgId),
      },
      env
    )) {
      reasons.add(r);
    }
  }
  if (user.isSuperAdmin) reasons.add('super_admin');

  return {
    channelCount: integrations.filter((i) => !i.deletedAt).length,
    firstChannelAt: earliest(integrations.map((i) => i.createdAt)),
    postCount: Object.values(postsByMethod).reduce((a, b) => a + b, 0),
    postsByMethod,
    firstApiActionAt: earliest(
      groups.filter((g) => API_METHODS.includes(g.creationMethod)).map((g) => g.firstAt)
    ),
    firstScheduledAt: earliest(
      facts.firstScheduled.filter((f) => mine.has(f.organizationId)).map((f) => f.at)
    ),
    firstPublishedAt: earliest(
      facts.firstPublished.filter((f) => mine.has(f.organizationId)).map((f) => f.at)
    ),
    paid: facts.subscriptions.some((s) => mine.has(s.organizationId)),
    excluded: [...reasons],
  };
};

@Injectable()
export class AdminInsightsService {
  constructor(private _repo: AdminInsightsRepository) {}

  // GET /admin/insights/users: never returns tokens, passwords, API keys or
  // IP addresses; the address is used only to compute the "shared IP" flag.
  async users(params: InsightsUsersParams, now: Date = new Date()) {
    const { items, total } = await this._repo.usersPage(params);
    const orgIds = [...new Set(items.flatMap((u) => u.orgIds))];
    const ips = [...new Set(items.map((u) => u.ip).filter((ip): ip is string => !!ip))];
    const [facts, authCounts, ipCounts] = await Promise.all([
      this._repo.orgFacts(orgIds),
      this._repo.authorizationCounts(items.map((u) => u.id)),
      this._repo.ipCounts(ips),
    ]);

    return {
      total,
      page: params.page,
      limit: params.limit,
      items: items.map((u) => {
        const f = userFacts(u, facts);
        const risk = riskFor({
          email: u.email,
          agent: u.agent,
          ip: u.ip,
          otherUsersWithSameIp: Math.max(0, (u.ip ? ipCounts.get(u.ip) || 0 : 0) - 1),
          providerName: u.providerName,
          activated: u.activated,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
          channelCount: f.channelCount,
          postCount: f.postCount,
          firstApiActionAt: f.firstApiActionAt,
          now,
        });
        return {
          id: u.id,
          email: u.email,
          providerName: u.providerName,
          activated: u.activated,
          disabled: u.disabled,
          isSuperAdmin: u.isSuperAdmin,
          createdAt: u.createdAt,
          lastOnline: u.lastOnline,
          channelCount: f.channelCount,
          firstChannelAt: f.firstChannelAt,
          firstScheduledAt: f.firstScheduledAt,
          firstPublishedAt: f.firstPublishedAt,
          postsByMethod: f.postsByMethod,
          mcpAuthorizations: authCounts.get(u.id) || 0,
          riskScore: risk.score,
          riskFlags: risk.flags,
          excluded: f.excluded,
        };
      }),
    };
  }

  // GET /admin/insights/funnel: excluded workspaces are left out and counted.
  async funnel(params: FunnelParams) {
    const everyone = await this._repo.usersForFunnel(params);
    const facts = await this._repo.orgFacts([
      ...new Set(everyone.flatMap((u) => u.orgIds)),
    ]);

    const counted: Array<ReturnType<typeof userFacts> & { u: UserBase }> = [];
    const byReason: Record<string, number> = {};
    let excluded = 0;
    for (const u of everyone) {
      const f = userFacts(u, facts);
      if (f.excluded.length) {
        excluded++;
        for (const r of f.excluded) byReason[r] = (byReason[r] || 0) + 1;
        continue;
      }
      counted.push({ ...f, u });
    }

    return {
      from: params.from ?? null,
      to: params.to ?? null,
      provider: params.provider ?? null,
      steps: buildFunnel(
        counted.map((c) => ({
          confirmed: c.u.activated,
          channel: !!c.firstChannelAt,
          scheduled: !!c.firstScheduledAt,
          published: !!c.firstPublishedAt,
          paid: c.paid,
        }))
      ),
      excluded: { total: excluded, byReason },
      totalBeforeExclusions: everyone.length,
    };
  }
}
