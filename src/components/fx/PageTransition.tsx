/**
 * PageTransition — wraps a page's content in React's <ViewTransition> so
 * every route change plays the "page" enter/exit animation defined in
 * globals.css (blur + lift cross-fade).
 *
 * Per the Next.js view-transitions guide, the wrapper must live in each
 * page (not the layout) because layouts persist across navigations and
 * would never trigger enter/exit.
 */
import { ViewTransition, type ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="page" exit="page" default="none">
      {children}
    </ViewTransition>
  );
}
