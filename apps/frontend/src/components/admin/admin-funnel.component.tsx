'use client';

import React, { FC, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';

// Shape of GET /admin/insights/funnel (admin-insights.service.ts)
interface FunnelResponse {
  steps: Array<{
    id: string;
    label: string;
    count: number;
    pctOfSignups: number;
    dropOffPct: number;
  }>;
  excluded: { total: number; byReason: Record<string, number> };
  totalBeforeExclusions: number;
}

const PROVIDERS = ['LOCAL', 'GOOGLE', 'GITHUB', 'APPLE', 'FARCASTER', 'GENERIC'];

const REASON_LABEL: Record<string, string> = {
  preview: 'our test workspaces',
  lifetime: 'lifetime plans',
  super_admin: 'platform admins',
  listed: 'listed by hand',
};

export const AdminFunnelComponent: FC = () => {
  const t = useT();
  const user = useUser();
  const fetch = useFetch();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [provider, setProvider] = useState('');

  const query = new URLSearchParams({
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(provider ? { provider } : {}),
  });
  const { data, isLoading, error } = useSWR<FunnelResponse>(
    `/admin/insights/funnel?${query.toString()}`,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to load funnel');
      }
      return res.json();
    }
  );

  if (!user?.isSuperAdmin) {
    return (
      <div className="text-textColor p-[20px]">
        {t('admin_no_access', 'You do not have access to this page.')}
      </div>
    );
  }

  const first = data?.steps?.[0]?.count || 0;
  const inputClass =
    'bg-newBgColorInner h-[38px] border border-newTableBorder rounded-[8px] px-[10px] text-[14px] text-textColor';

  return (
    <div className="flex flex-col gap-[16px] text-textColor">
      <div className="flex items-center justify-between">
        <div className="text-[20px] font-[600]">
          {t('vgh_admin_funnel_title', 'Sign-up funnel')}
        </div>
        <Link href="/admin/insights" className="underline text-[13px]">
          {t('vgh_admin_insights_link', 'Sign-up insights')}
        </Link>
      </div>
      <div className="text-[13px] opacity-70">
        {t(
          'vgh_admin_funnel_blurb',
          'Each step counts the people who reached it. Drop-off is the share lost since the step before.'
        )}
      </div>

      <div className="flex flex-wrap gap-[12px] items-end bg-newBgColorInner border border-newTableBorder rounded-[8px] p-[12px]">
        <div className="flex flex-col gap-[6px]">
          <div className="text-[12px] opacity-70">
            {t('vgh_admin_funnel_from', 'Signed up from')}
          </div>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-[6px]">
          <div className="text-[12px] opacity-70">
            {t('vgh_admin_funnel_to', 'Signed up to (included)')}
          </div>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-[6px]">
          <div className="text-[12px] opacity-70">
            {t('vgh_admin_insights_method', 'Sign-up method')}
          </div>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className={inputClass}
          >
            <option value="">{t('vgh_admin_all', 'All')}</option>
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <LoadingComponent />
      ) : error || !data ? (
        <div className="text-red-400">
          {t('vgh_admin_funnel_failed', 'Failed to load the funnel.')}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-[10px] max-w-[760px]">
            {data.steps.map((step, i) => (
              <div key={step.id} className="flex flex-col gap-[4px]">
                <div className="flex justify-between text-[14px]">
                  <div className="font-[600]">{step.label}</div>
                  <div>
                    {step.count}
                    <span className="opacity-60">
                      {' '}
                      · {step.pctOfSignups}%
                      {i > 0 && ` · −${step.dropOffPct}% from the step before`}
                    </span>
                  </div>
                </div>
                <div className="h-[10px] bg-newTableBorder rounded-[5px] overflow-hidden">
                  <div
                    className="h-full bg-purple-500"
                    style={{
                      width: `${first ? (step.count / first) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="text-[13px] opacity-70" data-testid="funnel-excluded">
            {data.excluded.total === 0
              ? t('vgh_admin_funnel_none_excluded', 'No workspaces were left out.')
              : t(
                  'vgh_admin_funnel_excluded',
                  '{{count}} of {{all}} sign-ups left out ({{why}}).',
                  {
                    count: data.excluded.total,
                    all: data.totalBeforeExclusions,
                    why: Object.entries(data.excluded.byReason)
                      .map(([k, n]) => `${n} ${REASON_LABEL[k] || k}`)
                      .join(', '),
                  }
                )}
          </div>
        </>
      )}
    </div>
  );
};
