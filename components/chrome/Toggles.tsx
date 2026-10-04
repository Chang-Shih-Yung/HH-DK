"use client";

import { setMode, useUI } from "@/lib/store";
import { NavItem } from "./NavItem";

export function ModeToggle({ className }: { className?: string }) {
  const mode = useUI((s) => s.mode);
  return (
    <NavItem
      label={`MODE[${mode === "dark" ? "D" : "L"}]`}
      ariaLabel="Change theme"
      onClick={() => setMode(mode === "dark" ? "light" : "dark")}
      className={className}
    />
  );
}

export function SoundToggle({ className }: { className?: string }) {
  const sound = useUI((s) => s.sound);
  return (
    <NavItem
      label={`SOUND[${sound ? "+" : "—"}]`}
      ariaLabel={sound ? "Disable sound" : "Enable sound"}
      ariaPressed={sound}
      // The audio module is fetched only when somebody asks for sound.
      onClick={() => import("@/lib/audio").then((m) => m.toggleSound()).catch(() => {})}
      className={className}
    />
  );
}
