import { STREETS } from "@/lib/content";
import { Picture } from "@/components/ui/Picture";
import { SectionHeader } from "./SectionHeader";

export function StreetNotes() {
  return (
    <section id="street" tabIndex={-1} aria-labelledby="street-title" className="relative px-inset pb-[90px] pt-[45px] sm:pb-[130px] sm:pt-[110px]">
      <SectionHeader
        id="street-title"
        kicker="02 / STREET NOTES"
        title={
          <>
            In the
            <br />
            city.
          </>
        }
        note="渋谷の空気、日常のかたち。"
        meta="SHIBUYA / TOKYO"
      />
      <div className="grid gap-[35px] sm:grid-cols-2 sm:gap-[26px]">
        {STREETS.map((street, i) => (
          <figure key={street.name}>
            <Picture
              image={street.image}
              alt={street.alt}
              title={`${street.name} / 渋谷`}
              label={`View ${street.name.toLowerCase()}`}
              sizes="(max-width: 600px) 92vw, 46vw"
              focus={street.focus}
            />
            <figcaption className="mt-3.5 flex justify-between gap-2.5 font-mono text-[11px] sm:mt-[18px] sm:text-[13px]">
              {street.name}
              <span lang="ja" className="font-sans text-[10px] text-muted sm:text-xs">
                渋谷 / {String(i + 1).padStart(2, "0")}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
