import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum WalletType {
  FREIGHTER = 'freighter',
  ALBEDO = 'albedo',
  STELLARX = 'stellarx',
  LEDGER = 'ledger',
  OTHER = 'other',
}

export enum WalletStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DISCONNECTED = 'disconnected',
}

@Entity('wallet_connections')
@Index(['publicKey'])
@Index(['userId'])
@Index(['status'])
export class WalletConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'public_key' })
  publicKey: string;

  @Column({
    type: 'enum',
    enum: WalletType,
    default: WalletType.FREIGHTER,
  })
  walletType: WalletType;

  @Column({
    type: 'enum',
    enum: WalletStatus,
    default: WalletStatus.ACTIVE,
  })
  status: WalletStatus;

  @Column({ name: 'last_used_at', nullable: true })
  lastUsedAt: Date;

  @Column({ name: 'nonce', nullable: true })
  nonce: string;

  @Column({ name: 'nonce_expires_at', nullable: true })
  nonceExpiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
