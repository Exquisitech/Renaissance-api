import { Injectable } from "@nestjs/common";
import { MetadataIpfsService } from "./metadata-ipfs.service";
import { MetadataCacheService } from "./metadata-cache.service";
import { PlayerStats, NFTMetadata } from "./metadata.types";

@Injectable()
export class MetadataService {
  private versionMap = new Map<string, number>();

  constructor(
    private readonly ipfs: MetadataIpfsService,
    private readonly cache: MetadataCacheService,
  ) {}

  // -------------------------------------
  // GENERATE METADATA
  // -------------------------------------
  generateMetadata(stats: PlayerStats): NFTMetadata {
    const version = (this.versionMap.get(stats.playerId) || 0) + 1;
    this.versionMap.set(stats.playerId, version);

    return {
      name: `${stats.name} Player Card`,
      description: "Dynamic NFT based on player performance",
      image: `https://api.example.com/player/${stats.playerId}/image`,
      attributes: [
        { trait_type: "Score", value: stats.score },
        { trait_type: "Assists", value: stats.assists },
        { trait_type: "Matches", value: stats.matches },
      ],
      version,
      updatedAt: new Date().toISOString(),
    };
  }

  // -------------------------------------
  // UPDATE METADATA
  // -------------------------------------
  async updateMetadata(stats: PlayerStats) {
    const metadata = this.generateMetadata(stats);

    const ipfsUri = await this.ipfs.upload(metadata);

    // cache latest
    this.cache.set(stats.playerId, {
      metadata,
      ipfsUri,
    });

    return { metadata, ipfsUri };
  }

  // -------------------------------------
  // BATCH UPDATE
  // -------------------------------------
  async batchUpdate(players: PlayerStats[]) {
    const results = [];

    for (const p of players) {
      const updated = await this.updateMetadata(p);
      results.push(updated);
    }

    return results;
  }

  // -------------------------------------
  // GET METADATA
  // -------------------------------------
  getMetadata(playerId: string) {
    return this.cache.get(playerId);
  }
}