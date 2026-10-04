import { NAV } from "@/lib/content";
import { Wordmark } from "@/components/ui/Wordmark";
import { BottomBar } from "./BottomBar";
import { MenuButton } from "./MenuButton";
import { NavItem } from "./NavItem";
import { ModeToggle, SoundToggle } from "./Toggles";

// Fixed frame around the page: brand and navigation above, location and globe below.
// The frame itself ignores the pointer; only its controls take it.
export function Header() {
  return (
    <header className="pointer-events-none fixed inset-0 z-50 flex flex-col justify-between font-mono">
      <a
        href="#edit"
        className="pointer-events-auto absolute left-gutter top-3.5 z-10 -translate-y-[200%] bg-bg p-3.5 text-[13px] focus:translate-y-0"
      >
        SKIP TO THE EDIT
      </a>
      <div className="flex items-center justify-between px-inset pt-[max(16px,env(safe-area-inset-top))] md:pt-7">
        <a href="#top" aria-label="HH:DK home" className="pointer-events-auto flex min-h-11 w-[102px] items-center sm:w-[134px]">
          <Wordmark />
        </a>
        <nav aria-label="Main navigation" className="hidden items-center gap-8 text-[15px] md:flex">
          {NAV.map((item) => (
            <NavItem key={item.id} href={`#${item.id}`} label={item.label} ariaLabel={item.aria} />
          ))}
          <ModeToggle />
          <SoundToggle />
        </nav>
        <MenuButton />
      </div>
      <BottomBar />
    </header>
  );
}
