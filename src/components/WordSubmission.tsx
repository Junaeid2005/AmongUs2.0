import React, { useState, useEffect } from "react";
import { Player, DETECTIVE_AVATARS, THEMATIC_WORDS } from "@/src/types";
import { db, doc, updateDoc } from "@/src/firebase";
import { sound } from "@/src/lib/sound";
import { FileText, Clock, Sparkles, Check, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface WordSubmissionProps {
  roomId: string;
  currentPlayerId: string;
  players: Record<string, Player>;
  onSubmitWord: (word: string) => void;
}

export default function WordSubmission({
  roomId,
  currentPlayerId,
  players,
  onSubmitWord
}: WordSubmissionProps) {
  const [wordInput, setWordInput] = useState("");
  const [timeLeft, setTimeLeft] = useState(25);
  const me = players[currentPlayerId];
  const hasSubmitted = !!me?.wordSubmitted;

  // Flatten sample pool for direct clicked inspiration
  const wordInspirations = Array.from(
    new Set(THEMATIC_WORDS.flat())
  ).slice(0, 12);

  // Time Limit Countdown Timer for submission
  useEffect(() => {
    if (hasSubmitted) return;

    if (timeLeft <= 0) {
      // Auto-submit random word inspiration when timer ends
      const randWord = wordInspirations[Math.floor(Math.random() * wordInspirations.length)];
      handleSubmit(randWord);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 5) sound.playTick(); // Tick sound for stress tension
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, hasSubmitted]);

  const handleSubmit = (wordToSubmit: string) => {
    const cleanWord = wordToSubmit.trim().toUpperCase();
    if (!cleanWord) return;
    
    onSubmitWord(cleanWord);
    sound.playTurnChange();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit(wordInput);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left panel: Your card */}
      <div className="lg:col-span-7">
        <div className="glass-panel rounded-2xl p-6 flex flex-col space-y-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-28 h-28 fog-pane opacity-50 pointer-events-none" />

          {/* Active timer bar */}
          {!hasSubmitted && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-slate-900 overflow-hidden">
              <motion.div 
                className={`h-full ${timeLeft <= 5 ? "bg-rose-500" : "bg-cyan-400"}`}
                initial={{ width: "100%" }}
                animate={{ width: `${(timeLeft / 25) * 100}%` }}
                transition={{ duration: 1, ease: "linear" }}
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                <FileText className="h-5 w-5 text-cyan-400 animate-pulse" />
              </div>
              <div>
                <h2 className="font-display font-bold text-base text-slate-100">
                  WORD POOL DEPOSITION
                </h2>
                <p className="text-[10px] font-mono text-slate-400">
                  SUBMIT A KEYWORD TO GENERATE CASE FILES
                </p>
              </div>
            </div>

            {!hasSubmitted && (
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono font-bold ${
                timeLeft <= 5 
                  ? "bg-rose-950/40 border-rose-500/40 text-rose-450 animate-bounce" 
                  : "bg-slate-900 border-slate-800 text-cyan-400"
              }`}>
                <Clock className="w-3.5 h-3.5" />
                <span>{timeLeft}s</span>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-350 select-none leading-relaxed">
            Every investigator contributes one specific word. A single word from this list will be chosen as the 
            <span className="text-cyan-400 font-semibold px-1">Detective Secret Word</span>. The detectives will discuss it, while the Imposter must guess it through clues alone!
          </p>

          <AnimatePresence mode="wait">
            {!hasSubmitted ? (
              <motion.div
                key="submit-form"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-4"
              >
                <form onSubmit={handleFormSubmit} className="flex gap-2">
                  <input
                    type="text"
                    id="word-suggestion-input"
                    maxLength={15}
                    placeholder="e.g. BLOODSTAIN, REVOLVER, SAFEHOUSE..."
                    value={wordInput}
                    onChange={(e) => setWordInput(e.target.value.replace(/[^a-zA-Z\s]/g, ""))}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-100 uppercase font-mono placeholder:opacity-30 outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                    required
                  />
                  <button
                    type="submit"
                    id="submit-word-btn"
                    disabled={!wordInput.trim()}
                    className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-900 disabled:text-slate-600 font-mono text-xs font-bold px-5 py-3 rounded-xl border border-cyan-400/30 text-white transition-all cursor-pointer inline-flex items-center gap-1 hover:shadow-cyan-500/10"
                  >
                    DEPLOY
                  </button>
                </form>

                {/* Inspiration chips */}
                <div className="space-y-2">
                  <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-cyan-500" />
                    CLUES INSPIRATION LIST (CLICK TO FILL)
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {wordInspirations.map((word) => (
                      <button
                        key={word}
                        type="button"
                        onClick={() => setWordInput(word)}
                        className="bg-white/2 hover:bg-white/5 border border-white/6 px-2.5 py-1.5 rounded-lg text-[10px] font-mono text-slate-400 hover:text-cyan-400 hover:border-cyan-500/35 transition-all cursor-pointer uppercase"
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="submitted-banner"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/1 border border-emerald-500/20 p-5 rounded-xl flex flex-col items-center justify-center text-center space-y-2"
              >
                <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="font-display font-medium text-xs text-slate-200">
                  KEYWORDS DEPOSITED SECURELY
                </h3>
                <p className="font-mono text-[10px] text-emerald-400/80 uppercase">
                  SUBMISSION: "{me.wordSubmitted}"
                </p>
                <p className="text-[10px] text-slate-500 pt-1">
                  Waiting for other team members to submit their findings...
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Right panel: Active Room progress */}
      <div className="lg:col-span-5">
        <div className="glass-panel rounded-2xl p-6 flex flex-col space-y-4 shadow-xl">
          <h3 className="font-display font-bold text-xs tracking-wider text-slate-200 uppercase">
            DEPOT SUBMISSION STATE
          </h3>

          <div className="space-y-2.5">
            {Object.values(players).map((player) => {
              const avatar = DETECTIVE_AVATARS.find(a => a.id === player.avatarId) || DETECTIVE_AVATARS[0];
              const submitted = !!player.wordSubmitted;

              return (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${
                    submitted 
                      ? "bg-white/3 border-emerald-500/30 text-emerald-250 animate-pulse" 
                      : "bg-white/1 border-white/6 text-slate-400"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{avatar.emoji}</span>
                    <span className="font-bold truncate max-w-[120px]">{player.name}</span>
                  </div>

                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    submitted
                      ? "bg-emerald-950/30 text-emerald-400 border-emerald-500/20"
                      : "bg-slate-900 border-slate-800 text-slate-500"
                  }`}>
                    {submitted ? "SUBMITTED" : "COMPOSING..."}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
