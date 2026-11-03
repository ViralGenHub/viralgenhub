import Link from 'next/link';

// "Back to Admin" on every /admin sub-page, so the admin pages can be left
// without the browser's back button.
export const AdminBackLink = () => (
  <Link
    href="/admin"
    className="self-start inline-flex items-center gap-[6px] text-[14px] opacity-80 hover:opacity-100 hover:underline"
  >
    <span aria-hidden="true">←</span>
    Admin
  </Link>
);
