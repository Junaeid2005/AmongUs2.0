import React, { useState, useEffect } from "react";
import { Player, DETECTIVE_AVATARS } from "@/src/types";
import { db, doc, updateDoc } from "@/src/firebase";
import { sound } from "@/src/lib/sound";
import { FileSignature, Clock, ChevronRight, PenLine, ShieldCheck, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface CluePhaseProps {
  roomId: string;
  currentPlayerId: string;
  players: Record<string, Player>;
  currentTurnId: string;
  turnOrder: string[];
  turnStartedAt?: number;
  onClueSubmitted: (clue: string) => void;
}

export default function CluePhase({
  roomId,
  currentPlayerId,
  players,
  currentTurnId,
  turnOrder,
  turnStartedAt,
  onClueSubmitted
}: CluePhaseProps) {
  const [clueInput, setClueInput] = useState("");
  const [timeLeft, setTimeLeft] = useState(20);

  const activePlayer = players[currentTurnId];
  const isMyTurn = currentTurnId === currentPlayerId;
  const isImposter = players[currentPlayerId]?.role === "IMPOSTER";
  const myWord = players[currentPlayerId]?.wordSubmitted;

  // Track synchronous time counting
  useEffect(() => {
    if (!turnStartedAt) return;

    const tick = () => {
      const elapsedSeconds = Math.floor((Date.now() - turnStartedAt) / 1000);
      const remaining = Math.max(0, 20 - elapsedSeconds);
      setTimeLeft(remaining);

      // Play alert clicks for expiring timer
      if (remaining <= 5 && remaining > 0 && isMyTurn) {
        sound.playTick();
      }

      // Auto-submit fallback claim if elapsed
      if (remaining === 0 && isMyTurn) {
        handleAutoSubmit();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [turnStartedAt, currentTurnId, isMyTurn]);

  // Handle fallback submission if time expires
  const handleAutoSubmit = () => {
    const fallbackClues = [
      "Reviewing the evidence details closely...",
      "There's something suspicious about the pattern.",
      "The profile alignment feels slightly off.",
      "Awaiting forensic verification details.",
      "My suspect list is slowly taking form."
    ];
    const randClue = fallbackClues[Math.floor(Math.random() * fallbackClues.length)];
    handleSubmitClue(randClue);
  };

  const handleSubmitClue = (text: string) => {
    const cleanClue = text.trim();
    if (!cleanClue) return;

    onClueSubmitted(cleanClue);
    setClueInput("");
    sound.playTurnChange();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmitClue(clueInput);
  };

  // Find correct order mapping
  const turnIndex = turnOrder.indexOf(currentTurnId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Active Turn Board & Input */}
      <div className="lg:col-span-6 space-y-5">
        <div className="glass-panel rounded-2xl p-6 flex flex-col space-y-4 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 fog-pane opacity-55 pointer-events-none" />

          {/* Glowing Timer Bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-slate-900 overflow-hidden">
            <motion.div 
              className={`h-full ${timeLeft <= 5 ? "bg-rose-500" : "bg-cyan-500"}`}
              initial={{ width: "100%" }}
              animate={{ width: `${(timeLeft / 20) * 100}%` }}
              transition={{ duration: 1, ease: "linear" }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
                <FileSignature className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <h2 className="font-display font-bold text-sm text-slate-100">
                  CLUE DEPOSITION FORUM
                </h2>
                <p className="text-[10px] font-mono text-slate-400">
                  ROUND {turnIndex + 1} OF {turnOrder.length} ACTIVE STATEMENTS
                </p>
              </div>
            </div>

            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-mono font-bold ${
              timeLeft <= 5
                ? "bg-rose-950/40 border-rose-500/40 text-rose-450 animate-pulse"
                : "bg-slate-900 border-slate-800 text-cyan-400"
            }`}>
              <Clock className="w-3.5 h-3.5" />
              <span>{timeLeft}s</span>
            </div>
          </div>

          {/* Active Player Card */}
          <div className={`p-4 rounded-xl border flex items-center gap-3.5 transition-all ${
            isMyTurn 
              ? "bg-slate-900 border-cyan-500/40 shadow-lg shadow-cyan-500/5 glow-cyan" 
              : "bg-slate-950/60 border-slate-900 text-slate-400"
          }`}>
            <div 
              className="w-12 h-12 rounded-lg flex items-center justify-center text-3xl shrink-0 border border-slate-800"
              style={{ backgroundColor: DETECTIVE_AVATARS.find(a => a.id === activePlayer?.avatarId)?.bgHex || "#1e293b" }}
            >
              {DETECTIVE_AVATARS.find(a => a.id === activePlayer?.avatarId)?.emoji || "🕵️‍♂️"}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-mono text-slate-500 block leading-tight uppercase font-bold">
                {isMyTurn ? "YOUR TURN TO DEPOSE" : "CURRENT WITNESS ON STAND"}
              </span>
              <span className={`text-sm font-bold truncate block ${isMyTurn ? "text-cyan-400" : "text-slate-100"}`}>
                {activePlayer?.name}
              </span>
              <span className="text-[10px] font-mono text-slate-450 truncate block mt-0.5">
                {DETECTIVE_AVATARS.find(a => a.id === activePlayer?.avatarId)?.title}
              </span>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {isMyTurn ? (
              <motion.div
                key="my-turn"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="space-y-4 pt-1"
              >
                <form onSubmit={handleFormSubmit} className="flex flex-col gap-2.5">
                  <div className="relative">
                    <PenLine className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      id="clue-statement-input"
                      maxLength={80}
                      placeholder="Input exactly one sentence claim relating to the case keyword..."
                      value={clueInput}
                      onChange={(e) => setClueInput(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-xs text-slate-100 placeholder:opacity-30 outline-none focus:border-cyan-500/60 hover:border-white/12 focus:ring-1 focus:ring-cyan-500/20 transition-all font-sans"
                      required
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    id="submit-clue-btn"
                    disabled={!clueInput.trim()}
                    className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 hover:shadow-cyan-500/10 disabled:from-slate-900 disabled:to-slate-900 disabled:text-slate-500 text-white font-medium text-xs tracking-wider py-3 px-4 rounded-xl border border-cyan-400/20 transition-all glow-cyan cursor-pointer"
                  >
                    SUBMIT EVIDENCE DEPOSITION
                  </button>
                </form>

                {/* Secret Word reminder for Active Player */}
                <div className="bg-[#07080A] p-3.5 border border-white/6 rounded-xl flex gap-3 items-center">
                  <ShieldCheck className="h-4 w-4 text-cyan-400 shrink-0" />
                  <div className="text-xs">
                    <span className="text-slate-500 block text-[9.5px] uppercase font-mono tracking-wider">SECURE REMINDER</span>
                    {isImposter ? (
                      <span className="text-rose-400 font-bold block">
                        🚨 YOU ARE THE IMPOSTER. Write a vague clue to blend in!
                      </span>
                    ) : (
                      <span className="text-slate-200">
                        The secret word is <strong className="text-cyan-400 tracking-wider">"{myWord}"</strong>. Keep the clue cryptic!
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="waiting"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="bg-slate-950/60 border border-slate-900/60 p-5 rounded-xl text-center space-y-3"
              >
                <div className="flex justify-center">
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                  </span>
                </div>
                <h3 className="font-display font-medium text-xs text-slate-350">
                  AWAITING CLAIM LOGGING...
                </h3>
                <p className="font-mono text-[9px] text-slate-500 max-w-sm mx-auto leading-relaxed uppercase">
                  {activePlayer?.name} is formatting a case description details. Crosscheck the timeline when they submit.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Right Column: Case Clue Tape */}
      <div className="lg:col-span-6">
        <div className="glass-panel rounded-2xl p-6 flex flex-col space-y-4 shadow-xl">
          <h3 className="font-display font-bold text-xs tracking-wider text-slate-300 uppercase">
            CASE EVIDENCE TAPE (CHRONOLOGICAL)
          </h3>

          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
            {turnOrder.map((playerId, index) => {
              const player = players[playerId];
              if (!player) return null;
              
              const avatar = DETECTIVE_AVATARS.find(a => a.id === player.avatarId) || DETECTIVE_AVATARS[0];
              const submittedClue = player.clue;
              const isCurrent = playerId === currentTurnId;

              return (
                <div
                  key={playerId}
                  className={`relative p-3 rounded-xl border transition-all flex items-start gap-3 ${
                    submittedClue
                      ? "bg-white/3 border-white/8 text-slate-100"
                      : isCurrent
                        ? "bg-white/5 border-cyan-550/20 text-slate-400 animate-pulse"
                        : "bg-white/1 border-transparent text-slate-600 opacity-60"
                  }`}
                >
                  {/* Avatar Indicator */}
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xl shrink-0 shadow-inner"
                    style={{ backgroundColor: avatar.bgHex }}
                  >
                    {avatar.emoji}
                  </div>

                  {/* Clue Details */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">
                        {player.name}
                      </span>
                      <span className="text-[9px] font-mono text-slate-500">
                        BLOCK #{index + 1}
                      </span>
                    </div>

                    <div className="font-mono text-xs whitespace-pre-wrap leading-relaxed select-all">
                      {submittedClue ? (
                        <p className="text-slate-300 italic">
                          "{submittedClue}"
                        </p>
                      ) : isCurrent ? (
                        <p className="text-cyan-400/80 animate-pulse text-[10px] uppercase font-bold flex items-center gap-1">
                          <span className="w-1 h-1 bg-cyan-400 rounded-full animate-ping" />
                          Formulating statement...
                        </p>
                      ) : (
                        <p className="text-slate-700 text-[10px] uppercase">
                          Pending queue...
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
