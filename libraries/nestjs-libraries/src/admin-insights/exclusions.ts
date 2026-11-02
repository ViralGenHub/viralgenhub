// One decision for "does this workspace count as a real customer?", shared by
// the funnel, the insights list and the new-account API delay.
//
// Excluded: our own test/brand workspaces (PREVIEW_ORGS), lifetime
// subscriptions (comped), workspaces that have a platform super admin, and any
// ids in ADMIN_EXCLUDE_ORGS (comma separated). Nothing is stored: it is
// computed from env + existing data.
export type ExclusionReason = 'preview' | 'lifetime' | 'super_admin' | 'listed';

export interface ExclusionOrg {
  id: string;
  isLifetime?: boolean | null;
  hasSuperAdmin?: boolean | null;
}

export const parseIdList = (value?: string | null): string[] =>
  String(value || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

export const exclusionReasons = (
  org: ExclusionOrg,
  env: Record<string, string | undefined> = process.env
): ExclusionReason[] => {
  const reasons: ExclusionReason[] = [];
  if (parseIdList(env.PREVIEW_ORGS).includes(org.id)) reasons.push('preview');
  if (org.isLifetime) reasons.push('lifetime');
  if (org.hasSuperAdmin) reasons.push('super_admin');
  if (parseIdList(env.ADMIN_EXCLUDE_ORGS).includes(org.id)) {
    reasons.push('listed');
  }
  return reasons;
};

export const isExcludedOrg = (
  org: ExclusionOrg,
  env: Record<string, string | undefined> = process.env
): boolean => exclusionReasons(org, env).length > 0;
