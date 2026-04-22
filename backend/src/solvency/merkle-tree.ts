import { createHash } from 'crypto';

/**
 * Merkle Tree implementation for solvency proof generation
 */
export class MerkleTree {
  private leaves: string[];
  private layers: string[][];
  private root: string | null;

  constructor(leaves: string[]) {
    this.leaves = leaves.map((leaf) => this.hashLeaf(leaf));
    this.layers = [];
    this.root = null;
    this.buildTree();
  }

  /**
   * Hash a leaf node
   */
  private hashLeaf(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Hash two nodes together
   */
  private hashNodes(left: string, right: string): string {
    return createHash('sha256')
      .update(left + right)
      .digest('hex');
  }

  /**
   * Build the Merkle tree
   */
  private buildTree(): void {
    if (this.leaves.length === 0) {
      this.root = null;
      return;
    }

    let currentLayer = [...this.leaves];
    this.layers.push(currentLayer);

    while (currentLayer.length > 1) {
      const nextLayer: string[] = [];

      for (let i = 0; i < currentLayer.length; i += 2) {
        const left = currentLayer[i];
        const right = i + 1 < currentLayer.length ? currentLayer[i + 1] : left;
        nextLayer.push(this.hashNodes(left, right));
      }

      this.layers.push(nextLayer);
      currentLayer = nextLayer;
    }

    this.root = currentLayer[0];
  }

  /**
   * Get the Merkle root
   */
  getRoot(): string | null {
    return this.root;
  }

  /**
   * Get Merkle proof for a specific leaf
   */
  getProof(leafIndex: number): string[] {
    if (leafIndex < 0 || leafIndex >= this.leaves.length) {
      throw new Error('Invalid leaf index');
    }

    const proof: string[] = [];
    let index = leafIndex;

    for (let layerIndex = 0; layerIndex < this.layers.length - 1; layerIndex++) {
      const layer = this.layers[layerIndex];
      const isLeft = index % 2 === 0;
      const siblingIndex = isLeft ? index + 1 : index - 1;

      if (siblingIndex < layer.length) {
        proof.push(layer[siblingIndex]);
      }

      index = Math.floor(index / 2);
    }

    return proof;
  }

  /**
   * Verify a Merkle proof
   */
  static verifyProof(
    leaf: string,
    proof: string[],
    root: string,
  ): boolean {
    let currentHash = createHash('sha256').update(leaf).digest('hex');

    for (const sibling of proof) {
      currentHash = createHash('sha256')
        .update(currentHash + sibling)
        .digest('hex');
    }

    return currentHash === root;
  }

  /**
   * Get tree statistics
   */
  getStats(): {
    leafCount: number;
    depth: number;
    root: string | null;
  } {
    return {
      leafCount: this.leaves.length,
      depth: this.layers.length,
      root: this.root,
    };
  }
}
