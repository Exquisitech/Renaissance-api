import { Injectable } from "@nestjs/common";
// Use your preferred IPFS client (web3.storage / pinata)

@Injectable()
export class MetadataIpfsService {

  async upload(metadata: any): Promise<string> {
    // TODO: replace with real IPFS provider
    const fakeHash = "ipfs://Qm" + Math.random().toString(36).substring(7);

    return fakeHash;
  }
}