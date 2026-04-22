import { Injectable } from "@nestjs/common";

@Injectable()
export class MetadataCacheService {
  private cache = new Map<string, any>();

  set(key: string, value: any) {
    this.cache.set(key, value);
  }

  get(key: string) {
    return this.cache.get(key);
  }

  invalidate(key: string) {
    this.cache.delete(key);
  }
}