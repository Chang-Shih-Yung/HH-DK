import type { CSSProperties } from "react";

const MERIDIANS = [0, 1, 2];
const PERIOD = 2.6; // seconds per half turn

// Wire globe whose meridians keep turning. The turn is a transform-only CSS animation on
// plain boxes, so it runs on the compositor and never wakes the main thread.
export function Globe() {
  return (
    <span className="relative block h-[19px] w-8 sm:h-6 sm:w-10" aria-hidden="true">
      <span className="absolute inset-0 rounded-[50%] border border-current" />
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-current" />
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-current" />
      {MERIDIANS.map((i) => (
        <span
          key={i}
          className="globe-meridian absolute inset-0 rounded-[50%] border border-current"
          style={{ animationDelay: `${(-PERIOD / MERIDIANS.length) * i}s`, animationDuration: `${PERIOD}s` } as CSSProperties}
        />
      ))}
    </span>
  );
}
