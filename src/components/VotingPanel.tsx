import React, { useState, useEffect } from "react";
import { Player, DETECTIVE_AVATARS } from "@/src/types";
import { db, doc, updateDoc } from "@/src/firebase";
import { sound } from "@/src/lib/sound";
import { ShieldAlert, Vote, Clock, Check, Info, Users } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface VotingPanelProps {
  roomId: string;
  currentPlayerId: string;
  players: Record<string, Player>;
  onVoteCast: (suspectId: string) => void;
}

export default function VotingPanel({
  roomId,
  currentPlayerId,
  players,
  onVoteCast
}: VotingPanelProps) {
  const [selectedSuspectId, setSelectedSuspectId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(45);

  const me = players[currentPlayerId];
  const playerList = Object.values(players).filter(p => p.isOnline);
  const hasVoted = !!me?.votedFor;

  // Sound triggering on voting starter
  useEffect(() => {
    sound.playVotingStarted();
  }, []);

  // Time Countdown tick logic
  useEffect(() => {
    if (hasVoted && timeLeft <= 5) return; // Ignore if voted

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleAutoVote();
          return 0;
        }
        if (prev <= 6 && !hasVoted) {
          sound.playTick();
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, hasVoted]);

  // Handle automatic voting if time runs out
  const handleAutoVote = () => {
    if (hasVoted) return;

    // Vote for a random other player
    const eligiblePool = playerList.filter((p) => p.id !== currentPlayerId && p.isOnline);
    if (eligiblePool.length > 0) {
      const randSuspect = eligiblePool[Math.floor(Math.random() * eligiblePool.length)];
      handleCastVote(randSuspect.id);
    }
  };

  const handleCastVote = (suspectId: string) => {
    if (hasVoted) return;
    setSelectedSuspectId(suspectId);
    onVoteCast(suspectId);
    sound.playWin(); // Play clean positive chime on cast
  };

  // Compute live vote counts
  const voteTallies: Record<string, number> = {};
  playerList.forEach((p) => {
    if (p.votedFor) {
      voteTallies[p.votedFor] = (voteTallies[p.votedFor] || 0) + 1;
    }
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left panel: General suspects board */}
      <div className="lg:col-span-8 space-y-5">
        <div className="glass-panel rounded-2xl p-6 flex flex-col space-y-4 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 fog-pane opacity-60 pointer-events-none" />

          {/* Glowing tension bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#07080A] overflow-hidden">
            <motion.div 
              className={`h-full ${timeLeft <= 10 ? "bg-rose-500 animate-pulse" : "bg-cyan-500"}`}
              initial={{ width: "100%" }}
              animate={{ width: `${(timeLeft / 45) * 100}%` }}
              transition={{ duration: 1, ease: "linear" }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-crimson-500/10 border border-rose-500/30 rounded-xl">
                <Vote className="h-5 w-5 text-rose-500 animate-pulse" />
              </div>
              <div>
                <h2 className="font-display font-bold text-sm text-slate-100 flex items-center gap-2">
                  CONDUIT REFERENDUM: UNMASK THE SABOTEUR
                </h2>
                <p className="text-[10px] font-mono text-slate-400">
                  DEMOCRATIC ALIGNMENT OF ALL LOGGED CLUES
                </p>
              </div>
            </div>

            {!hasVoted && (
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono font-bold ${
                timeLeft <= 10 
                  ? "bg-rose-950/40 border-rose-500/40 text-rose-500 animate-bounce" 
                  : "bg-white/2 border-white/8 text-cyan-400"
              }`}>
                <Clock className="w-3.5 h-3.5" />
                <span>{timeLeft}s</span>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-350 select-none leading-relaxed">
            Read carefully through each suspect's submitted clue on the case record below. Detectives are verifying details. Imposter who didn't know the word is pretending or blending. Double click or tap any card to lock your accusation!
          </p>

          {/* Suspect cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {playerList.map((player) => {
              const isMe = player.id === currentPlayerId;
              const avatar = DETECTIVE_AVATARS.find(a => a.id === player.avatarId) || DETECTIVE_AVATARS[0];
              const votesReceived = voteTallies[player.id] || 0;
              const isSuspectSelected = selectedSuspectId === player.id || me?.votedFor === player.id;
              
              return (
                <button
                  key={player.id}
                  disabled={hasVoted || isMe}
                  onClick={() => handleCastVote(player.id)}
                  className={`relative p-4 rounded-xl border text-left flex flex-col justify-between transition-all duration-300 min-h-[140px] items-stretch ${
                    isMe
                      ? "bg-white/1 border-transparent opacity-40 cursor-not-allowed select-none"
                      : hasVoted
                        ? isSuspectSelected
                          ? "bg-rose-500/10 border-rose-500/30 text-rose-100"
                          : "bg-white/3 border-white/8 text-slate-200"
                        : "bg-white/3 border-white/8 hover:border-cyan-500/30 hover:scale-[1.01] hover:bg-white/5 cursor-pointer"
                  }`}
                >
                  {/* Card top details */}
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-2xl shrink-0 border border-slate-850"
                      style={{ backgroundColor: avatar.bgHex }}
                    >
                      {avatar.emoji}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-100 truncate block">
                        {player.name}
                      </span>
                      <span className="text-[9px] font-mono text-slate-450 truncate block mt-0.5">
                        {avatar.title}
                      </span>
                    </div>
                  </div>

                  {/* Submitted clue middle details */}
                  <div className="mt-3 bg-[#07080A] p-2.5 rounded-lg border border-white/5 min-h-[50px] flex items-center">
                    <p className="text-[11px] font-mono leading-relaxed italic text-slate-300 w-full line-clamp-2">
                      {player.clue ? `"${player.clue}"` : "❌ NO EVIDENCE SUBMITTED"}
                    </p>
                  </div>

                  {/* Card bottom details / indicators */}
                  <div className="mt-3 flex items-center justify-between border-t border-white/6 pt-2 text-[10px] font-mono">
                    {hasVoted ? (
                      <span className="text-rose-450 font-bold flex items-center gap-1 text-[9px] uppercase tracking-wider">
                        <ShieldAlert className="w-3 h-3 text-rose-500 animate-pulse" />
                        SUSPICION SHIELD
                      </span>
                    ) : isMe ? (
                      <span className="text-slate-500 text-[9px] uppercase">ACCUSATION EXCLUDED</span>
                    ) : (
                      <span className="text-cyan-400 group-hover:text-cyan-300 text-[9px] uppercase flex items-center gap-1">
                        ACCUSE PLAYER
                      </span>
                    )}

                    {/* Accused Live Count ticker */}
                    {hasVoted && votesReceived > 0 && (
                      <motion.div 
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        className="bg-rose-950 border border-rose-500/40 text-rose-400 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold animate-pulse text-[10px]"
                      >
                        <Vote className="w-3 h-3 text-rose-400" />
                        <span>{votesReceived} Accusations</span>
                      </motion.div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right panel: Active Room progress */}
      <div className="lg:col-span-4 space-y-5">
        <div className="glass-panel rounded-2xl p-5 flex flex-col space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-xs tracking-wider text-slate-300 uppercase">
              VOTING DECISIONS
            </h3>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-900/30">
              {playerList.filter(p => !!p.votedFor).length} / {playerList.length} DECREES
            </span>
          </div>

          <div className="space-y-2">
            {playerList.map((player) => {
              const avatar = DETECTIVE_AVATARS.find(a => a.id === player.avatarId) || DETECTIVE_AVATARS[0];
              const voted = !!player.votedFor;

              return (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${
                    voted 
                      ? "bg-white/3 border-rose-500/20 text-rose-250 font-bold" 
                      : "bg-white/1 border-white/6 text-slate-400"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{avatar.emoji}</span>
                    <span className="font-bold truncate max-w-[100px]">{player.name}</span>
                  </div>

                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    voted
                      ? "bg-rose-950/20 text-rose-400 border-rose-500/20"
                      : "bg-slate-900 border-slate-800 text-slate-500"
                  }`}>
                    {voted ? "DECREED" : "DECIDING..."}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Helpful Tip */}
        <div className="bg-[#07080A] border border-white/6 p-4 rounded-2xl space-y-2 flex gap-3.5 items-start">
          <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-[11px] font-bold text-slate-300">INVESTIGATION ANALYTICS</h4>
            <p className="text-[10px] font-mono text-slate-500 leading-normal">
              The Imposter's clue is usually more abstract, poetic, or generic than typical clues because they lack keyword context. Cross-examine thoroughly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
