import { Entity, Column, PrimaryGeneratedColumn, Unique, CreateDateColumn } from 'typeorm';

@Entity('processed_events')
@Unique(['eventHash'])
export class ProcessedEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  eventHash: string; // unique identifier for event

  @Column()
  source: string; // e.g., 'smart_contract', 'webhook', 'spin'

  @CreateDateColumn()
  processedAt: Date;
}
