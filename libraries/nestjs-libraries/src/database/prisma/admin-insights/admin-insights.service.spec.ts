import { AdminInsightsService } from '@gitroom/nestjs-libraries/database/prisma/admin-insights/admin-insights.service';

const d = (iso: string) => new Date(iso);
const now = d('2026-11-02T12:00:00Z');

const user = (o: Record<string, any>) => ({
  id: 'u', email: 'a@gmail.com', providerName: 'LOCAL', activated: true, disabled: false,
  isSuperAdmin: false, createdAt: d('2026-10-20T10:00:00Z'), updatedAt: d('2026-10-20T11:00:00Z'),
  lastOnline: d('2026-11-01T10:00:00Z'), agent: 'Mozilla/5.0 Safari', ip: null, orgIds: ['o1'], ...o,
});

const empty = {
  integrations: [], postGroups: [], firstScheduled: [], firstPublished: [],
  superAdminOrgIds: [] as string[], subscriptions: [] as any[],
};

const repo = (users: any[], facts: any, ipCounts = new Map<string, number>()) => ({
  usersPage: jest.fn().mockResolvedValue({ items: users, total: users.length }),
  usersForFunnel: jest.fn().mockResolvedValue(users),
  orgFacts: jest.fn().mockResolvedValue({ ...empty, ...facts }),
  authorizationCounts: jest.fn().mockResolvedValue(new Map([['u', 2]])),
  ipCounts: jest.fn().mockResolvedValue(ipCounts),
});

describe('AdminInsightsService.users', () => {
  it('builds activation facts, risk and never returns an IP, agent or secret', async () => {
    const r = repo(
      [user({ ip: '203.0.113.9', agent: 'curl/8.4.0', email: 'x@mailinator.com' })],
      {
        integrations: [
          { organizationId: 'o1', createdAt: d('2026-10-21T10:00:00Z'), deletedAt: null },
          { organizationId: 'o1', createdAt: d('2026-10-22T10:00:00Z'), deletedAt: d('2026-10-23T10:00:00Z') },
        ],
        postGroups: [
          { organizationId: 'o1', creationMethod: 'WEB', count: 3, firstAt: d('2026-10-21T12:00:00Z') },
          { organizationId: 'o1', creationMethod: 'API', count: 2, firstAt: d('2026-10-24T12:00:00Z') },
        ],
        firstScheduled: [{ organizationId: 'o1', at: d('2026-10-21T12:00:00Z') }],
        firstPublished: [{ organizationId: 'o1', at: d('2026-10-21T13:00:00Z') }],
      },
      new Map([['203.0.113.9', 2]])
    );
    const out = await new AdminInsightsService(r as any).users({ page: 0, limit: 20 }, now);
    const row = out.items[0] as any;
    expect(row.channelCount).toBe(1);
    expect(row.firstChannelAt).toEqual(d('2026-10-21T10:00:00Z'));
    expect(row.postsByMethod).toMatchObject({ WEB: 3, API: 2, MCP: 0 });
    expect(row.mcpAuthorizations).toBe(2);
    expect(row.riskFlags).toEqual(['disposable_domain', 'scripted_user_agent', 'shared_ip']);
    expect(row.riskScore).toBe(75);
    const json = JSON.stringify(out);
    for (const secret of ['203.0.113.9', 'curl/8', 'password', 'apiKey', 'token', '"ip"', '"agent"']) {
      expect(json).not.toContain(secret);
    }
  });

  it('marks excluded workspaces with their reason', async () => {
    const out = await new AdminInsightsService(
      repo([user({})], { subscriptions: [{ organizationId: 'o1', isLifetime: true }] }) as any
    ).users({ page: 0, limit: 20 }, now);
    expect((out.items[0] as any).excluded).toEqual(['lifetime']);
  });
});

describe('AdminInsightsService.funnel', () => {
  const saved = process.env.ADMIN_EXCLUDE_ORGS;
  afterEach(() => {
    if (saved === undefined) delete process.env.ADMIN_EXCLUDE_ORGS;
    else process.env.ADMIN_EXCLUDE_ORGS = saved;
  });

  it('counts steps, leaves excluded workspaces out and says how many', async () => {
    process.env.ADMIN_EXCLUDE_ORGS = 'o9';
    const users = [
      user({ id: 'a', orgIds: ['o1'] }),
      user({ id: 'b', orgIds: ['o2'], activated: false }),
      user({ id: 'c', orgIds: ['o3'], isSuperAdmin: true }),
      user({ id: 'd', orgIds: ['o9'] }),
    ];
    const r = repo(users, {
      integrations: [{ organizationId: 'o1', createdAt: d('2026-10-21T10:00:00Z'), deletedAt: null }],
      firstScheduled: [{ organizationId: 'o1', at: d('2026-10-21T12:00:00Z') }],
      firstPublished: [{ organizationId: 'o1', at: d('2026-10-21T13:00:00Z') }],
      subscriptions: [{ organizationId: 'o1', isLifetime: false }],
    });
    const out = await new AdminInsightsService(r as any).funnel({ provider: 'LOCAL' });
    expect(out.steps.map((s) => [s.id, s.count])).toEqual([
      ['signed_up', 2], ['confirmed', 1], ['channel', 1], ['scheduled', 1], ['published', 1], ['paid', 1],
    ]);
    expect(out.excluded.total).toBe(2);
    expect(out.excluded.byReason).toMatchObject({ super_admin: 1, listed: 1 });
    expect(out.totalBeforeExclusions).toBe(4);
    expect(r.usersForFunnel).toHaveBeenCalledWith({ provider: 'LOCAL' });
  });
});
