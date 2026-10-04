"use client";

import Image from "next/image";
import { useEffect, useRef, type MouseEvent } from "react";
import { markDirty } from "@/lib/runtime";
import { lockScroll } from "@/lib/scroll";
import { setUI, useUI, type LightboxItem } from "@/lib/store";
import { wake } from "@/lib/ticker";

let opener: HTMLElement | null = null;

export function openLightbox(item: LightboxItem, from: HTMLElement) {
  opener = from;
  setUI({ lightbox: item });
}

// One native <dialog> for every picture: focus trap, Escape and backdrop come from the browser.
export function Lightbox() {
  const item = useUI((s) => s.lightbox);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!item || !dialog.current || dialog.current.open) return;
    dialog.current.showModal();
    lockScroll(true);
  }, [item]);

  const onClose = () => {
    lockScroll(false);
    setUI({ lightbox: null });
    opener?.focus({ preventScroll: true });
    markDirty();
    wake();
  };

  // A click on the backdrop lands on the dialog element itself, outside its box.
  const onClick = (e: MouseEvent<HTMLDialogElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) e.currentTarget.close();
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="lightbox-title"
      onClose={onClose}
      onClick={onClick}
      className="lightbox m-auto max-h-[94svh] w-max max-w-[94vw] overflow-auto border border-[#383a40] bg-ink p-3 text-cream sm:p-[22px]"
    >
      <div className="mb-3.5 flex items-center justify-between gap-2.5 font-mono text-[9px] sm:gap-9 sm:text-xs">
        <p id="lightbox-title">{item?.title}</p>
        <button type="button" aria-label="Close image" autoFocus onClick={() => dialog.current?.close()} className="h-11 w-11 shrink-0 text-[30px] leading-none">
          ×
        </button>
      </div>
      {item ? (
        <Image
          src={item.src}
          alt={item.alt}
          width={item.width}
          height={item.height}
          sizes="(max-width: 600px) 83vw, 82vw"
          className="block h-auto max-h-[65svh] w-auto max-w-[83vw] object-contain sm:max-h-[min(68svh,730px)] sm:max-w-[min(82vw,1100px)]"
        />
      ) : null}
      <p className="mt-[18px] font-mono text-[9px] text-[#93969c] sm:text-[10px]">ESC TO CLOSE</p>
    </dialog>
  );
}
