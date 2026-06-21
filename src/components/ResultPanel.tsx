import React, { useState, useEffect } from "react";
import { Player, DETECTIVE_AVATARS, THEMATIC_WORDS } from "@/src/types";
import { db, doc, updateDoc } from "@/src/firebase";
import { sound } from "@/src/lib/sound";
import { Trophy, HelpCircle, RefreshCw, Key, ShieldCheck, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ResultPanelProps {
  roomId: string;
  currentPlayerId: string;
  players: Record<string, Player>;
  secretWord: string;
  imposterId: string;
  votedOutPlayerId: string;
  imposterGuessAttempt?: string;
  winner?: "DETECTIVES" | "IMPOSTER";
  onNewRound: () => void;
}

export default function ResultPanel({
  roomId,
  currentPlayerId,
  players,
  secretWord,
  imposterId,
  votedOutPlayerId,
  imposterGuessAttempt,
  winner,
  onNewRound
}: ResultPanelProps) {
  const [guessInput, setGuessInput] = useState("");
  const [isSubmittingGuess, setIsSubmittingGuess] = useState(false);

  const me = players[currentPlayerId];
  const isHost = me?.isHost;
  const votedOutPlayer = players[votedOutPlayerId];
  const isVotedOutImposter = votedOutPlayerId === imposterId;
  const isMeImposter = currentPlayerId === imposterId;

  // Sound triggering on game win / loss
  useEffect(() => {
    if (winner === "DETECTIVES") {
      sound.playWin();
    } else if (winner === "IMPOSTER") {
      sound.playLose();
    }
  }, [winner]);

  // Submit Imposter's Final Word Guess
  const handleGuessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanGuess = guessInput.trim().toUpperCase();
    if (!cleanGuess || !roomId) return;

    setIsSubmittingGuess(true);
    try {
      const roomRef = doc(db, "rooms", roomId);
      
      // Determine final winner based on guess correctness
      const isCorrectGuess = cleanGuess === secretWord.trim().toUpperCase();
      const finalWinner = isCorrectGuess ? "IMPOSTER" : "DETECTIVES";

      await updateDoc(roomRef, {
        imposterGuessAttempt: cleanGuess,
        winner: finalWinner
      });
      sound.playTurnChange();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingGuess(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 1. Dramatic Verdict banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-panel rounded-3xl p-6 relative overflow-hidden shadow-2xl border flex flex-col items-center justify-center text-center space-y-4"
      >
        <div className="absolute top-0 right-0 w-32 h-32 fog-pane opacity-60 pointer-events-none" />

        <div className="space-y-1 select-none">
          <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase block">
            ACCUSATION REFERENDUM CONCLUDED
          </span>
          <h2 className="font-display font-black text-2xl tracking-wide text-slate-200">
            THE REFERENDUM VERDICT
          </h2>
        </div>

        {/* Voted out statement block */}
        {votedOutPlayer ? (
          <div className="p-4 bg-[#07080A] border border-white/6 rounded-2xl max-w-lg mx-auto flex items-center gap-4 text-left">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center text-3xl shrink-0 shadow-inner"
              style={{ backgroundColor: DETECTIVE_AVATARS.find(a => a.id === votedOutPlayer.avatarId)?.bgHex }}
            >
              {DETECTIVE_AVATARS.find(a => a.id === votedOutPlayer.avatarId)?.emoji}
            </div>
            <div>
              <p className="text-xs text-slate-400">
                The delegation unmasked <strong className="text-white bg-white/5 px-1.5 py-0.5 rounded">{votedOutPlayer.name}</strong> as the prime saboteur.
              </p>
              <h4 className={`text-xs font-mono font-bold uppercase mt-1 ${isVotedOutImposter ? "text-emerald-400" : "text-rose-400"}`}>
                {isVotedOutImposter ? "🔎 UNMASK CONFIRMED: REAL IMPOSTER DISCOVERED!" : "❌ TRAGEDY: SUSPECT WAS A FELLOW DETECTIVE!"}
              </h4>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400">The committee failed to align on a suspect before expiration.</p>
        )}
      </motion.div>

      {/* 2. Imposter Final Escape Guess Form */}
      {isVotedOutImposter && !imposterGuessAttempt && (
        <AnimatePresence>
          <motion.div 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }}
            className={`glass-panel border-t-2 rounded-3xl p-6 shadow-2xl text-center space-y-4 ${
              isMeImposter ? "border-t-rose-500 shadow-rose-500/10" : "border-t-cyan-500 shadow-cyan-500/5 animate-pulse"
            }`}
          >
            {isMeImposter ? (
              <div className="max-w-md mx-auto space-y-4">
                <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/30 rounded-xl mx-auto flex items-center justify-center text-rose-500 glow-crimson">
                  <Key className="w-6 h-6 animate-spin" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-display font-black text-sm text-rose-450 tracking-widest uppercase">
                    GUESS THE KEYWORD
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    You've been discovered by the crew! But the helicopter is waitlisted: Guess the secret Case Word correctly to hack the records and seal the game win!
                  </p>
                </div>
                <form onSubmit={handleGuessSubmit} className="flex gap-2">
                  <input
                    type="text"
                    id="imposter-guess-key-input"
                    placeholder="ENTER SECRET CASE WORD..."
                    value={guessInput}
                    onChange={(e) => setGuessInput(e.target.value.replace(/[^a-zA-Z]/g, ""))}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-100 uppercase font-mono placeholder:opacity-30 outline-none focus:border-rose-500/60 transition-all text-center tracking-widest"
                    maxLength={15}
                    required
                  />
                  <button
                    type="submit"
                    id="submit-imposter-guess-btn"
                    disabled={isSubmittingGuess || !guessInput.trim()}
                    className="bg-rose-650 hover:bg-rose-500 font-mono text-xs font-bold px-4 rounded-xl border border-rose-500/30 text-white transition-all cursor-pointer inline-flex items-center gap-1 hover:shadow-rose-500/20 shadow-lg glow-crimson"
                  >
                    GUESS
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-12 h-12 bg-cyan-500/10 border border-cyan-500/30 rounded-xl mx-auto flex items-center justify-center text-cyan-400 animate-bounce">
                  <Key className="w-6 h-6" />
                </div>
                <h4 className="font-display font-bold text-xs text-slate-200">
                  IMPOSTER ATTEMPTING STEAL GUESS...
                </h4>
                <p className="text-[11px] font-mono text-slate-550 max-w-sm mx-auto leading-relaxed uppercase">
                  {players[imposterId]?.name || "The Imposter"} has been boxed in but is analyzing the clue logs. If they name the Case Word, they steal the round!
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* 3. Final Win / Loss Announcement Banner */}
      {winner && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={`relative p-8 rounded-3xl border-2 text-center overflow-hidden shadow-2xl ${
            winner === "DETECTIVES"
              ? "bg-white/4 border-emerald-500/30 shadow-emerald-500/5 hover:border-emerald-500/40"
              : "bg-white/4 border-rose-500/30 shadow-rose-500/5 hover:border-rose-500/40"
          }`}
        >
          {/* Confetti or sparks background */}
          <div className="absolute top-0 right-0 w-36 h-36 fog-pane opacity-60 pointer-events-none" />

          <div className="flex flex-col items-center justify-center space-y-3 max-w-lg mx-auto">
            {winner === "DETECTIVES" ? (
              <>
                <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
                  <Trophy className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h1 className="font-display font-black text-3xl text-emerald-400 tracking-[0.2em] shadow-sm uppercase">
                    DETECTIVES VICTORIOUS
                  </h1>
                  <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                    THE COMMUNE PROTECTED LOGGING PROTOCOLS SECURELY.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/30 rounded-full flex items-center justify-center text-rose-500 shadow-lg shadow-rose-500/10">
                  <Trophy className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h1 className="font-display font-black text-3xl text-rose-500 tracking-[0.2em] shadow-sm uppercase">
                    IMPOSTER VICTORIOUS
                  </h1>
                  <p className="text-[11px] font-mono text-slate-400 uppercase tracking-widest leading-relaxed">
                    SABOTEUR SUCCESSFULLY BLENDED IN AND CAPTURED THE CHRONICLES.
                  </p>
                </div>
              </>
            )}

            {/* Imposter guess reveal subline */}
            {imposterGuessAttempt && (
              <div className="pt-2 text-xs font-mono text-slate-350 bg-[#07080A]/85 px-4 py-2 rounded-xl border border-white/6 w-full animate-pulse select-all">
                IMPOSTER CHOSE OUTCOME PLAN: "{imposterGuessAttempt}" ➔{" "}
                <strong className={imposterGuessAttempt.trim().toUpperCase() === secretWord.trim().toUpperCase() ? "text-emerald-400" : "text-rose-450"}>
                  {imposterGuessAttempt.trim().toUpperCase() === secretWord.trim().toUpperCase() ? "CORRECT STEAL" : "FAILED GUESS"}
                </strong>
              </div>
            )}

            {/* Reveal Word */}
            <div className="pt-2.5 flex items-center gap-1.5 font-mono text-xs border-t border-white/6 w-full justify-center">
              <span className="text-slate-500">SECRET KEYWORD WAS:</span>
              <span className="text-cyan-400 font-bold bg-white/3 px-3 py-1 border border-white/8 rounded select-all tracking-wider">
                {secretWord}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* 4. Complete Role Ledger */}
      <div className="glass-panel rounded-3xl p-6 flex flex-col space-y-4 shadow-xl">
        <h3 className="font-display font-bold text-sm tracking-wider text-slate-200">
          THE ROUND IDENTITY LEDGER
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead>
              <tr className="border-b border-white/8 text-[10px] font-mono text-slate-500 uppercase">
                <th className="py-2.5 px-2">Investigator</th>
                <th className="py-2.5 px-2">Role</th>
                <th className="py-2.5 px-2">Submitted Clue</th>
                <th className="py-2.5 px-2 text-right">Vote Casted For</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(players).map((player) => {
                const isPlayerImposter = player.id === imposterId;
                const avatar = DETECTIVE_AVATARS.find(a => a.id === player.avatarId) || DETECTIVE_AVATARS[0];
                const voteTarget = players[player.votedFor || ""];

                return (
                  <tr key={player.id} className="border-b border-white/5 hover:bg-white/2 font-sans transition-colors">
                    <td className="py-3.5 px-2 flex items-center gap-2">
                      <span className="text-lg">{avatar.emoji}</span>
                      <div>
                        <span className="font-bold block text-slate-100">{player.name}</span>
                        <span className="text-[9px] font-mono text-slate-500 leading-none block">{avatar.name.split(" ")[0]}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-2">
                      <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                        isPlayerImposter
                          ? "bg-rose-950/20 text-rose-450 border-rose-500/20"
                          : "bg-cyan-950/20 text-cyan-400 border-cyan-500/20"
                      }`}>
                        {isPlayerImposter ? "IMPOSTER" : "DETECTIVE"}
                      </span>
                    </td>

                    <td className="py-3.5 px-2 font-mono italic text-slate-400 max-w-[250px] truncate" title={player.clue}>
                      {player.clue ? `"${player.clue}"` : "—"}
                    </td>

                    <td className="py-3.5 px-2 text-right">
                      {voteTarget ? (
                        <div className="flex items-center gap-1.5 justify-end text-[11px] text-rose-400/80 font-mono">
                          <span>{voteTarget.name}</span>
                          <span className="text-[14px]">🔎</span>
                        </div>
                      ) : (
                        <span className="text-slate-600 font-mono text-[10px]">NO VOTE CAST</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Next steps buttons */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
        {isHost ? (
          <button
            id="launch-next-round-btn"
            onClick={onNewRound}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 font-display font-medium text-xs tracking-widest text-white py-3 px-8 rounded-xl border border-cyan-400/35 transition-all shadow-lg hover:shadow-cyan-500/20 glow-cyan cursor-pointer flex items-center gap-2 uppercase"
          >
            <RefreshCw className="w-4 h-4" />
            LAUNCH NEXT ROUND
          </button>
        ) : (
          <div className="text-center py-2 px-6 bg-white/1 border border-white/6 rounded-xl">
            <span className="text-xs font-mono text-cyan-400/80 animate-pulse tracking-wide select-none">
              AWAITING CHIEF HOST TO RESET THE OPERATIONS CONSOLE...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
