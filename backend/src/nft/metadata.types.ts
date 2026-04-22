export interface PlayerStats {
  playerId: string;
  name: string;
  score: number;
  assists: number;
  matches: number;
}

export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes: {
    trait_type: string;
    value: string | number;
  }[];
  version: number;
  updatedAt: string;
}