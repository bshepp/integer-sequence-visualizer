/**
 * The one feedback link, used on all three pages.
 *
 * It was inline in the engine's export bar and nowhere else, so the two pages
 * a visitor is most likely to arrive on - the gallery from a shared link, the
 * About page from a citation - offered no way to say anything back. Built here
 * rather than copied three times: three copies is how the label and the URL
 * drift apart, and a broken feedback link is worse than none because it fails
 * silently on the one person who bothered.
 *
 * "or make a suggestion" rather than only "report a problem": a bare bug-report
 * label turns away the half of the feedback worth more. A missing feature, a
 * confusing word or a sequence worth adding are all issues.
 */
const ISSUES_URL = 'https://github.com/bshepp/integer-sequence-visualizer/issues/new';

export const FEEDBACK_LABEL = 'Report a problem or make a suggestion';

export function buildFeedbackLink(className = 'feedback-link'): HTMLAnchorElement {
  const a = document.createElement('a');
  a.className = className;
  a.href = ISSUES_URL;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = FEEDBACK_LABEL;
  return a;
}
