import { FallbackLogo } from "./FallbackLogo";

// First screen. The text is server-rendered HTML; the water, the glass logo and the
// stickers are drawn by the canvas underneath.
export function Hero() {
  return (
    <section id="top" tabIndex={-1} aria-label="HH:DK home" className="relative h-view min-h-[710px] sm:min-h-[690px]">
      <div className="absolute inset-x-inset top-[124px] grid grid-cols-2 gap-[18px] sm:top-[132px] sm:grid-cols-3 sm:gap-6">
        <p className="text-[27px] leading-[1.13] tracking-[-0.02em] sm:text-[35px] sm:leading-[1.12]">
          Street &amp;
          <br />
          Everyday
        </p>
        <p lang="ja" className="text-sm leading-[1.7] tracking-[0.06em] sm:text-lg sm:leading-[1.8] sm:tracking-[0.12em]">
          街の気分を、
          <br />
          日常に。
        </p>
        <p className="hidden font-mono text-[13px] leading-[1.8] tracking-[-0.035em] sm:block md:text-base">
          SELECTED BY HH:DK.
          <br />
          SHIBUYA IN MIND.
        </p>
      </div>

      <FallbackLogo />

      <h1 className="absolute bottom-[149px] left-inset z-[5] text-[11.4vw] font-bold leading-[1.08] tracking-[-0.018em] sm:bottom-[127px] sm:text-[8.6vw] sm:leading-[1.045] sm:tracking-[-0.026em] md:text-[clamp(62px,7.1vw,118px)]">
        <span className="block">STREET.</span>
        <span className="block">EVERYDAY.</span>
        <span className="block">A LITTLE PLAY.</span>
      </h1>
      <p className="absolute bottom-[105px] left-inset flex items-baseline gap-[22px] text-[11px] tracking-[0.13em] sm:bottom-[79px] sm:gap-[46px] sm:text-[13px]">
        <span lang="ja">街と、日常と。</span>
        <span className="font-mono text-[9px] tracking-[0.04em] text-muted sm:text-[11px]">HH:DK / 01</span>
      </p>
    </section>
  );
}
