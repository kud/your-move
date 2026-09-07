/*
 * The GitHub mark, inlined rather than fetched — same argument as `mark.tsx`.
 *
 * It appears in exactly one place: the sign-in button. Every outbound link in
 * this app goes to github.com, so a mark on all of them would carry no
 * information at all — it would become texture, and it would put a second glyph
 * on rows where `↗` is already saying the one thing worth saying, which is that
 * the link leaves the app. A provider button is different in kind: it is a
 * recognised object, and looking conventional is doing real work on the one
 * screen where somebody is about to grant an OAuth scope.
 *
 * `currentColor`, never GitHub's brand black or white — black vanishes on
 * `bg-panel-2` and white is louder than the label it belongs to. And never the
 * accent: rose means "this needs you" here, which is not what a logo is for.
 *
 * `aria-hidden` because the button already says "Sign in with GitHub".
 */
export const GitHubMark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className={className}>
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
  </svg>
)
