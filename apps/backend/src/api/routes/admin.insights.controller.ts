import {
  Controller,
  Get,
  HttpException,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { AdminInsightsService } from '@gitroom/nestjs-libraries/database/prisma/admin-insights/admin-insights.service';

// Date filters: "2026-11-01" or a full ISO time. A bare "to" date includes
// that whole day.
export const parseAdminDate = (value?: string, endOfDay = false) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpException('Invalid date', 400);
  }
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date;
};

// Super-admin only (User.isSuperAdmin, same check as AdminController).
@ApiTags('Admin')
@Controller('/admin/insights')
export class AdminInsightsController {
  constructor(private _insightsService: AdminInsightsService) {}

  private assertSuperAdmin(user: User) {
    if (!user?.isSuperAdmin) {
      throw new HttpException('Unauthorized', 400);
    }
  }

  @Get('/users')
  async users(
    @GetUserFromRequest() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('provider') provider?: string
  ) {
    this.assertSuperAdmin(user);
    return this._insightsService.users({
      page: Math.max(0, parseInt(page || '0', 10) || 0),
      limit: Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20)),
      search: search?.trim() || undefined,
      provider: provider?.trim().toUpperCase() || undefined,
    });
  }

  @Get('/funnel')
  async funnel(
    @GetUserFromRequest() user: User,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('provider') provider?: string
  ) {
    this.assertSuperAdmin(user);
    return this._insightsService.funnel({
      from: parseAdminDate(from),
      to: parseAdminDate(to, true),
      provider: provider?.trim().toUpperCase() || undefined,
    });
  }
}
