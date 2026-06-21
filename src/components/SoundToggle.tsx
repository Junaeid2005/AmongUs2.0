import React, { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { sound } from "@/src/lib/sound";

export default function SoundToggle() {
  const [enabled, setEnabled] = useState(sound.isSoundEnabled());

  const handleToggle = () => {
    const nextState = sound.toggleSound();
    setEnabled(nextState);
    if (nextState) {
      sound.playJoin();
    }
  };

  return (
    <button
      id="sound-toggle-btn"
      onClick={handleToggle}
      className={`relative p-2.5 rounded-xl border flex items-center justify-center transition-all duration-300 shadow-md ${
        enabled
          ? "bg-slate-900/80 border-cyan-500/30 text-cyan-400 hover:border-cyan-400"
          : "bg-slate-950/65 border-white/10 text-slate-500 hover:text-slate-400"
      }`}
      title={enabled ? "Mute Game Sound" : "Unmute Game Sound"}
    >
      {enabled ? (
        <Volume2 className="h-4 w-4 animate-pulse" />
      ) : (
        <VolumeX className="h-4 w-4" />
      )}
      <span className="sr-only">Toggle SFX</span>
    </button>
  );
}
