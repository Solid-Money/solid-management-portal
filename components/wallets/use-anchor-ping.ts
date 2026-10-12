"use client";

import { useEffect, useState } from "react";

/** Each flash, and the gap before the next. Three of them, then done. */
const PING_COUNT = 3;
const PING_INTERVAL_MS = 700;

/**
 * The anchor the page was opened on, and whether it is still pinging.
 *
 * Exists because a Slack alert names one token on one wallet among sixty-odd
 * rows, and "open the dashboard and find it" is most of the work the alert was
 * supposed to save. The hash is read once on mount and again on every
 * `hashchange`, so a second alert clicked while the page is already open
 * re-targets rather than doing nothing.
 *
 * The ping is deliberately finite. A row that pulses until the reader clicks it
 * becomes a thing to dismiss; three flashes say "here" and then let the page be
 * read normally.
 */
export function useAnchorPing(): {
  anchor?: string;
  pinging: boolean;
} {
  const [anchor, setAnchor] = useState<string | undefined>();
  const [pinging, setPinging] = useState(false);

  useEffect(() => {
    const read = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (!hash) return;
      setAnchor(hash);
      setPinging(true);
    };

    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  useEffect(() => {
    if (!pinging) return;
    const timer = window.setTimeout(
      () => setPinging(false),
      PING_COUNT * PING_INTERVAL_MS
    );
    return () => window.clearTimeout(timer);
  }, [pinging, anchor]);

  return { anchor, pinging };
}
