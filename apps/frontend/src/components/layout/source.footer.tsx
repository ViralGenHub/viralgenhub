// AGPL-3.0 section 13: users who interact with the app over a network must be
// able to get the source of the version they use. NEXT_PUBLIC_VERSION is the
// git commit the image was built from (CI build arg), so link that exact tree.
// The Postiz credit lives in the Terms (section 13) and Privacy pages, linked below.
export const SOURCE_URL = process.env.NEXT_PUBLIC_VERSION
  ? `https://github.com/ViralGenHub/viralgenhub/tree/${process.env.NEXT_PUBLIC_VERSION}`
  : 'https://github.com/ViralGenHub/viralgenhub';

export const SourceFooter = () => (
  <div className="text-[12px] text-center opacity-70 py-[8px]">
    <a href={SOURCE_URL} target="_blank" rel="noreferrer" className="underline">
      Source code
    </a>{' '}
    ·{' '}
    <a
      href="https://viralgenhub.com/privacy"
      target="_blank"
      rel="noreferrer"
      className="underline"
    >
      Privacy
    </a>{' '}
    ·{' '}
    <a
      href="https://viralgenhub.com/terms"
      target="_blank"
      rel="noreferrer"
      className="underline"
    >
      Terms
    </a>
  </div>
);
