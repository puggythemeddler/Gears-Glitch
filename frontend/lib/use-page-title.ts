import { useEffect } from "react";

/**
 * Sets the browser tab title for app pages (customer/staff areas where SEO
 * is irrelevant). Public storefront pages use <PageHead /> for SSR instead.
 */
export function usePageTitle(title: string | undefined) {
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);
}
