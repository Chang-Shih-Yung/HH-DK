import { PRODUCTS } from "@/lib/content";
import { Picture } from "@/components/ui/Picture";
import { SectionHeader } from "./SectionHeader";

export function Edit() {
  return (
    <section id="edit" tabIndex={-1} aria-labelledby="edit-title" className="relative px-inset pb-[90px] pt-[100px] sm:pb-[130px] sm:pt-[104px]">
      <SectionHeader
        id="edit-title"
        kicker="01 / THE EDIT"
        title={
          <>
            Everyday
            <br />
            finds.
          </>
        }
        note="気になるものを、少しずつ。"
        meta="OBJECTS / WEAR / DAILY"
      />
      <div className="grid grid-cols-2 gap-x-[15px] gap-y-9 sm:grid-cols-3 sm:gap-x-[18px] sm:gap-y-10 md:gap-x-[26px] md:gap-y-[54px]">
        {PRODUCTS.map((product, i) => (
          <figure key={product.name}>
            <Picture
              image={product.image}
              alt={product.alt}
              title={`${product.name} / ${product.ja}`}
              label={`View ${product.alt}`}
              sizes="(max-width: 600px) 46vw, 30vw"
              square
            />
            <figcaption>
              <div className="mb-[9px] mt-[13px] flex items-baseline justify-between gap-1 text-[13px] sm:mt-[18px] sm:gap-2 sm:text-[15px] md:text-[19px] md:tracking-[-0.015em]">
                <span>{product.name}</span>
                <span className="font-mono text-[9px] tracking-normal text-muted sm:text-[11px]">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <div className="flex justify-between gap-2.5 text-[11px] text-muted sm:text-xs sm:tracking-[0.06em]">
                <span lang="ja">{product.ja}</span>
                <span className="hidden font-mono text-[10px] tracking-normal sm:inline">{product.type}</span>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
