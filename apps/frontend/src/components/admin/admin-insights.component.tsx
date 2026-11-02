'use client';

import React, { FC, useCallback, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Button } from '@gitroom/react/form/button';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import {
  RISK_FLAGS,
  RiskFlagId,
} from '@gitroom/nestjs-libraries/admin-insights/risk.flag.defs';

// Shape of GET /admin/insights/users (admin-insights.service.ts). It carries
// no tokens, passwords, API keys or IP addresses.
interface InsightRow {
  id: string;
  email: string;
  providerName: string;
  activated: boolean;
  disabled: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
  lastOnline: string | null;
  channelCount: number;
  firstChannelAt: string | null;
  firstScheduledAt: string | null;
  firstPublishedAt: string | null;
  postsByMethod: Record<string, number>;
  mcpAuthorizations: number;
  riskScore: number;
  riskFlags: RiskFlagId[];
  excluded: string[];
}

interface InsightsResponse {
  items: InsightRow[];
  total: number;
  page: number;
  limit: number;
}

const PROVIDERS = ['LOCAL', 'GOOGLE', 'GITHUB', 'APPLE', 'FARCASTER', 'GENERIC'];
const METHODS: Array<[string, string]> = [
  ['WEB', 'Web'],
  ['API', 'API'],
  ['MCP', 'MCP'],
  ['CLI', 'CLI'],
  ['AUTOPOST', 'Auto'],
];

const GRID =
  'grid grid-cols-[minmax(180px,1.4fr)_90px_130px_110px_130px_130px_150px_70px_190px] gap-[12px]';

const day = (value: string | null) =>
  value ? new Date(value).toLocaleDateString() : '—';

const scoreClass = (score: number) =>
  score >= 60
    ? 'bg-red-900/60 text-red-300'
    : score >= 25
    ? 'bg-amber-900/60 text-amber-300'
    : 'bg-green-900/60 text-green-300';

export const AdminInsightsComponent: FC = () => {
  const t = useT();
  const user = useUser();
  const fetch = useFetch();

  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [provider, setProvider] = useState('');
  const [hideExcluded, setHideExcluded] = useState(false);

  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(search ? { search } : {}),
    ...(provider ? { provider } : {}),
  });
  const { data, isLoading, error } = useSWR<InsightsResponse>(
    `/admin/insights/users?${query.toString()}`,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to load insights');
      }
      return res.json();
    }
  );

  const onApplySearch = useCallback(() => {
    setPage(0);
    setSearch(searchInput.trim());
  }, [searchInput]);

  if (!user?.isSuperAdmin) {
    return (
      <div className="text-textColor p-[20px]">
        {t('admin_no_access', 'You do not have access to this page.')}
      </div>
    );
  }

  const rows = (data?.items || []).filter(
    (r) => !(hideExcluded && r.excluded.length)
  );
  const totalPages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;
  const hasMore = data ? (page + 1) * limit < data.total : false;

  return (
    <div className="flex flex-col gap-[16px] text-textColor">
      <div className="flex items-center justify-between">
        <div className="text-[20px] font-[600]">
          {t('vgh_admin_insights_title', 'Sign-up insights')}
        </div>
        <div className="flex gap-[16px] text-[13px]">
          <Link href="/admin/funnel" className="underline">
            {t('vgh_admin_funnel_link', 'Funnel')}
          </Link>
          <Link href="/admin/users" className="underline">
            {t('admin_users_title', 'Users')}
          </Link>
        </div>
      </div>
      <div className="text-[13px] opacity-70">
        {t(
          'vgh_admin_insights_blurb',
          'How far each sign-up got, and which sign-ups look automated. A risk flag is a hint to look closer, never a block. Hover a flag for what it means.'
        )}
      </div>

      <div className="flex flex-wrap gap-[12px] items-end bg-newBgColorInner border border-newTableBorder rounded-[8px] p-[12px]">
        <div className="flex flex-col gap-[6px]">
          <div className="text-[12px] opacity-70">
            {t('vgh_admin_insights_search', 'Email contains')}
          </div>
          <div className="flex gap-[8px]">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onApplySearch();
              }}
              placeholder="user@example.com"
              className="bg-newBgColorInner h-[38px] border border-newTableBorder rounded-[8px] px-[10px] text-[14px] text-textColor min-w-[240px]"
            />
            <Button onClick={onApplySearch}>{t('apply', 'Apply')}</Button>
          </div>
        </div>
        <div className="flex flex-col gap-[6px]">
          <div className="text-[12px] opacity-70">
            {t('vgh_admin_insights_method', 'Sign-up method')}
          </div>
          <select
            value={provider}
            onChange={(e) => {
              setPage(0);
              setProvider(e.target.value);
            }}
            className="bg-newBgColorInner h-[38px] border border-newTableBorder rounded-[8px] px-[10px] text-[14px] text-textColor"
          >
            <option value="">{t('vgh_admin_all', 'All')}</option>
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-[6px]">
          <div className="text-[12px] opacity-70">
            {t('admin_per_page', 'Per page')}
          </div>
          <select
            value={limit}
            onChange={(e) => {
              setPage(0);
              setLimit(parseInt(e.target.value, 10));
            }}
            className="bg-newBgColorInner h-[38px] border border-newTableBorder rounded-[8px] px-[10px] text-[14px] text-textColor"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-[8px] text-[13px] h-[38px]">
          <input
            type="checkbox"
            checked={hideExcluded}
            onChange={(e) => setHideExcluded(e.target.checked)}
          />
          {t('vgh_admin_hide_excluded', 'Hide excluded workspaces')}
        </label>
      </div>

      {isLoading ? (
        <LoadingComponent />
      ) : error ? (
        <div className="text-red-400">
          {t('vgh_admin_insights_failed', 'Failed to load insights.')}
        </div>
      ) : rows.length === 0 ? (
        <div className="opacity-70">
          {t('admin_users_none', 'No users found.')}
        </div>
      ) : (
        <div className="border border-newTableBorder rounded-[8px] overflow-x-auto">
          <div className="min-w-[1250px]">
            <div
              className={clsx(
                GRID,
                'px-[12px] py-[10px] bg-newBgColorInner text-[12px] uppercase opacity-70 border-b border-newTableBorder'
              )}
            >
              <div>{t('admin_users_col_email', 'Email')}</div>
              <div>{t('admin_users_col_provider', 'Method')}</div>
              <div>{t('vgh_admin_col_signed_up', 'Signed up')}</div>
              <div>{t('vgh_admin_col_confirmed', 'Confirmed')}</div>
              <div>{t('vgh_admin_col_channels', 'Channels')}</div>
              <div>{t('vgh_admin_col_first_post', 'First post')}</div>
              <div>{t('vgh_admin_col_posts_by', 'Posts by')}</div>
              <div>{t('vgh_admin_col_mcp', 'MCP')}</div>
              <div>{t('vgh_admin_col_risk', 'Risk')}</div>
            </div>
            {rows.map((row) => (
              <div
                key={row.id}
                className={clsx(
                  GRID,
                  'px-[12px] py-[10px] text-[13px] border-b border-newTableBorder last:border-b-0 items-start'
                )}
              >
                <div className="break-all">
                  <div>{row.email}</div>
                  <div className="opacity-60 text-[12px] flex gap-[6px] flex-wrap">
                    {row.disabled && (
                      <span className="text-red-300">
                        {t('admin_users_status_disabled', 'Disabled')}
                      </span>
                    )}
                    {row.excluded.length > 0 && (
                      <span
                        data-tooltip-id="tooltip"
                        data-tooltip-content={`Left out of the funnel: ${row.excluded.join(
                          ', '
                        )}`}
                      >
                        {t('vgh_admin_excluded', 'excluded')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="opacity-90">{row.providerName}</div>
                <div className="opacity-90">
                  <div>{day(row.createdAt)}</div>
                  <div className="opacity-60 text-[12px]">
                    {t('admin_users_last_online', 'Last online')}{' '}
                    {day(row.lastOnline)}
                  </div>
                </div>
                <div>
                  {row.activated
                    ? t('vgh_admin_yes', 'Yes')
                    : t('vgh_admin_no', 'No')}
                </div>
                <div>
                  <div>{row.channelCount}</div>
                  <div className="opacity-60 text-[12px]">
                    {t('vgh_admin_first', 'first')} {day(row.firstChannelAt)}
                  </div>
                </div>
                <div>
                  <div>
                    {t('vgh_admin_scheduled', 'Scheduled')}{' '}
                    {day(row.firstScheduledAt)}
                  </div>
                  <div className="opacity-60 text-[12px]">
                    {t('vgh_admin_published', 'Published')}{' '}
                    {day(row.firstPublishedAt)}
                  </div>
                </div>
                <div className="text-[12px] opacity-90">
                  {METHODS.filter(([m]) => row.postsByMethod?.[m]).length ===
                  0
                    ? '—'
                    : METHODS.filter(([m]) => row.postsByMethod?.[m]).map(
                        ([m, label]) => (
                          <div key={m}>
                            {label} {row.postsByMethod[m]}
                          </div>
                        )
                      )}
                </div>
                <div>{row.mcpAuthorizations}</div>
                <div className="flex flex-col gap-[4px] items-start">
                  <span
                    className={clsx(
                      'inline-block rounded-[4px] px-[8px] py-[2px] text-[12px] font-[600]',
                      scoreClass(row.riskScore)
                    )}
                  >
                    {row.riskScore}
                  </span>
                  <div className="flex flex-wrap gap-[4px]">
                    {row.riskFlags.map((id) => {
                      const def = RISK_FLAGS.find((f) => f.id === id);
                      return (
                        <span
                          key={id}
                          data-tooltip-id="tooltip"
                          data-tooltip-content={def?.tooltip || id}
                          className="text-[11px] border border-newTableBorder rounded-[4px] px-[6px] py-[1px] cursor-help"
                        >
                          {def?.label || id}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-[13px] opacity-70">
          {t('admin_page_of', 'Page {{page}} of {{total}}', {
            page: page + 1,
            total: totalPages,
          })}
          {data ? ` · ${data.total} total` : ''}
        </div>
        <div className="flex gap-[8px]">
          <Button
            secondary
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            {t('previous', 'Previous')}
          </Button>
          <Button disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>
            {t('next', 'Next')}
          </Button>
        </div>
      </div>
    </div>
  );
};
