import type { ReactNode } from "react";

type Props = { id: string; kicker: string; title: ReactNode; note: string; meta: string };

export function SectionHeader({ id, kicker, title, note, meta }: Props) {
  return (
    <div className="mb-[38px] sm:mb-[58px] sm:flex sm:items-end sm:justify-between sm:gap-5 md:gap-[30px]">
      <div>
        <p className="mb-6 font-mono text-[11px] text-muted sm:mb-[30px] sm:text-[13px]">{kicker}</p>
        <h2 id={id} className="text-[63px] font-medium leading-none tracking-[-0.035em] sm:text-[clamp(62px,7.2vw,104px)] sm:leading-[0.99]">
          {title}
        </h2>
      </div>
      <p lang="ja" className="mt-[25px] text-[13px] leading-[2] tracking-[0.12em] sm:mt-0 sm:pb-1.5 sm:text-xs md:text-[15px]">
        {note}
        <br />
        <span lang="en" className="font-mono text-[10px] leading-[2.4] tracking-[0.04em] text-muted sm:text-[9px] md:text-[11px]">
          {meta}
        </span>
      </p>
    </div>
  );
}
