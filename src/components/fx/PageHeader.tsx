/**
 * PageHeader — consistent animated heading block for inner pages:
 * eyebrow label, word-by-word title reveal, optional subtitle and an
 * optional action slot (e.g. a CTA button) aligned to the right.
 */
import type { ReactNode } from "react";
import { Reveal } from "./Reveal";
import { SplitText } from "./SplitText";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div className="max-w-2xl">
        <Reveal y={10}>
          <p className="eyebrow">{eyebrow}</p>
        </Reveal>
        <h1 className="mt-3 text-4xl font-bold text-white md:text-5xl">
          <SplitText text={title} />
        </h1>
        {subtitle && (
          <Reveal delay={0.25}>
            <p className="text-muted mt-3 text-base">{subtitle}</p>
          </Reveal>
        )}
      </div>
      {action && <Reveal delay={0.35}>{action}</Reveal>}
    </div>
  );
}
