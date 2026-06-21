import React, { useState, useEffect, useRef } from "react";
import { 
  db, 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  onSnapshot, 
  orderBy, 
  query 
} from "@/src/firebase";
import { ChatMessage, Player, DETECTIVE_AVATARS } from "@/src/types";
import { sound } from "@/src/lib/sound";
import { Send, CornerUpLeft, Smile, MessageSquareCode, Clock } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ChatSystemProps {
  roomId: string;
  currentPlayerId: string;
  players: Record<string, Player>;
}

export default function ChatSystem({ roomId, currentPlayerId, players }: ChatSystemProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [showEmojiPickerFor, setShowEmojiPickerFor] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const me = players[currentPlayerId];

  // Subscribe to real-time chat messages
  useEffect(() => {
    if (!roomId) return;
    const messagesCol = collection(db, "rooms", roomId, "messages");
    const q = query(messagesCol, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as ChatMessage);
      });
      
      // Play message sound if new message is from someone else
      if (msgs.length > messages.length) {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg.senderId !== currentPlayerId) {
          sound.playMessage();
        }
      }
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [roomId, messages.length, currentPlayerId]);

  // Handle typing indicator updates
  const setTypingStatus = async (isTyping: boolean) => {
    if (!roomId || !currentPlayerId) return;
    try {
      const playerDocRef = doc(db, "rooms", roomId);
      await updateDoc(playerDocRef, {
        [`players.${currentPlayerId}.typing`]: isTyping
      });
    } catch (e) {
      console.error("Failed to update typing status:", e);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setTypingStatus(e.target.value.length > 0);
  };

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !roomId || !me) return;

    try {
      const chatsCol = collection(db, "rooms", roomId, "messages");
      
      const newMsg: Partial<ChatMessage> = {
        senderId: currentPlayerId,
        senderName: me.name,
        senderAvatar: me.avatarId,
        text: inputValue.trim(),
        timestamp: Date.now(),
        reactions: []
      };

      if (replyTo) {
        newMsg.replyTo = {
          senderName: replyTo.senderName,
          text: replyTo.text
        };
      }

      await addDoc(chatsCol, newMsg);
      sound.playMessage();
      
      // Reset input states
      setInputValue("");
      setReplyTo(null);
      await setTypingStatus(false);
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  // Add Emoji Reaction
  const handleAddReaction = async (messageId: string, emoji: string) => {
    if (!roomId || !me) return;
    try {
      const msgRef = doc(db, "rooms", roomId, "messages", messageId);
      const targetMsg = messages.find(m => m.id === messageId);
      if (!targetMsg) return;

      let updatedReactions = targetMsg.reactions ? [...targetMsg.reactions] : [];
      const existingReactionIndex = updatedReactions.findIndex(r => r.emoji === emoji);

      if (existingReactionIndex > -1) {
        const react = updatedReactions[existingReactionIndex];
        const userIndex = react.authors.indexOf(me.name);
        
        if (userIndex > -1) {
          // Player already reacted - toggle off
          react.authors.splice(userIndex, 1);
          if (react.authors.length === 0) {
            updatedReactions.splice(existingReactionIndex, 1);
          }
        } else {
          // Add player to reactor authors
          react.authors.push(me.name);
        }
      } else {
        // Create new emoji reaction block
        updatedReactions.push({
          emoji,
          authors: [me.name]
        });
      }

      await updateDoc(msgRef, { reactions: updatedReactions });
      sound.playMessage();
      setShowEmojiPickerFor(null);
    } catch (err) {
      console.error("Error toggling reaction:", err);
    }
  };

  // Typing Detectives list
  const typingPlayers = Object.values(players).filter(
    (p) => p.id !== currentPlayerId && p.typing && p.isOnline
  );

  const availableEmojis = ["🔎", "🕵️‍♂️", "🚨", "🤫", "🤔", "🍿", "🔥", "👎"];

  return (
    <div className="flex flex-col h-[480px] glass overflow-hidden shadow-2xl relative">
      {/* Lobby Header bar */}
      <div className="px-4 py-3 bg-white/3 border-b border-white/8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquareCode className="h-4 w-4 text-cyan-400" />
          <span className="text-[11px] uppercase tracking-[0.2em] opacity-60 text-white">
            Encrypted Comms
          </span>
        </div>
        <div className="text-[10px] mono bg-cyan-500/10 text-cyan-450 px-2.5 py-0.5 rounded-full border border-cyan-500/15 flex items-center gap-1.5 h-6">
          <Clock className="w-3 h-3 text-cyan-405" />
          SYNCED WIRE
        </div>
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3.5 relative">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40 px-6">
            <span className="text-3xl mb-1.5 font-display">🕵️</span>
            <p className="text-xs font-mono tracking-wider max-w-xs">
              THE WIRE IS LIVE. INTEL SHARED HERE WILL BE VIEWED BY DEPT.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentPlayerId;
            const senderDetails = DETECTIVE_AVATARS.find(a => a.id === msg.senderAvatar);
            
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-2.5 max-w-[85%] ${isMe ? "ml-auto flex-row-reverse" : "mr-auto"}`}
              >
                {/* Avatar bubble */}
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-lg shadow-inner shrink-0"
                  style={{ backgroundColor: senderDetails?.bgHex || "#334155" }}
                  title={`${msg.senderName} (${senderDetails?.name || "Detective"})`}
                >
                  {senderDetails?.emoji || "👤"}
                </div>

                <div className="flex flex-col space-y-1 relative group">
                  {/* Sender Name */}
                  <div className="flex items-center gap-1.5 text-[11px] font-mono font-medium text-slate-400">
                    <span>{msg.senderName}</span>
                    <span className="text-[9px] opacity-40">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>

                  {/* Bubble content */}
                  <div 
                    className={`px-3 py-2 rounded-xl text-xs relative select-all leading-relaxed font-mono ${
                      isMe 
                        ? "bg-cyan-500/10 border border-cyan-500/25 text-cyan-200 rounded-tr-none" 
                        : "bg-white/5 border border-white/10 text-slate-100 rounded-tl-none"
                    }`}
                  >
                    {/* Reply preview inside bubble */}
                    {msg.replyTo && (
                      <div className="mb-2 pl-2 border-l-2 border-cyan-400/40 py-0.5 text-[10px] text-slate-400 bg-black/25 rounded">
                        <div className="font-semibold text-cyan-400">{msg.replyTo.senderName}</div>
                        <div className="truncate italic">"{msg.replyTo.text}"</div>
                      </div>
                    )}
                    
                    <p className="whitespace-pre-wrap">{msg.text}</p>

                    {/* Emoji List rendered on bubble bottom */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {msg.reactions.map((react, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleAddReaction(msg.id, react.emoji)}
                            className="bg-slate-950/90 hover:bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded-full text-[10px] text-slate-400 flex items-center gap-1 transition-all duration-200"
                            title={`Reacted by: ${react.authors.join(", ")}`}
                          >
                            <span>{react.emoji}</span>
                            <span className="text-[9px] font-mono text-cyan-400 font-bold">{react.authors.length}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Inline micro buttons shown on hover */}
                  <div className={`absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-lg p-0.5 shadow-lg ${
                    isMe ? "right-full mr-1.5" : "left-full ml-1.5"
                  }`}>
                    {/* Reply icon */}
                    <button
                      onClick={() => setReplyTo(msg)}
                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-cyan-400 transition-colors"
                      title="Reply"
                    >
                      <CornerUpLeft className="h-3 w-3" />
                    </button>
                    {/* Reaction Picker launcher */}
                    <button
                      onClick={() => setShowEmojiPickerFor(showEmojiPickerFor === msg.id ? null : msg.id)}
                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-cyan-400 transition-colors"
                      title="React"
                    >
                      <Smile className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Reaction Choice Dropdown list */}
                  <AnimatePresence>
                    {showEmojiPickerFor === msg.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 4 }}
                        className={`absolute z-20 flex gap-1 p-1 bg-slate-950 border border-cyan-500/40 rounded-lg shadow-2xl -top-10 ${
                          isMe ? "right-0" : "left-0"
                        }`}
                      >
                        {availableEmojis.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleAddReaction(msg.id, emoji)}
                            className="p-1 hover:bg-slate-850 hover:scale-125 rounded transition-transform text-sm"
                          >
                            {emoji}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Typing Indicators */}
      <AnimatePresence>
        {typingPlayers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute bottom-[58px] left-4 bg-slate-950/90 border border-slate-900/85 px-3 py-1 rounded-full text-[10px] font-mono text-cyan-400/80 flex items-center gap-1.5 z-10 shadow-md backdrop-blur-md"
          >
            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
            <span className="text-slate-400 font-medium">
              {typingPlayers.map((tp) => tp.name).join(", ")}
            </span>{" "}
            {typingPlayers.length === 1 ? "is logging clues..." : "are comparing theories..."}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Tray */}
      <form onSubmit={handleSendMessage} className="bg-white/1 border-t border-white/8 p-3 flex flex-col gap-1.5">
        {/* Reply Preview Tray */}
        {replyTo && (
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-cyan-950/20 border-l-[3px] border-cyan-500 rounded text-[11px] text-cyan-300">
            <div className="truncate">
              Replying to <span className="font-semibold text-cyan-400">{replyTo.senderName}</span>: <span className="italic">"{replyTo.text}"</span>
            </div>
            <button 
              type="button" 
              onClick={() => setReplyTo(null)}
              className="text-slate-400 hover:text-white font-bold px-1 ml-2 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            id="chat-input-text"
            placeholder={replyTo ? "Compose a response..." : "Message..."}
            value={inputValue}
            onChange={handleInputChange}
            onBlur={() => setTypingStatus(false)}
            maxLength={180}
            className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-xs text-slate-100 placeholder:opacity-30 outline-none focus:border-cyan-500/50 transition-all font-sans"
          />
          <button
            type="submit"
            id="chat-submit-btn"
            disabled={!inputValue.trim()}
            className="w-8 h-8 rounded-full bg-cyan-500 disabled:bg-white/10 disabled:text-white/30 text-black flex items-center justify-center shrink-0 cursor-pointer transition-all"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
