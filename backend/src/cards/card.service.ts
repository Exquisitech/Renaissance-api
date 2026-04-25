// fusion.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Card } from '../cards/card.entity';
import { Fusion } from './fusion.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { fusionRules } from './fusion.rule';
import { CardRarity } from '../cards/card.enums';

@Injectable()
export class FusionService {
  constructor(
    @InjectRepository(Card)
    private cardRepo: Repository<Card>,

    @InjectRepository(Fusion)
    private fusionRepo: Repository<Fusion>,
  ) {}

  async fuseCards(userId: string, cardIds: string[]) {
    const cards = await this.cardRepo.findByIds(cardIds);

    if (cards.length !== cardIds.length) {
      throw new BadRequestException('Some cards not found');
    }

    // Ensure ownership
    if (cards.some(c => c.userId !== userId)) {
      throw new BadRequestException('Invalid ownership');
    }

    const rarity = cards[0].rarity;

    // Ensure same rarity
    if (cards.some(c => c.rarity !== rarity)) {
      throw new BadRequestException('Cards must have same rarity');
    }

    const rule = fusionRules[rarity];

    if (!rule || cardIds.length !== rule.requiredCount) {
      throw new BadRequestException('Invalid fusion combination');
    }

    // 🔒 Supply balancing check
    await this.enforceSupplyLimit(rule.produces);

    // ❌ Remove consumed cards
    await this.cardRepo.remove(cards);

    // ✅ Create new card
    const newCard = this.cardRepo.create({
      userId,
      rarity: rule.produces,
    });

    const savedCard = await this.cardRepo.save(newCard);

    // 📝 Track history
    await this.fusionRepo.save({
      userId,
      consumedCardIds: cardIds,
      resultCardId: savedCard.id,
    });

    return savedCard;
  }

  // 🎯 Supply balancing (simple version)
  private async enforceSupplyLimit(rarity: CardRarity) {
    const maxSupply: Record<CardRarity, number> = {
      [CardRarity.COMMON]: Infinity,
      [CardRarity.RARE]: 10000,
      [CardRarity.EPIC]: 1000,
    };

    const count = await this.cardRepo.count({
      where: { rarity },
    });

    if (count >= maxSupply[rarity]) {
      throw new BadRequestException(
        `${rarity} supply cap reached`,
      );
    }
  }
}