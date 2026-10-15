"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { scrollToHashTarget } from "@/lib/section-navigation";

/**
 * Lands on the section a URL hash names — on first load, after every
 * navigation, and on a hash change within the page. See `navigateTo`.
 */
export default function SectionScroller() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    let cancel = scrollToHashTarget();
    const retarget = () => {
      cancel();
      cancel = scrollToHashTarget();
    };
    window.addEventListener("hashchange", retarget);
    return () => {
      cancel();
      window.removeEventListener("hashchange", retarget);
    };
  }, [pathname, search]);

  return null;
}
