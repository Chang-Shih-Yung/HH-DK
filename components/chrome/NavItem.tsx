"use client";

import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";
import { cancelScramble, scramble } from "@/lib/scramble";
import { ui } from "@/lib/store";

type Props = {
  label: string;
  href?: string;
  onClick?: () => void;
  ariaLabel: string;
  ariaPressed?: boolean;
  /** Menu links jump instead of gliding. */
  instant?: boolean;
  className?: string;
  children?: ReactNode;
};

// A navigation entry: the label scrambles on hover/focus and the item leans towards a mouse.
export function NavItem({ label, href, onClick, ariaLabel, ariaPressed, instant, className = "" }: Props) {
  const text = useRef<HTMLSpanElement>(null);

  // Keep the node in step when the label itself changes (MODE[D] → MODE[L]).
  useEffect(() => {
    if (text.current) cancelScramble(text.current, label);
  }, [label]);

  const play = () => {
    if (text.current && !ui().reduced) scramble(text.current, label);
  };
  const lean = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse" || ui().reduced) return;
    const box = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${(e.clientX - box.left - box.width / 2) * 0.055}px`);
    e.currentTarget.style.setProperty("--my", `${(e.clientY - box.top - box.height / 2) * 0.06}px`);
  };
  const rest = (e: PointerEvent<HTMLElement>) => {
    e.currentTarget.style.setProperty("--mx", "0px");
    e.currentTarget.style.setProperty("--my", "0px");
    if (text.current) cancelScramble(text.current, label);
  };

  const shared = {
    "aria-label": ariaLabel,
    onPointerEnter: play,
    onFocus: play,
    onPointerMove: lean,
    onPointerLeave: rest,
    className: `pointer-events-auto flex min-h-11 items-center whitespace-nowrap font-mono transition-[color,translate] duration-200 [translate:var(--mx,0px)_var(--my,0px)] hover:text-accent ${className}`,
  };
  const content = <span ref={text}>{label}</span>;

  return href ? (
    <a href={href} data-jump={instant ? "instant" : undefined} onClick={onClick} {...shared}>
      {content}
    </a>
  ) : (
    <button type="button" aria-pressed={ariaPressed} onClick={onClick} {...shared}>
      {content}
    </button>
  );
}
