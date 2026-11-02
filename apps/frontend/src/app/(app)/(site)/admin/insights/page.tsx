export const dynamic = 'force-dynamic';
import { AdminInsightsComponent } from '@gitroom/frontend/components/admin/admin-insights.component';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: `${'ViralGenHub'} Admin Insights`,
  description: '',
};

export default async function Page() {
  return (
    <div className="bg-newBgColorInner flex-1 min-w-0 flex-col flex p-[20px] gap-[12px]">
      <AdminInsightsComponent />
    </div>
  );
}
