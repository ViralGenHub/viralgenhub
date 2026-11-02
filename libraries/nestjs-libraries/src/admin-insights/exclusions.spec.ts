import {
  exclusionReasons,
  isExcludedOrg,
  parseIdList,
} from '@gitroom/nestjs-libraries/admin-insights/exclusions';

describe('exclusions', () => {
  it('parses comma lists', () => {
    expect(parseIdList(' a, b ,,c')).toEqual(['a', 'b', 'c']);
    expect(parseIdList(undefined)).toEqual([]);
  });

  it('counts a plain workspace', () => {
    expect(isExcludedOrg({ id: 'o1' }, {})).toBe(false);
  });

  it('excludes each of the four reasons', () => {
    expect(exclusionReasons({ id: 'o1' }, { PREVIEW_ORGS: 'x,o1' })).toEqual(['preview']);
    expect(exclusionReasons({ id: 'o1', isLifetime: true }, {})).toEqual(['lifetime']);
    expect(exclusionReasons({ id: 'o1', hasSuperAdmin: true }, {})).toEqual(['super_admin']);
    expect(exclusionReasons({ id: 'o1' }, { ADMIN_EXCLUDE_ORGS: 'o1' })).toEqual(['listed']);
  });

  it('reports every reason that applies', () => {
    expect(
      exclusionReasons(
        { id: 'o1', isLifetime: true },
        { PREVIEW_ORGS: 'o1', ADMIN_EXCLUDE_ORGS: 'o1' }
      )
    ).toEqual(['preview', 'lifetime', 'listed']);
  });
});
