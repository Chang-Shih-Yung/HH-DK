"use client";

import { useUI } from "@/lib/store";
import { NavItem } from "./NavItem";
import { toggleSound } from "@/lib/audio";
import { toggleTilt } from "@/lib/tilt";

export function SoundToggle({ className }: { className?: string }) {
  const sound = useUI((s) => s.sound);
  const loading = useUI((s) => s.soundLoading);
  return (
    <NavItem
      label={`SOUND[${loading ? "…" : sound ? "+" : "—"}]`}
      ariaLabel={sound ? "Disable sound" : "Enable sound"}
      ariaPressed={sound}
      onClick={toggleSound}
      className={className}
    />
  );
}

export function TiltToggle() {
  const status = useUI((s) => s.tilt);
  const available = useUI((s) => s.tiltAvailable);
  if (!available) return null;
  return <NavItem label={`TILT[${status === "on" ? "+" : status === "asking" ? "…" : "—"}]`}
    ariaLabel={status === "on" ? "Disable tilt lighting" : "Enable tilt lighting"}
    ariaPressed={status === "on"} onClick={() => void toggleTilt()} />;
}
