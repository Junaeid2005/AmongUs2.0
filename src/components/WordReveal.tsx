import React, { useState } from "react";
import { Player, DETECTIVE_AVATARS } from "@/src/types";
import { db, doc, updateDoc } from "@/src/firebase";
import { sound } from "@/src/lib/sound";
import { ShieldAlert, Fingerprint, EyeOff, CheckSquare, Sparkles } from "lucide-react";
import { motion } from "motion/react";

interface WordRevealProps {
  roomId: string;
  currentPlayerId: string;
  players: Record<string, Player>;
  secretWord: string;
  imposterId: string;
}

export default function WordReveal({
  roomId,
  currentPlayerId,
  players,
  secretWord,
  imposterId
}: WordRevealProps) {
  const [readingFinished, setReadingFinished] = useState(false);
  
  const me = players[currentPlayerId];
  const isImposter = currentPlayerId === imposterId;
  const avatar = DETECTIVE_AVATARS.find(a => a.id === me?.avatarId) || DETECTIVE_AVATARS[0];

  const handleUnderstood = async () => {
    setReadingFinished(true);
    sound.playJoin();
    
    if (!roomId || !currentPlayerId) return;
    try {
      const roomRef = doc(db, "rooms", roomId);
      // We can update a local readiness tracker in player status
      await updateDoc(roomRef, {
        [`players.${currentPlayerId}.clue`]: "" // Initialize clue as empty instead of undefined so we can track game-on
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-2xl mx-auto items-center justify-center py-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={`glass-panel rounded-3xl p-8 relative overflow-hidden shadow-2xl border-t-2 text-center flex flex-col space-y-6 ${
          isImposter 
            ? "border-t-rose-500 shadow-rose-500/5 hover:shadow-rose-500/10" 
            : "border-t-cyan-500 shadow-cyan-500/5 hover:shadow-cyan-500/10"
        }`}
      >
        <div className="absolute top-0 right-0 w-36 h-36 fog-pane opacity-60 pointer-events-none" />

        {/* Identity Token header icon */}
        <div className="mx-auto">
          {isImposter ? (
            <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/30 text-rose-500 rounded-2xl flex items-center justify-center animate-pulse glow-crimson">
              <EyeOff className="w-8 h-8" />
            </div>
          ) : (
            <div className="w-16 h-16 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-2xl flex items-center justify-center animate-pulse glow-cyan">
              <Fingerprint className="w-8 h-8" />
            </div>
          )}
        </div>

        {/* Game Title Info */}
        <div className="space-y-1 select-none">
          <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase block">
            CLASSIFIED DISPATCH
          </span>
          <h2 className="font-display font-black text-2xl tracking-wider text-slate-100">
            {isImposter ? "YOU ARE THE IMPOSTER" : "ROLE AUTHORIZED: DETECTIVE"}
          </h2>
        </div>

        {/* Secret Information Box */}
        <div className={`p-6 rounded-2xl border ${
          isImposter
            ? "bg-rose-950/20 border-rose-500/20 text-rose-100"
            : "bg-cyan-950/20 border-cyan-500/20 text-cyan-100"
        }`}>
          {!isImposter ? (
            <div className="space-y-4">
              <span className="text-[10px] font-mono tracking-widest text-cyan-400 block font-bold">
                SECRET CASE GAME KEYWORD
              </span>
              <h3 className="font-display font-black text-3xl sm:text-4xl tracking-[0.25em] text-white select-all">
                {secretWord}
              </h3>
              <p className="text-[11px] font-mono text-slate-400 max-w-md mx-auto leading-relaxed pt-1.5">
                Investigator {me?.name || "Agent"}, other detectives see this exact keyword. Provide a clue on your turn to confirm your identity to fellows.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="font-display font-bold text-base text-rose-400 tracking-wide">
                WARNING: SECURITY BREACHED
              </p>
              <h3 className="font-mono text-xs text-rose-300 max-w-md mx-auto leading-relaxed uppercase">
                YOU DO NOT KNOW THE SECRET KEYWORD. LISTENING DEVICES ARE ONLINE.
              </h3>
              <p className="text-[11px] font-mono text-slate-400 max-w-md mx-auto leading-normal">
                Analyze clues, submit vague claims, and don't raise suspicion. Attempt to guess the key at the end to hijack the win!
              </p>
            </div>
          )}
        </div>

        {/* Instructions list */}
        <div className="text-left bg-[#07080A] p-4 rounded-xl border border-white/6 max-w-md mx-auto space-y-2">
          <span className="text-[9px] font-mono text-slate-500 block uppercase tracking-wider font-bold">
            INVESTIGATION RULES
          </span>
          <div className="text-[11px] text-slate-400 space-y-2 font-sans">
            {!isImposter ? (
              <>
                <p className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold shrink-0">1.</span>
                  <span>When your turn arrives, input exactly one sentence clue representing the keyword.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold shrink-0">2.</span>
                  <span>Avoid direct words. If the imposter captures the word, you risk losing.</span>
                </p>
              </>
            ) : (
              <>
                <p className="flex items-start gap-2">
                  <span className="text-rose-500 font-bold shrink-0">1.</span>
                  <span>Formulate a fluid, general clue when it's your turn.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-rose-500 font-bold shrink-0">2.</span>
                  <span>Pay attention to clues to deduce the exact Case Word!</span>
                </p>
              </>
            )}
          </div>
        </div>

        {/* Understood Action Button */}
        <div className="pt-2">
          {!readingFinished ? (
            <button
              id="role-revealed-understood"
              onClick={handleUnderstood}
              className={`py-3 px-8 rounded-xl font-display text-xs tracking-widest font-bold transition-all uppercase cursor-pointer ${
                isImposter
                  ? "bg-rose-650 hover:bg-rose-500 text-white border border-rose-500/35 glow-crimson"
                  : "bg-cyan-650 hover:bg-cyan-500 text-white border border-cyan-500/35 glow-cyan"
              }`}
            >
              INVESTIGATE CASE FILES
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 text-xs font-mono text-slate-500 animate-pulse">
              <CheckSquare className="w-4 h-4 text-emerald-500" />
              <span>AWAITING OTHER INVESTIGATORS...</span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
