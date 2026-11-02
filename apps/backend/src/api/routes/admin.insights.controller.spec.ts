jest.mock(
  '@gitroom/nestjs-libraries/database/prisma/admin-insights/admin-insights.service',
  () => ({ AdminInsightsService: class {} })
);

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  AdminInsightsController,
  parseAdminDate,
} from './admin.insights.controller';

describe('AdminInsightsController', () => {
  const service = {
    users: jest.fn().mockResolvedValue({ items: [] }),
    funnel: jest.fn().mockResolvedValue({ steps: [] }),
  };
  const controller = new AdminInsightsController(service as any);
  const owner: any = { id: 'o', isSuperAdmin: false, organizations: [{ role: 'SUPERADMIN' }] };
  const admin: any = { id: 'a', isSuperAdmin: true };

  it('refuses everyone who is not a platform admin, including a workspace Owner', async () => {
    await expect(Promise.resolve().then(() => controller.users(owner))).rejects.toBeDefined();
    await expect(Promise.resolve().then(() => controller.funnel(owner))).rejects.toBeDefined();
    await expect(Promise.resolve().then(() => controller.users(undefined as any))).rejects.toBeDefined();
    expect(service.users).not.toHaveBeenCalled();
    expect(service.funnel).not.toHaveBeenCalled();
  });

  it('every route starts with assertSuperAdmin and none checks the workspace role', () => {
    const source = readFileSync(join(__dirname, 'admin.insights.controller.ts'), 'utf8');
    const bodies = source.split(/@(?:Get|Post|Put|Patch|Delete)\(/).slice(1);
    expect(bodies.length).toBe(2);
    for (const body of bodies) {
      expect(body).toMatch(/this\.assertSuperAdmin\(user\)/);
    }
    expect(source).not.toMatch(/['"]SUPERADMIN['"]|Role\.SUPERADMIN/);
  });

  it('passes clamped paging and the provider filter to the service', async () => {
    await controller.users(admin, '2', '5000', ' me@x.com ', 'local');
    expect(service.users).toHaveBeenCalledWith({
      page: 2, limit: 100, search: 'me@x.com', provider: 'LOCAL',
    });
  });

  it('passes a date range, with the last day included', async () => {
    await controller.funnel(admin, '2026-10-01', '2026-10-31', 'google');
    const arg = service.funnel.mock.calls[0][0];
    expect(arg.from.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(arg.to.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(arg.provider).toBe('GOOGLE');
  });

  it('rejects a bad date', () => {
    expect(() => parseAdminDate('not-a-date')).toThrow();
    expect(parseAdminDate(undefined)).toBeUndefined();
  });
});
