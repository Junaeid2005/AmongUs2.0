import React, { useState } from "react";
import { Player, DETECTIVE_AVATARS, DetectiveAvatar, GamePhase } from "@/src/types";
import { db, doc, updateDoc } from "@/src/firebase";
import { sound } from "@/src/lib/sound";
import { Users, Shield, Copy, Check, Play, LogOut, Info, Settings } from "lucide-react";
import { motion } from "motion/react";

interface DetectiveLobbyProps {
  roomId: string;
  currentPlayerId: string;
  players: Record<string, Player>;
  hostId: string;
  lobbyLimit: number;
  onLeave: () => void;
  onStartGame: () => void;
}

export default function DetectiveLobby({
  roomId,
  currentPlayerId,
  players,
  hostId,
  lobbyLimit,
  onLeave,
  onStartGame
}: DetectiveLobbyProps) {
  const [copied, setCopied] = useState(false);
  const [selectedAvatarId, setSelectedAvatarId] = useState(DETECTIVE_AVATARS[0].id);
  const [editingLimit, setEditingLimit] = useState(false);

  const me = players[currentPlayerId];
  const isHost = currentPlayerId === hostId;
  const playerList = Object.values(players);
  const activeCount = playerList.filter(p => p.isOnline).length;
  const isReadyToStart = activeCount >= 3;

  // Copy Case Link to Clipboard
  const copyRoomLink = () => {
    try {
      const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      sound.playJoin();
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  // Update lobby size limit
  const handleLimitChange = async (limitVal: number) => {
    if (!isHost || !roomId) return;
    try {
      const roomRef = doc(db, "rooms", roomId);
      await updateDoc(roomRef, {
        lobbyLimit: limitVal
      });
      sound.playMessage();
    } catch (e) {
      console.error(e);
    }
  };

  // Update my character avatar
  const handleAvatarSelect = async (avatarId: string) => {
    setSelectedAvatarId(avatarId);
    if (!roomId || !currentPlayerId) return;
    try {
      const roomRef = doc(db, "rooms", roomId);
      await updateDoc(roomRef, {
        [`players.${currentPlayerId}.avatarId`]: avatarId
      });
      sound.playMessage();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* LEFT: Briefing & Invite Card */}
      <div className="lg:col-span-5 space-y-5">
        <div className="glass-panel rounded-2xl p-6 relative overflow-hidden flex flex-col space-y-4 shadow-xl">
          <div className="absolute top-0 right-0 w-24 h-24 fog-pane opacity-60 pointer-events-none" />
          
          <div className="flex items-center gap-3">
            <div className="bg-cyan-500/10 border border-cyan-500/30 p-2.5 rounded-xl">
              <Users className="h-6 w-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-slate-100 tracking-wide">
                DEPT. BRIEFING LOBBY
              </h2>
              <p className="text-[11px] font-mono text-cyan-400 tracking-widest uppercase">
                CASE ROOM: #{roomId}
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-400 select-none leading-relaxed">
            Welcome, Investigator. We are seeking an imposter who's slipped into our secure communication network.
            You must share clues about the Case Word to isolate and eliminate the saboteur.
          </p>

          {/* Share Block */}
          <div className="bg-white/1 border border-white/6 rounded-xl p-3.5 space-y-2.5">
            <span className="text-[10px] font-mono text-slate-500 block">CASE ENTRANCE DIGITAL LINK</span>
            <div className="flex gap-2">
              <div className="flex-1 bg-black/40 border border-white/6 rounded-lg px-3 py-2 text-xs truncate select-all font-mono text-slate-400">
                {window.location.origin}/?room={roomId}
              </div>
              <button
                id="copy-link-btn"
                onClick={copyRoomLink}
                className="bg-white/5 hover:bg-white/10 hover:text-cyan-400 text-slate-300 border border-white/8 p-2 rounded-lg transition-all flex items-center justify-center cursor-pointer"
                title="Copy Room Link"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            {copied && (
              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                ✔ Case link cloned securely to clipboard.
              </span>
            )}
          </div>

          {/* Lobby Limit Settings for Host */}
          {isHost ? (
            <div className="bg-white/1 border border-white/6 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5 text-cyan-500" />
                  MAX CONCURRENT SLOTS
                </span>
                <span className="text-xs font-mono bg-cyan-500/10 text-cyan-455 px-2 py-0.5 rounded border border-cyan-500/20">
                  {lobbyLimit} Players
                </span>
              </div>
              <div className="flex gap-1.5">
                {[3, 4, 5, 6, 7, 8].map((limitVal) => (
                  <button
                    key={limitVal}
                    onClick={() => handleLimitChange(limitVal)}
                    className={`flex-1 py-1 px-2.5 rounded text-xs font-mono border transition-all ${
                      lobbyLimit === limitVal
                        ? "bg-cyan-500/15 border-cyan-400/50 text-cyan-300 shadow-sm"
                        : "bg-white/2 border-white/5 text-slate-500 hover:border-white/10 hover:text-slate-300"
                    }`}
                  >
                    {limitVal}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-white/1 border border-white/6 p-3 rounded-xl">
              <Info className="h-4 w-4 text-slate-550 shrink-0" />
              <span className="text-[11px] font-mono text-slate-500">
                The chief host sets the room size limit. Current: {lobbyLimit} agents.
              </span>
            </div>
          )}

          {/* Actions panel */}
          <div className="pt-2 flex flex-col gap-2.5">
            {isHost ? (
              <button
                id="start-investigation-btn"
                onClick={onStartGame}
                disabled={!isReadyToStart}
                className={`w-full font-display font-medium text-xs tracking-widest py-3 px-4 rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isReadyToStart
                    ? "bg-gradient-to-r from-cyan-600 to-blue-600 border-cyan-400 hover:shadow-cyan-500/20 glow-cyan text-white shadow-lg"
                    : "bg-slate-900/60 border-slate-800 text-slate-500 cursor-not-allowed"
                }`}
              >
                <Play className="h-4 w-4" />
                COMMENCE CASE STUDY ({activeCount}/{lobbyLimit})
              </button>
            ) : (
              <div className="w-full text-center py-2.5 px-4 bg-slate-950/50 border border-slate-900 rounded-xl">
                <span className="text-xs font-mono text-cyan-400/80 animate-pulse tracking-wide">
                  WAITING FOR HOST TO AUTHORIZE SIGNAL... ({activeCount}/{lobbyLimit})
                </span>
              </div>
            )}

            {!isReadyToStart && activeCount < 3 && (
              <p className="text-[10px] font-mono text-center text-amber-500/80">
                ⚠️ Mind the protocol: A minimum of 3 investigators is required to crosscheck claims.
              </p>
            )}

            <button
              onClick={onLeave}
              className="w-full py-2 px-4 rounded-xl border border-slate-800 hover:bg-slate-900 text-xs font-mono text-slate-500 hover:text-rose-400 hover:border-rose-950 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="h-3 w-3" />
              ABANDON ACTIVE INVESTIGATION
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT: Agent Selection and Active Slots */}
      <div className="lg:col-span-7 space-y-5">
        {/* Active Agents list */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-sm tracking-wider text-slate-200">
              ACTIVE ENLISTED DETECTIVES
            </h3>
            <span className="text-[10px] font-mono bg-cyan-950/40 text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-900/30 font-bold">
              {activeCount} READY
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {playerList.map((player) => {
              const avatar = DETECTIVE_AVATARS.find(a => a.id === player.avatarId) || DETECTIVE_AVATARS[0];
              const isMe = player.id === currentPlayerId;
              const isOwner = player.id === hostId;

              return (
                <div
                  key={player.id}
                  className={`relative p-3 rounded-xl border transition-all flex items-center gap-3 ${
                    player.isOnline 
                      ? isMe 
                        ? "bg-slate-900/90 border-cyan-500/40" 
                        : "bg-slate-900/50 border-slate-800"
                      : "bg-slate-950 border-slate-900/50 opacity-40"
                  }`}
                >
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-2xl shadow-inner shrink-0"
                    style={{ backgroundColor: avatar.bgHex }}
                  >
                    {avatar.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className={`text-xs font-bold truncate ${isMe ? "text-cyan-400" : "text-slate-200"}`}>
                        {player.name}
                      </span>
                      {isMe && <span className="text-[9px] font-mono text-cyan-400 px-1 border border-cyan-500/30 rounded scale-90">ME</span>}
                    </div>
                    <span className="text-[9px] font-mono text-slate-500 block truncate leading-none mt-0.5">
                      {avatar.title}
                    </span>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {isOwner && (
                      <span className="text-[8px] font-mono bg-amber-500/10 text-amber-500 border border-amber-500/30 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Shield className="w-2.5 h-2.5" />
                        HOST
                      </span>
                    )}
                    <span className={`w-1.5 h-1.5 rounded-full ${player.isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-700"}`} />
                  </div>
                </div>
              );
            })}

            {/* Empty slots placeholders */}
            {Array.from({ length: Math.max(0, lobbyLimit - playerList.length) }).map((_, idx) => (
              <div 
                key={idx} 
                className="border border-dashed border-slate-900 p-3 rounded-xl flex items-center gap-3 select-none opacity-20"
              >
                <div className="w-10 h-10 rounded-lg bg-slate-950 flex items-center justify-center text-sm font-mono text-slate-500 border border-slate-900">
                  ?
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-500">Vacant Case Slot</span>
                  <span className="text-[9px] font-mono text-slate-600 block mt-0.5">Awaiting agent connection...</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Change Detective Avatar card */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col space-y-4 shadow-xl">
          <h3 className="font-display font-bold text-sm tracking-wider text-slate-200">
            CHOOSE YOUR DETECTIVE DEPUTY
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {DETECTIVE_AVATARS.map((avatar) => {
              const isSelected = selectedAvatarId === avatar.id;
              return (
                <button
                  key={avatar.id}
                  onClick={() => handleAvatarSelect(avatar.id)}
                  className={`p-3 rounded-xl border text-center transition-all duration-300 hover:scale-[1.03] flex flex-col items-center justify-center relative cursor-pointer group ${
                    isSelected
                      ? "bg-slate-900 border-cyan-500/70 shadow-md text-cyan-400 shadow-cyan-500/5 glow-cyan"
                      : "bg-slate-950/80 border-slate-900 text-slate-400 hover:border-slate-800 hover:text-slate-350"
                  }`}
                >
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-3xl mb-2 transition-transform duration-300 group-hover:scale-110"
                    style={{ backgroundColor: avatar.bgHex }}
                  >
                    {avatar.emoji}
                  </div>
                  <span className="text-[11px] font-semibold leading-tight block truncate w-full">
                    {avatar.name.split(" ")[0]}
                  </span>
                  <span className="text-[9px] font-mono opacity-50 block truncate w-full mt-0.5">
                    {avatar.title.split(" ")[1] || avatar.title}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Background Story preview on hover / selection */}
          {(() => {
            const chosen = DETECTIVE_AVATARS.find(a => a.id === selectedAvatarId);
            return chosen ? (
              <div className="bg-slate-950 border border-slate-900/60 p-3.5 rounded-xl flex gap-3.5 items-start">
                <div className="text-3xl shrink-0 p-1.5 rounded bg-slate-900 border border-slate-800/80">
                  {chosen.emoji}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-cyan-400">{chosen.name}</h4>
                  <p className="text-[10px] font-mono text-slate-400 leading-normal mt-1">
                    "{chosen.description}"
                  </p>
                </div>
              </div>
            ) : null;
          })()}
        </div>
      </div>
    </div>
  );
}
