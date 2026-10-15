/**
 * Getting from a search result to the exact place on a page.
 *
 * Every searchable section carries an HTML `id`, and a result links to it as a
 * URL hash — `/rewards-config#referral-system`, `/users/<id>?tab=card#user-kyc`
 * — so the same link works pasted into Slack. `SectionScroller` (mounted once
 * in the dashboard layout) does the landing; this module only has to get the
 * URL right and make sure the scroller hears about it.
 */

type Router = { push: (href: string) => void };

/** The event `SectionScroller` listens for; also what the wallets board reads. */
const HASH_EVENT = "hashchange";

/**
 * Go to `href`, landing on its `#section` when it has one.
 *
 * A hash-only change on the page already open goes through `history` rather
 * than the router: Next performs no navigation for it and fires no
 * `hashchange`, so nothing on the page would learn the target moved. Anything
 * else is an ordinary navigation, after which the scroller reads the hash.
 */
export function navigateTo(
  router: Router,
  href: string,
  { newTab = false }: { newTab?: boolean } = {}
): void {
  if (newTab) {
    window.open(href, "_blank", "noopener");
    return;
  }

  const target = new URL(href, window.location.href);
  const samePage =
    target.pathname === window.location.pathname &&
    target.search === window.location.search;

  if (samePage && target.hash) {
    // Next keeps its router state in sync with a native pushState.
    window.history.pushState(null, "", target.hash);
    window.dispatchEvent(new HashChangeEvent(HASH_EVENT));
    return;
  }

  router.push(`${target.pathname}${target.search}${target.hash}`);
  // A component that stays mounted across the navigation (the wallets board
  // when only the tab changes) reads the hash on `hashchange` alone, which a
  // router push never fires. Announce it once the router has applied the URL.
  if (target.hash) announceHashWhenApplied(target.hash);
}

function announceHashWhenApplied(hash: string, waitedMs = 0): void {
  if (window.location.hash === hash) {
    window.dispatchEvent(new HashChangeEvent(HASH_EVENT));
    return;
  }
  if (waitedMs >= 3000) return;
  window.setTimeout(() => announceHashWhenApplied(hash, waitedMs + 50), 50);
}

/** How long a section is waited for: panels render after their data loads. */
const WAIT_FOR_SECTION_MS = 8000;
const POLL_MS = 100;
const FLASH_CLASS = "section-flash";
const FLASH_MS = 2200;

/**
 * Scroll to the element the URL hash names, once it exists, and flash it.
 *
 * Polls rather than looking once, because most sections are cards that only
 * render when their query resolves, and a tab switch mounts its content a
 * frame after the URL changes. Elements inside `[data-anchor-self]` are left
 * alone: that container (the wallets board) expands and pings its own targets.
 *
 * Returns a cancel, so a newer target supersedes one still being waited for.
 */
export function scrollToHashTarget(): () => void {
  const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  if (!id) return () => {};

  const startedAt = Date.now();
  let flashTimer: number | undefined;

  const timer = window.setInterval(() => {
    const element = document.getElementById(id);
    if (!element) {
      if (Date.now() - startedAt > WAIT_FOR_SECTION_MS) {
        window.clearInterval(timer);
      }
      return;
    }
    window.clearInterval(timer);
    if (element.closest("[data-anchor-self]")) return;

    // A button that only opens a form ("New campaign") is pressed for the
    // reader: they searched for the action, not for where it lives. The hash
    // is dropped afterwards so a reload or a later re-render cannot open it
    // again. Anything that changes data is only ever focused.
    if (element.hasAttribute("data-search-open")) {
      element.click();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`
      );
      return;
    }

    element.scrollIntoView({ behavior: "smooth", block: "start" });
    if (element.matches("button, a[href], input, select, textarea")) {
      element.focus({ preventScroll: true });
    }
    // Restart the animation when the same section is picked twice in a row.
    element.classList.remove(FLASH_CLASS);
    void element.offsetWidth;
    element.classList.add(FLASH_CLASS);
    flashTimer = window.setTimeout(
      () => element.classList.remove(FLASH_CLASS),
      FLASH_MS
    );
  }, POLL_MS);

  return () => {
    window.clearInterval(timer);
    if (flashTimer) window.clearTimeout(flashTimer);
  };
}
