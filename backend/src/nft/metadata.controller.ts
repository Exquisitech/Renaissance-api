import { Controller, Post, Body, Get, Param } from "@nestjs/common";
import { MetadataService } from "./metadata.service";
import { PlayerStats } from "./metadata.types";

@Controller("nft/metadata")
export class MetadataController {
  constructor(private readonly service: MetadataService) {}

  // -------------------------------------
  // UPDATE SINGLE
  // -------------------------------------
  @Post("update")
  update(@Body() stats: PlayerStats) {
    return this.service.updateMetadata(stats);
  }

  // -------------------------------------
  // BATCH UPDATE
  // -------------------------------------
  @Post("batch")
  batch(@Body() players: PlayerStats[]) {
    return this.service.batchUpdate(players);
  }

  // -------------------------------------
  // FETCH METADATA
  // -------------------------------------
  @Get(":playerId")
  get(@Param("playerId") playerId: string) {
    return this.service.getMetadata(playerId);
  }

  // -------------------------------------
  // REFRESH (FOR NFT PLATFORMS)
  // -------------------------------------
  @Post(":playerId/refresh")
  refresh(@Param("playerId") playerId: string) {
    return {
      message: "Metadata refresh triggered",
      playerId,
    };
  }
}