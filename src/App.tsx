import React, { useState, useEffect } from "react";
import { 
  auth, 
  db, 
  signInWithGoogle, 
  signInAsGuest, 
  logOut, 
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot
} from "@/src/firebase";
import { GamePhase, Room, Player, DETECTIVE_AVATARS, THEMATIC_WORDS } from "@/src/types";
import { sound } from "@/src/lib/sound";
import SoundToggle from "@/src/components/SoundToggle";
import DetectiveLobby from "@/src/components/DetectiveLobby";
import WordSubmission from "@/src/components/WordSubmission";
import WordReveal from "@/src/components/WordReveal";
import CluePhase from "@/src/components/CluePhase";
import VotingPanel from "@/src/components/VotingPanel";
import ResultPanel from "@/src/components/ResultPanel";
import ChatSystem from "@/src/components/ChatSystem";

import { 
  Fingerprint, 
  ShieldCheck, 
  EyeOff, 
  Users, 
  Plus, 
  LogIn, 
  User as UserIcon, 
  Flame, 
  LogOut as LogOutIcon, 
  ChevronRight, 
  Trophy, 
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  // Auth state
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [guestName, setGuestName] = useState("");
  const [authError, setAuthError] = useState("");

  // Room state
  const [roomIdInput, setRoomIdInput] = useState("");
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string>("");

  // App UI/Tab controllers
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [lobbySizeLimit, setLobbySizeLimit] = useState(5);

  // Play sound when component mounts
  useEffect(() => {
    // Check if room ID is prefilled in URL queries
    const params = new URLSearchParams(window.location.search);
    const prefilledRoomId = params.get("room");
    if (prefilledRoomId) {
      setRoomIdInput(prefilledRoomId.toUpperCase());
    }

    // Subscribe to Auth state changes
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        // Subscribe to user Firestore doc for stats
        const userRef = doc(db, "users", user.uid);
        const unsubscribeProfile = onSnapshot(userRef, (userSnapshot) => {
          if (userSnapshot.exists()) {
            setUserProfile(userSnapshot.data());
          }
        });
        return () => unsubscribeProfile();
      } else {
        setCurrentUser(null);
        setUserProfile(null);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Sync Room changes in Firestore real-time
  useEffect(() => {
    if (!activeRoomId) {
      setCurrentRoom(null);
      return;
    }

    const roomRef = doc(db, "rooms", activeRoomId);
    const unsubscribeRoom = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const roomData = snapshot.data() as Room;
        setCurrentRoom(roomData);

        // Auto-join active user profile to the room slots if not registered yet
        if (currentUser && roomData.players && !roomData.players[currentUser.uid]) {
          joinRoomAsPlayer(activeRoomId, currentUser, roomData);
        }

        // Play reactive state transition sound effects
        triggerPhaseTransitionsSounds(roomData.phase);
      } else {
        // Room was deleted or doesn't exist
        console.warn("Target room doesn't exist anymore");
        setActiveRoomId("");
        setCurrentRoom(null);
      }
    });

    return () => unsubscribeRoom();
  }, [activeRoomId, currentUser]);

  // Keep player online status synced with current room activity
  useEffect(() => {
    if (!activeRoomId || !currentUser) return;

    const roomRef = doc(db, "rooms", activeRoomId);

    // Mark online
    updateDoc(roomRef, {
      [`players.${currentUser.uid}.isOnline`]: true
    }).catch(e => console.error(e));

    const handleBackOnline = () => {
      updateDoc(roomRef, {
        [`players.${currentUser.uid}.isOnline`]: true
      });
    };

    const handleOffline = () => {
      updateDoc(roomRef, {
        [`players.${currentUser.uid}.isOnline`]: false
      });
    };

    window.addEventListener("focus", handleBackOnline);
    window.addEventListener("blur", handleOffline);
    window.addEventListener("beforeunload", handleOffline);

    return () => {
      window.removeEventListener("focus", handleBackOnline);
      window.removeEventListener("blur", handleOffline);
      window.removeEventListener("beforeunload", handleOffline);
      handleOffline();
    };
  }, [activeRoomId, currentUser]);

  // Handle phase change chime sounds safely
  let lastStatePhase: string | null = null;
  const triggerPhaseTransitionsSounds = (phase: GamePhase) => {
    if (phase === lastStatePhase) return;
    lastStatePhase = phase;

    switch (phase) {
      case GamePhase.SUBMITTING_WORDS:
        sound.playTurnChange();
        break;
      case GamePhase.WORD_REVEAL:
        sound.playJoin();
        break;
      case GamePhase.CLUE_PHASE:
        sound.playTurnChange();
        break;
      case GamePhase.VOTING_PHASE:
        sound.playVotingStarted();
        break;
      case GamePhase.REVEAL_PHASE:
        // Handled directly inside results module
        break;
      default:
        break;
    }
  };

  // Google Sign-In with popup handler
  const handleGoogleSignIn = async () => {
    setAuthError("");
    try {
      await signInWithGoogle();
      sound.playJoin();
    } catch (err: any) {
      setAuthError("Google pop-up was blocklisted or closed. Try utilizing Guest Entry fallback below.");
    }
  };

  // Guest Name-based entrance handler
  const handleGuestSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    const cleanName = guestName.trim();
    if (!cleanName) return;

    try {
      await signInAsGuest(cleanName);
      sound.playJoin();
    } catch (err) {
      setAuthError("Failed to register Guest session. Verify network alignment.");
    }
  };

  // Sign out
  const handleLogOut = async () => {
    if (activeRoomId) {
      await leaveRoom();
    }
    await logOut();
    sound.playTurnChange();
  };

  // Create game room
  const createCaseRoom = async () => {
    if (!currentUser) {
      setAuthError("No authorized session registered. Identify your identity first.");
      return;
    }
    setAuthError("");
    try {
      // 6 Character unique alphanumeric code
      const randCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const meName = userProfile?.displayName || currentUser.displayName || `Agent ${randCode.slice(0, 3)}`;
      
      const newRoomRef = doc(db, "rooms", randCode);

      const freshRoom: Room = {
        id: randCode,
        hostId: currentUser.uid,
        phase: GamePhase.LOBBY,
        players: {
          [currentUser.uid]: {
            id: currentUser.uid,
            name: meName,
            avatarId: DETECTIVE_AVATARS[0].id, // Default to first avatar Alistair
            isHost: true,
            isOnline: true
          }
        },
        secretWord: "",
        allSubmittedWords: [],
        imposterId: "",
        turnOrder: [],
        lobbyLimit: lobbySizeLimit,
        createdAt: Date.now()
      };

      await setDoc(newRoomRef, freshRoom);
      
      // Update browser URL query to easily support instant room sharing/joining
      const newUrl = `${window.location.origin}${window.location.pathname}?room=${randCode}`;
      window.history.replaceState({ path: newUrl }, "", newUrl);

      setActiveRoomId(randCode);
      sound.playJoin();
    } catch (e: any) {
      console.error("Firestore setDoc Failure:", e);
      setAuthError(`Failed to create case room: ${e.message || e}`);
    }
  };

  // Join existing room
  const joinCaseRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    const code = roomIdInput.trim().toUpperCase();
    if (!code) return;

    try {
      const roomRef = doc(db, "rooms", code);
      const roomSnap = await getDoc(roomRef);

      if (!roomSnap.exists()) {
        setAuthError(`No files match the Case Code: #${code}. Verify the letters and try again.`);
        return;
      }

      const roomData = roomSnap.data() as Room;
      const currentPlayers = Object.values(roomData.players).filter(p => p.isOnline);

      if (currentPlayers.length >= roomData.lobbyLimit && !roomData.players[currentUser?.uid || ""]) {
        setAuthError(`Operation console is full: Max limit of ${roomData.lobbyLimit} detectives is active.`);
        return;
      }

      // Sync browser url
      const newUrl = `${window.location.origin}${window.location.pathname}?room=${code}`;
      window.history.replaceState({ path: newUrl }, "", newUrl);

      setActiveRoomId(code);
      sound.playJoin();
    } catch (err) {
      setAuthError("An error occurred during network handshakes. Recheck logs.");
    }
  };

  // Join room helper called during sync
  const joinRoomAsPlayer = async (roomId: string, user: any, room: Room) => {
    try {
      const meName = userProfile?.displayName || user.displayName || `Guest Detective`;
      const isHost = user.uid === room.hostId;
      
      const roomRef = doc(db, "rooms", roomId);
      await updateDoc(roomRef, {
        [`players.${user.uid}`]: {
          id: user.uid,
          name: meName,
          avatarId: DETECTIVE_AVATARS[Math.floor(Math.random() * DETECTIVE_AVATARS.length)].id, // Random avatar assigned first
          isHost,
          isOnline: true
        }
      });
    } catch (err) {
      console.error("Failed to add player to room map:", err);
    }
  };

  // Leave active room
  const leaveRoom = async () => {
    if (!activeRoomId || !currentUser) return;
    try {
      const roomRef = doc(db, "rooms", activeRoomId);

      // Clean player trace, or simply set offline
      await updateDoc(roomRef, {
        [`players.${currentUser.uid}.isOnline`]: false
      });

      // Clear browser URL queries
      const newUrl = `${window.location.origin}${window.location.pathname}`;
      window.history.replaceState({ path: newUrl }, "", newUrl);

      setActiveRoomId("");
      setCurrentRoom(null);
      sound.playTurnChange();
    } catch (e) {
      console.error(e);
    }
  };

  // Start word submission phase
  const handleStartWordSubmission = async () => {
    if (!activeRoomId) return;
    try {
      const roomRef = doc(db, "rooms", activeRoomId);
      await updateDoc(roomRef, {
        phase: GamePhase.SUBMITTING_WORDS
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Submit my word to the pool
  const handleSubmitMyWord = async (word: string) => {
    if (!activeRoomId || !currentUser || !currentRoom) return;
    
    try {
      const roomRef = doc(db, "rooms", activeRoomId);
      
      // Update player profile with their creative word
      await updateDoc(roomRef, {
        [`players.${currentUser.uid}.wordSubmitted`]: word,
        allSubmittedWords: [...(currentRoom.allSubmittedWords || []), word]
      });

      // Fetch fresh snapshot data to coordinate transitions
      const freshSnap = await getDoc(roomRef);
      if (freshSnap.exists()) {
        const freshRoom = freshSnap.data() as Room;
        const playerList = Object.values(freshRoom.players).filter(p => p.isOnline);
        const hasAllSubmitted = playerList.every((p) => !!p.wordSubmitted);

        // Transition from SUBMITTING_WORDS to WORD_REVEAL!
        if (hasAllSubmitted) {
          await transitionToWordReveal(roomRef, playerList, freshRoom.allSubmittedWords);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Host coordinates assigning roles, selecting one secret word, and shuffling turns
  const transitionToWordReveal = async (roomRef: any, playerList: Player[], wordPool: string[]) => {
    try {
      // 1. Pick a random word from submissions, fallback to curated lists if empty
      let chosenWord = "FOOTPRINT";
      if (wordPool && wordPool.length > 0) {
        chosenWord = wordPool[Math.floor(Math.random() * wordPool.length)];
      } else {
        const randomThematicPair = THEMATIC_WORDS[Math.floor(Math.random() * THEMATIC_WORDS.length)];
        chosenWord = randomThematicPair[0];
      }

      // 2. Select randomly one Imposter
      const sortedOnlineIds = playerList.map(p => p.id);
      const impId = sortedOnlineIds[Math.floor(Math.random() * sortedOnlineIds.length)];

      // 3. Setup shuffled turn order
      const shuffledTurnOrder = [...sortedOnlineIds].sort(() => Math.random() - 0.5);

      // Create updates dictionary
      const updates: Record<string, any> = {
        phase: GamePhase.WORD_REVEAL,
        secretWord: chosenWord,
        imposterId: impId,
        turnOrder: shuffledTurnOrder,
        currentTurnId: shuffledTurnOrder[0],
        turnStartedAt: Date.now()
      };

      // Set roles on members
      playerList.forEach((player) => {
        updates[`players.${player.id}.role`] = player.id === impId ? "IMPOSTER" : "DETECTIVE";
        updates[`players.${player.id}.clue`] = ""; // Ensure clues are clear
        updates[`players.${player.id}.votedFor`] = ""; // Ensure votes are clear
      });

      await updateDoc(roomRef, updates);
    } catch (err) {
      console.error("Transition to Word Reveal failed:", err);
    }
  };

  // Advance WordReveal -> CluePhase once client clicks Understood
  useEffect(() => {
    // When in WORD_REVEAL, we track if all online players have cleared role descriptions
    if (!currentRoom || currentRoom.phase !== GamePhase.WORD_REVEAL) return;

    const playerList = (Object.values(currentRoom.players) as Player[]).filter(p => p.isOnline);
    // Role is cleared if 'clue' is initialized to empty string "" instead of undefined
    const allAcknowledged = playerList.every((p) => p.clue === "");

    if (allAcknowledged) {
      const roomRef = doc(db, "rooms", activeRoomId);
      updateDoc(roomRef, {
        phase: GamePhase.CLUE_PHASE,
        turnStartedAt: Date.now()
      }).catch(e => console.error(e));
    }
  }, [currentRoom?.players]);

  // Submit my sentence clue on my turn
  const handleSubmitMyClue = async (clueText: string) => {
    if (!activeRoomId || !currentUser || !currentRoom) return;

    try {
      const roomRef = doc(db, "rooms", activeRoomId);
      const order = currentRoom.turnOrder;
      const curIndex = order.indexOf(currentUser.uid);

      // Save clue statement
      const updates: Record<string, any> = {
        [`players.${currentUser.uid}.clue`]: clueText
      };

      // Decide next turn index
      if (curIndex < order.length - 1) {
        // Next detective's turn
        updates.currentTurnId = order[curIndex + 1];
        updates.turnStartedAt = Date.now();
      } else {
        // All turns finished! Advance to VOTING_PHASE!
        updates.phase = GamePhase.VOTING_PHASE;
        updates.currentTurnId = "";
        updates.turnStartedAt = Date.now();
      }

      await updateDoc(roomRef, updates);
    } catch (e) {
      console.error(e);
    }
  };

  // Cast suspect vote
  const handleCastSuspectVote = async (suspectId: string) => {
    if (!activeRoomId || !currentUser || !currentRoom) return;

    try {
      const roomRef = doc(db, "rooms", activeRoomId);
      await updateDoc(roomRef, {
        [`players.${currentUser.uid}.votedFor`]: suspectId
      });

      // Fetch fresh snapshot to check if everyone voted
      const freshSnap = await getDoc(roomRef);
      if (freshSnap.exists()) {
        const freshRoom = freshSnap.data() as Room;
        const playerList = Object.values(freshRoom.players).filter(p => p.isOnline);
        const allVoted = playerList.every((p) => !!p.votedFor);

        if (allVoted) {
          // Resolve voting tallies!
          await resolveVotingOutcome(roomRef, playerList, freshRoom);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Calculate most suspected player ID and transition to REVEAL_PHASE
  const resolveVotingOutcome = async (roomRef: any, playerList: Player[], room: Room) => {
    try {
      const tallies: Record<string, number> = {};
      playerList.forEach((p) => {
        if (p.votedFor) {
          tallies[p.votedFor] = (tallies[p.votedFor] || 0) + 1;
        }
      });

      // Find highest tally
      let votedOutId = playerList[0].id;
      let maxVotes = -1;

      playerList.forEach((p) => {
        const votes = tallies[p.id] || 0;
        if (votes > maxVotes) {
          maxVotes = votes;
          votedOutId = p.id;
        }
      });

      const isRealImposter = votedOutId === room.imposterId;
      
      const updates: Record<string, any> = {
        phase: GamePhase.REVEAL_PHASE,
        votedOutPlayerId: votedOutId
      };

      // If voted-out is NOT the imposter, search failed! Imposter wins!
      if (!isRealImposter) {
        updates.winner = "IMPOSTER";
        // Also increase stats
        await logRoundStats(room.imposterId, votedOutId);
      } else {
        // Voted out is real imposter! They get a chance to save themselves
        // Winner is undetermined until they guess.
      }

      await updateDoc(roomRef, updates);
    } catch (e) {
      console.error("Failed to resolve vote outcome:", e);
    }
  };

  // Write stats changes onto user profile cards in Firestore
  const logRoundStats = async (winnerUid: string, loserUid?: string) => {
    try {
      // Award winner wins++
      const winRef = doc(db, "users", winnerUid);
      const winSnap = await getDoc(winRef);
      if (winSnap.exists()) {
        const p = winSnap.data();
        await updateDoc(winRef, {
          gamesPlayed: (p.gamesPlayed || 0) + 1,
          gamesWon: (p.gamesWon || 0) + 1,
          imposterWins: winnerUid === currentRoom?.imposterId ? (p.imposterWins || 0) + 1 : (p.imposterWins || 0)
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Launch fresh new round resetting players state
  const handleResetToNewRound = async () => {
    if (!activeRoomId || !currentRoom) return;

    try {
      const roomRef = doc(db, "rooms", activeRoomId);
      const onlinePlayers = (Object.values(currentRoom.players) as Player[]).filter(p => p.isOnline);

      const updates: Record<string, any> = {
        phase: GamePhase.LOBBY,
        secretWord: "",
        allSubmittedWords: [],
        imposterId: "",
        votedOutPlayerId: "",
        imposterGuessAttempt: "",
        turnOrder: [],
        currentTurnId: "",
        winner: ""
      };

      onlinePlayers.forEach((player) => {
        updates[`players.${player.id}.wordSubmitted`] = "";
        updates[`players.${player.id}.clue`] = "";
        updates[`players.${player.id}.votedFor`] = "";
        updates[`players.${player.id}.role`] = "";
      });

      await updateDoc(roomRef, updates);
    } catch (e) {
      console.error(e);
    }
  };

  // Character badges dictionary for profile display
  const rankFromWins = (won: number) => {
    if (won >= 15) return "Chief Bureau Director 👑";
    if (won >= 8) return "Senior Forensic Sleuth 🔎";
    if (won >= 3) return "Special Desk Investigator 🚨";
    return "Probationary Deputy Agent 👤";
  };

  return (
    <div className="min-h-screen flex flex-col justify-between relative bg-[#07080A] text-[#E2E8F0] selection:bg-cyan-500/30 selection:text-cyan-300">
      {/* Cinematic grid overlay and subtle top nebula */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[280px] bg-cyan-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* HEADER NAVIGATION BAR */}
      <header className="w-full z-30 px-4 py-6 sm:px-6 max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-white/10 pb-6 mb-8 bg-transparent">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-white/3 border border-white/8 rounded-xl glow-cyan animate-pulse">
            <Fingerprint className="h-5 w-5 text-cyan-400" />
          </div>
          <div className="select-none flex flex-col">
            <span className="text-[10px] tracking-[0.4em] uppercase opacity-50 mb-1 font-sans">Social Deduction Protocol</span>
            <h1 className="text-3xl sm:text-4xl serif-italic tracking-tight text-white leading-none">
              Detective Imposter
            </h1>
          </div>
        </div>

        {/* Global Sound controller and active Profile */}
        <div className="flex items-center gap-4 self-end sm:self-auto">
          <SoundToggle />

          {currentUser && (
            <div className="flex items-center gap-3 bg-white/3 border border-white/8 px-4 py-2 rounded-xl text-xs font-mono shadow-lg">
              <UserIcon className="h-3.5 w-3.5 text-cyan-400" />
              <div className="hidden sm:block text-left select-all leading-snug">
                <span className="font-bold text-slate-200 block truncate max-w-[110px]">{userProfile?.displayName || currentUser.displayName || "Agent"}</span>
                <span className="text-[8px] text-slate-500 leading-none block uppercase tracking-wider">
                  {rankFromWins(userProfile?.gamesWon || 0)}
                </span>
              </div>
              <button 
                onClick={handleLogOut}
                className="hover:text-rose-400 transition-colors p-1"
                title="Disconnect Credentials"
              >
                <LogOutIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* MAIN SCREEN AREA */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 sm:px-6 z-20">
        <AnimatePresence mode="wait">
          {!currentUser ? (
            /* ONBOARDING USER REGISTRATION */
            <motion.div
              key="auth-gate"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="max-w-md mx-auto py-10"
            >
              <div className="glass-panel rounded-3xl p-8 relative overflow-hidden flex flex-col space-y-6 shadow-2xl text-center border-t border-cyan-500/30">
                <div className="absolute top-0 right-0 w-32 h-32 fog-pane opacity-60 pointer-events-none" />

                <div className="space-y-1 mt-2">
                  <span className="text-[9.5px] font-mono tracking-widest text-slate-500 uppercase block font-bold">
                    SECURITY ACCESS GATEWAY
                  </span>
                  <h2 className="font-display font-black text-2xl tracking-wider text-slate-100">
                    IDENTIFY YOUR IDENTITY
                  </h2>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                  Authorizing access to encrypted deduction cases. Log in using Google credentials to catalog case stats, or proceed anonymously using custom pen-name credentials.
                </p>

                {authError && (
                  <div className="bg-rose-950/35 border border-rose-500/20 p-3.5 rounded-xl text-left flex gap-2.5 items-start">
                    <AlertCircle className="h-4.5 w-4.5 text-rose-500 shrink-0 mt-0.5" />
                    <span className="text-[11px] text-rose-350 leading-relaxed font-mono uppercase">{authError}</span>
                  </div>
                )}

                {/* Primary Google auth */}
                <button
                  id="google-signin-btn"
                  onClick={handleGoogleSignIn}
                  className="bg-slate-900 hover:bg-slate-850 text-slate-100 hover:text-white border border-slate-850 hover:border-cyan-500/30 py-3.5 px-6 rounded-xl text-xs font-mono font-medium transition-all shadow-md flex items-center justify-center gap-2.5 cursor-pointer glow-cyan"
                >
                  <img src="https://www.gstatic.com/mobilesdk/160512_mobilesdk/images/otm/google_signin_button.svg" className="h-4 w-4" alt="Google logo" referrerPolicy="no-referrer" />
                  SIGN IN SECURELY WITH GOOGLE
                </button>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-slate-900"></div>
                  <span className="flex-shrink mx-4 text-[9px] font-mono text-slate-500 uppercase tracking-widest">OR LOG IN ANONYMOUSLY</span>
                  <div className="flex-grow border-t border-slate-900"></div>
                </div>

                {/* Backup Guest login */}
                <form onSubmit={handleGuestSignIn} className="space-y-3">
                  <input
                    type="text"
                    id="guest-nickname-input"
                    maxLength={13}
                    placeholder="ENTER AGENT NICKNAME..."
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-200 placeholder:opacity-30 outline-none focus:border-cyan-500/50 transition-all font-mono tracking-widest text-center"
                    required
                  />
                  <button
                    type="submit"
                    id="guest-signin-btn"
                    className="w-full bg-slate-900 hover:bg-slate-850 text-slate-350 hover:text-cyan-400 font-mono text-xs font-bold py-3 px-6 rounded-xl border border-slate-850 hover:border-cyan-500/20 transition-all cursor-pointer uppercase flex items-center justify-center gap-1"
                  >
                    ENTER CASE AS VISITING DEPUTY
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </motion.div>
          ) : !currentRoom ? (
            /* MAIN NAVIGATION LOBBY / HOMEPAGE */
            <motion.div
              key="main-center"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center py-6"
            >
              {/* LEFT COLUMN: Cinematic game title, particles, and core buttons */}
              <div className="md:col-span-7 space-y-6 text-left">
                <div className="space-y-4 select-none">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/3 text-cyan-400 border border-white/8 w-fit rounded-full text-[9px] font-mono tracking-[0.25em] uppercase">
                    Social Deduction Protocol
                  </div>
                  <h1 className="serif-italic text-5xl sm:text-6xl lg:text-7xl text-white tracking-tight leading-none">
                    Echo of Doubt
                  </h1>
                  <p className="text-[10px] uppercase tracking-[0.34em] text-cyan-400/80 font-mono">
                    — REGIONAL IMPOSTER DETECTOR
                  </p>
                  <p className="text-xs text-slate-400 font-sans max-w-lg leading-relaxed">
                    An immersive multiplayer deduction platform. Identify the imposters who've entered communication wires without the secret keyword. Formulate clues, analyze signals, real-time message, vote suspects, and win the archives case.
                  </p>
                </div>

                {authError && (
                  <div className="bg-rose-950/20 border border-rose-500/25 p-3 rounded-xl max-w-lg text-xs font-mono text-rose-450 uppercase">
                    ⚠ {authError}
                  </div>
                )}

                {/* Operations board creation and joining module */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                  <div className="glass-panel rounded-2xl p-4 flex flex-col justify-between space-y-4 shadow-xl border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-cyan-400/5 blur-xl group-hover:bg-cyan-400/10 transition-colors pointer-events-none" />
                    <div className="space-y-1 select-none">
                      <h4 className="text-xs font-bold text-slate-200">LAUNCH ENCRYPTION WIRE</h4>
                      <p className="text-[10px] text-slate-500 leading-normal">Create a custom social session and invite up to 8 other investigators.</p>
                    </div>
                    <button
                      id="create-game-btn"
                      onClick={createCaseRoom}
                      className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 font-display font-medium text-xs tracking-wider text-white py-2.5 px-4 rounded-xl border border-cyan-400/25 transition-all outline-none cursor-pointer flex items-center justify-center gap-1.5 glow-cyan"
                    >
                      <Plus className="w-4 h-4" />
                      CREATE GAME
                    </button>
                  </div>

                  <div className="glass-panel rounded-2xl p-4 flex flex-col justify-between space-y-4 shadow-xl border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 blur-xl group-hover:bg-blue-500/10 transition-colors pointer-events-none" />
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-slate-200 uppercase">ACCESS INVESTIGATION</h4>
                      <p className="text-[10px] text-slate-500 leading-normal font-sans">Input a unique 6-character room identifier code to slide inside.</p>
                    </div>
                    <form onSubmit={joinCaseRoom} className="space-y-2">
                      <input
                        type="text"
                        id="join-code-input"
                        placeholder="ENTER CASE CODE..."
                        value={roomIdInput}
                        onChange={(e) => setRoomIdInput(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono tracking-widest text-center uppercase outline-none focus:border-cyan-500/40"
                        maxLength={6}
                        required
                      />
                      <button
                        type="submit"
                        id="join-game-btn"
                        className="w-full bg-slate-800 hover:bg-slate-705 border border-slate-75 * text-slate-300 hover:text-cyan-400 font-mono text-xs font-bold py-2 rounded-lg transition-all cursor-pointer uppercase flex items-center justify-center gap-1"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        JOIN LOBBY
                      </button>
                    </form>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Profile Stats Case card */}
              <div className="md:col-span-5 col-span-12">
                <div className="glass-panel rounded-3xl p-6 flex flex-col space-y-4 shadow-2xl relative border border-white/5">
                  <div className="absolute top-0 right-0 w-24 h-24 fog-pane opacity-60 pointer-events-none" />
                  
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 rounded-2xl shadow-inner">
                      <Trophy className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-display font-black text-sm text-slate-100 tracking-wider">
                        DOSSIER STATS & HISTORIC RECORDS
                      </h3>
                      <p className="text-[9px] font-mono text-slate-500">
                        PERSISTENT FIRESTORE DATA SHEET
                      </p>
                    </div>
                  </div>

                  {/* Profile data listings */}
                  <div className="space-y-2 text-xs font-mono">
                    <div className="bg-white/2 p-3 rounded-xl border border-white/6 flex justify-between items-center">
                      <span className="text-slate-500">OFFICER REGISTER:</span>
                      <span className="font-bold text-slate-300 truncate max-w-[140px]">{userProfile?.displayName || currentUser.displayName || "Deputy vis."}</span>
                    </div>

                    <div className="bg-white/2 p-3 rounded-xl border border-white/6 flex justify-between items-center">
                      <span className="text-slate-500">CURRENT DEPUTY RANK:</span>
                      <span className="font-bold text-cyan-400">{rankFromWins(userProfile?.gamesWon || 0)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center pt-1.5">
                      <div className="bg-white/3 p-3.5 border border-white/8 rounded-xl relative overflow-hidden group">
                        <Flame className="w-4 h-4 text-rose-500 absolute top-2 right-2 opacity-20" />
                        <span className="text-slate-500 text-[9px] block uppercase leading-snug">Rounds Logged</span>
                        <span className="text-lg font-bold text-slate-200 mt-1 block">{userProfile?.gamesPlayed || 0}</span>
                      </div>
                      <div className="bg-white/3 p-3.5 border border-white/8 rounded-xl relative overflow-hidden group">
                        <Trophy className="w-4 h-4 text-yellow-500 absolute top-2 right-2 opacity-20" />
                        <span className="text-slate-500 text-[9px] block uppercase leading-snug">Deductions Won</span>
                        <span className="text-lg font-bold text-emerald-450 mt-1 block">{userProfile?.gamesWon || 0}</span>
                      </div>
                    </div>
                  </div>

                  <hr className="border-t border-white/5" />

                  <div className="text-[10px] text-slate-600 font-mono flex items-start gap-1.5">
                    <ShieldCheck className="w-4 w-4 text-cyan-500 shrink-0 mt-0.5" />
                    <span>Your scores and investigative rank saves continuously after every round to Firestore using your authenticated secure profile credentials.</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            /* ACTIVE ROOM WIREPLAY */
            <motion.div
              key="case-board"
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              className="space-y-6"
            >
              {/* Gameplay Layout header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-white/2 rounded-2xl border border-white/6 shadow-md">
                <div className="flex items-center gap-3 select-none">
                  <div className="w-10 h-10 rounded-xl bg-white/3 border border-white/8 flex items-center justify-center text-sm font-mono text-cyan-400 glow-cyan">
                    {currentRoom.id}
                  </div>
                  <div>
                    <span className="text-[9.5px] font-mono text-slate-500 block font-bold tracking-widest">ACTIVE OPERATION BOARD</span>
                    <h3 className="font-display font-medium text-xs text-slate-200">
                      CASE FILE INTEL CHANNEL
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs text-slate-500">
                  <Users className="w-4 h-4 text-cyan-500" />
                  <span>Enlisted Detectives:</span>
                  <strong className="text-slate-100 bg-white/3 border border-white/8 px-2 py-0.5 rounded">
                    {(Object.values(currentRoom.players) as Player[]).filter(p => p.isOnline).length} / {currentRoom.lobbyLimit}
                  </strong>
                </div>
              </div>

              {/* GAME STATE ENGINE SWITCHER OR RENDERER */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                <div className="xl:col-span-8 space-y-6">
                  {currentRoom.phase === GamePhase.LOBBY && (
                    <DetectiveLobby
                      roomId={currentRoom.id}
                      currentPlayerId={currentUser.uid}
                      players={currentRoom.players}
                      hostId={currentRoom.hostId}
                      lobbyLimit={currentRoom.lobbyLimit}
                      onLeave={leaveRoom}
                      onStartGame={handleStartWordSubmission}
                    />
                  )}

                  {currentRoom.phase === GamePhase.SUBMITTING_WORDS && (
                    <WordSubmission
                      roomId={currentRoom.id}
                      currentPlayerId={currentUser.uid}
                      players={currentRoom.players}
                      onSubmitWord={handleSubmitMyWord}
                    />
                  )}

                  {currentRoom.phase === GamePhase.WORD_REVEAL && (
                    <WordReveal
                      roomId={currentRoom.id}
                      currentPlayerId={currentUser.uid}
                      players={currentRoom.players}
                      secretWord={currentRoom.secretWord}
                      imposterId={currentRoom.imposterId}
                    />
                  )}

                  {currentRoom.phase === GamePhase.CLUE_PHASE && currentRoom.currentTurnId && (
                    <CluePhase
                      roomId={currentRoom.id}
                      currentPlayerId={currentUser.uid}
                      players={currentRoom.players}
                      currentTurnId={currentRoom.currentTurnId}
                      turnOrder={currentRoom.turnOrder}
                      turnStartedAt={currentRoom.turnStartedAt}
                      onClueSubmitted={handleSubmitMyClue}
                    />
                  )}

                  {currentRoom.phase === GamePhase.VOTING_PHASE && (
                    <VotingPanel
                      roomId={currentRoom.id}
                      currentPlayerId={currentUser.uid}
                      players={currentRoom.players}
                      onVoteCast={handleCastSuspectVote}
                    />
                  )}

                  {currentRoom.phase === GamePhase.REVEAL_PHASE && (
                    <ResultPanel
                      roomId={currentRoom.id}
                      currentPlayerId={currentUser.uid}
                      players={currentRoom.players}
                      secretWord={currentRoom.secretWord}
                      imposterId={currentRoom.imposterId}
                      votedOutPlayerId={currentRoom.votedOutPlayerId || ""}
                      imposterGuessAttempt={currentRoom.imposterGuessAttempt}
                      winner={currentRoom.winner}
                      onNewRound={handleResetToNewRound}
                    />
                  )}
                </div>

                {/* Always-Online WhatsApp Real-time Chat Side panel (Only present after lobby begins) */}
                <div className="xl:col-span-4 h-full">
                  <ChatSystem
                    roomId={currentRoom.id}
                    currentPlayerId={currentUser.uid}
                    players={currentRoom.players}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* FOOTER */}
      <footer className="w-full py-4 text-center border-t border-white/5 bg-slate-950/20 backdrop-blur-md mt-6 select-none z-10">
        <p className="text-[10px] font-mono text-slate-650 tracking-wider">
          CASE CONTROL DEPT. // PERSISTED FIRESTORE REALTIME SYNC // SECURED BY SCHIELD INTERPOL-AUTH
        </p>
      </footer>
    </div>
  );
}
