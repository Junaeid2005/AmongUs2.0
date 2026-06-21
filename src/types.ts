export enum GamePhase {
  LOBBY = "LOBBY",
  SUBMITTING_WORDS = "SUBMITTING_WORDS",
  WORD_REVEAL = "WORD_REVEAL",
  CLUE_PHASE = "CLUE_PHASE",
  VOTING_PHASE = "VOTING_PHASE",
  REVEAL_PHASE = "REVEAL_PHASE"
}

export interface Player {
  id: string; // auth UID or random guest ID
  name: string;
  avatarId: string; // identifier of iconic detective character
  isHost: boolean;
  isOnline: boolean;
  wordSubmitted?: string;
  clue?: string;
  votedFor?: string; // ID of player this player voted for
  role?: "DETECTIVE" | "IMPOSTER";
  typing?: boolean;
}

export interface DetectiveAvatar {
  id: string;
  name: string;
  title: string;
  description: string;
  emoji: string;
  bgHex: string;
}

export interface MessageReaction {
  emoji: string;
  authors: string[]; // names of players who reacted
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  timestamp: number;
  replyTo?: {
    senderName: string;
    text: string;
  };
  reactions?: MessageReaction[];
}

export interface Room {
  id: string;        // Room code, e.g. "ABC123"
  hostId: string;    // ID of host player
  phase: GamePhase;
  players: Record<string, Player>; // Map of playerId -> Player
  secretWord: string;      // Assigned secret word for Detectives
  allSubmittedWords: string[]; // Pool of words submitted this round
  imposterId: string;      // ID of Imposter player
  imposterGuessAttempt?: string; // Guess attempt of secret word by Imposter
  votedOutPlayerId?: string; // Who got voted out
  currentTurnId?: string;  // Player whose turn it is to write clue
  turnOrder: string[];     // Array of player IDs representing turn order
  turnStartedAt?: number;  // Timestamp when current turn started
  lobbyLimit: number;      // 3 to 8 players, configured by host
  createdAt: number;
  winner?: "DETECTIVES" | "IMPOSTER";
}

export const DETECTIVE_AVATARS: DetectiveAvatar[] = [
  {
    id: "sherlock",
    name: "Alistair 'Sherlock' Thorne",
    title: "The Consultative Legend",
    description: "Keen eye for micro-expressions. Smells of pipe tobacco and old parchment.",
    emoji: "🕵️‍♂️",
    bgHex: "#1e293b" // Slate
  },
  {
    id: "femme",
    name: "Scarlet 'Noire' Vance",
    title: "The Femme Fatale",
    description: "Cold-hearted analyst. Specializes in solving unsolvable high-profile crimes.",
    emoji: "🕵️‍♀️",
    bgHex: "#7f1d1d" // Rose dark
  },
  {
    id: "cyber",
    name: "Jax 'Hacker' Kross",
    title: "The Digital Archivalist",
    description: "Uses custom intelligence systems to map human communication patterns.",
    emoji: "👨‍💻",
    bgHex: "#065f46" // Green dark
  },
  {
    id: "informant",
    name: "Slick 'Whisper' Malone",
    title: "The Streetside Informant",
    description: "Finds clues in gutters, bars, and dark alleys. Knows everyone in the city.",
    emoji: "🥷",
    bgHex: "#7c2d12" // Orange dark
  },
  {
    id: "chief",
    name: "Inspector Marcus Vance",
    title: "The Hardboiled Captain",
    description: "No-nonsense veteran detective. Relying strictly on classic gut feeling.",
    emoji: "👮‍♂️",
    bgHex: "#1e3a8a" // Blue dark
  },
  {
    id: "expert",
    name: "Dr. Evelyn 'Bio' Cross",
    title: "The Forensic Maven",
    description: "Exposes fabrications through chemical analysis and dust particles.",
    emoji: "👩‍🔬",
    bgHex: "#581c87" // Purple dark
  },
  {
    id: "sleuth",
    name: "Reggie 'Journal' Reed",
    title: "The Investigative Sleuth",
    description: "Writes down everything. Master of capturing conflicting timelines.",
    emoji: "📝",
    bgHex: "#3f2b1d" // Amber/brown dark
  },
  {
    id: "shadow",
    name: "The Gilded Phantom",
    title: "The Reclassified Asset",
    description: "Ex-infiltrator cooperating with Interpol. Master of blending inside crowds.",
    emoji: "👤",
    bgHex: "#18181b" // Zinc dark
  }
];

export const THEMATIC_WORDS: string[][] = [
  ["FOOTPRINT", "CLUE"],
  ["PISTOL", "REVOLVER"],
  ["POISON", "TOXIN"],
  ["ALIBI", "EXCUSE"],
  ["SAFE", "VAULT"],
  ["DIAMOND", "RUBY"],
  ["SCAFFOLD", "LADDER"],
  ["SIGNATURE", "LETTER"],
  ["CHANDELIER", "LAMP"],
  ["EVIDENCE", "WITNESS"],
  ["DAGGER", "SWORD"],
  ["PORTRAIT", "MIRROR"],
  ["VINEYARD", "CELLAR"],
  ["CLOCKTOWER", "BELL"],
  ["ARCHIVE", "LIBRARY"],
  ["OPERA HOUSE", "THEATER"]
];
