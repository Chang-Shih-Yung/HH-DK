"use client";

import Image, { type StaticImageData } from "next/image";
import { openLightbox } from "./Lightbox";

type Props = {
  image: StaticImageData;
  alt: string;
  /** Lightbox heading. */
  title: string;
  label: string;
  sizes: string;
  square?: boolean;
  /** Horizontal focal point in percent, for pictures cropped by their frame. */
  focus?: number;
};

// A picture that opens larger. A real <img> in the document (responsive, lazy, blurred
// placeholder) — sharp at any size and free of the WebGL layer.
export function Picture({ image, alt, title, label, sizes, square, focus }: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-haspopup="dialog"
      data-cursor="VIEW"
      data-photo=""
      data-focus={focus ?? 50}
      onClick={(e) => openLightbox({ src: image.src, width: image.width, height: image.height, alt, title }, e.currentTarget)}
      className={`picture group relative block w-full overflow-hidden bg-[#1a1c1e] text-left ${square ? "aspect-square" : "aspect-[1.48]"}`}
    >
      <Image
        src={image}
        alt={alt}
        sizes={sizes}
        placeholder="blur"
        className="h-full w-full object-cover transition-transform duration-700 ease-soft group-hover:scale-[1.018]"
        style={focus === undefined ? undefined : { objectPosition: `${focus}% 50%` }}
      />
      <span
        aria-hidden="true"
        className="absolute bottom-[9px] right-[9px] z-[1] grid h-[27px] w-[27px] place-items-center rounded-full border border-white/35 text-[17px] text-white transition-colors duration-200 group-hover:bg-cream group-hover:text-[#111] sm:bottom-[15px] sm:right-4 sm:h-8 sm:w-8 sm:text-[19px]"
      >
        ↗
      </span>
    </button>
  );
}
