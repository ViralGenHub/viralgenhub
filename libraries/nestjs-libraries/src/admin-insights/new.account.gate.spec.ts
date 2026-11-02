import { newAccountApiGate } from '@gitroom/nestjs-libraries/admin-insights/new.account.gate';
import { NewAccountGateService } from '@gitroom/nestjs-libraries/database/prisma/admin-insights/new-account-gate.service';

const H = 3600 * 1000;
const now = new Date('2026-11-02T12:00:00Z');
const ago = (h: number) => new Date(now.getTime() - h * H);

describe('newAccountApiGate', () => {
  it('refuses a 2 hour old workspace with no channel, and says when it opens', () => {
    const r = newAccountApiGate({ createdAt: ago(2), now, channelCount: 0, exempt: false });
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.availableAt.toISOString()).toBe('2026-11-03T10:00:00.000Z');
      expect(r.msg).toContain('2026-11-03T10:00:00.000Z');
      expect(r.msg).toContain('24 hours');
    }
  });

  it('allows once a channel is connected', () => {
    expect(newAccountApiGate({ createdAt: ago(2), now, channelCount: 1, exempt: false }).allowed).toBe(true);
  });

  it('allows after 24 hours', () => {
    expect(newAccountApiGate({ createdAt: ago(24), now, channelCount: 0, exempt: false }).allowed).toBe(true);
  });

  it('allows an exempt workspace', () => {
    expect(newAccountApiGate({ createdAt: ago(1), now, channelCount: 0, exempt: true }).allowed).toBe(true);
  });
});

describe('NewAccountGateService', () => {
  const make = (channels: number, superAdmins: number) => {
    const integration = { model: { integration: { count: jest.fn().mockResolvedValue(channels) } } };
    const userOrg = { model: { userOrganization: { count: jest.fn().mockResolvedValue(superAdmins) } } };
    return { svc: new NewAccountGateService(integration as any, userOrg as any), integration, userOrg };
  };
  const saved = process.env.PREVIEW_ORGS;
  afterEach(() => {
    if (saved === undefined) delete process.env.PREVIEW_ORGS;
    else process.env.PREVIEW_ORGS = saved;
  });

  it('does not query for an old workspace', async () => {
    const { svc, integration } = make(0, 0);
    await expect(svc.check({ id: 'o', createdAt: ago(48) }, now)).resolves.toEqual({ allowed: true });
    expect(integration.model.integration.count).not.toHaveBeenCalled();
  });

  it('refuses a new workspace with no channel', async () => {
    const { svc } = make(0, 0);
    expect((await svc.check({ id: 'o', createdAt: ago(1) }, now)).allowed).toBe(false);
  });

  it('exempts a workspace with a platform super admin', async () => {
    const { svc } = make(0, 1);
    expect((await svc.check({ id: 'o', createdAt: ago(1) }, now)).allowed).toBe(true);
  });

  it('exempts PREVIEW_ORGS and lifetime workspaces', async () => {
    process.env.PREVIEW_ORGS = 'o';
    expect((await make(0, 0).svc.check({ id: 'o', createdAt: ago(1) }, now)).allowed).toBe(true);
    delete process.env.PREVIEW_ORGS;
    expect(
      (await make(0, 0).svc.check({ id: 'p', createdAt: ago(1), subscription: { isLifetime: true } }, now)).allowed
    ).toBe(true);
  });
});
