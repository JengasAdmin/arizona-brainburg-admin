/** Client-safe structural types for search results (mirrors the server payload). */
export interface SearchResults {
  users: {
    id: number;
    displayName: string;
    nickname: string | null;
    avatarUrl: string | null;
    gameId: string | null;
    faction: string | null;
  }[];
  factions: { id: number; name: string; shortName: string }[];
  positions: { id: number; title: string; kind: string; factionId: number; factionName: string }[];
}
