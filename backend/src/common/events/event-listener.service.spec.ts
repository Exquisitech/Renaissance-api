import { ConfigService } from '@nestjs/config';
import { EventBus } from '@nestjs/cqrs';
import { EventListenerService } from './event-listener.service';

describe('EventListenerService', () => {
  let service: EventListenerService;

  beforeAll(() => {
    service = new EventListenerService(
      { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService,
      { publish: jest.fn() } as unknown as EventBus,
      {} as any,
      {} as any,
    );
  });

  describe('parseBetStatus', () => {
    it('returns CANCELLED for cancel-like status strings', () => {
      const status = service['parseBetStatus']('cancelled', null, []);
      expect(status).toBe('cancelled');
    });

    it('returns CANCELLED for void-like status strings', () => {
      const status = service['parseBetStatus']('void', null, []);
      expect(status).toBe('cancelled');
    });

    it('returns CANCELLED for draw settlement events when isWin is not provided', () => {
      const status = service['parseBetStatus']('DRAW', null, []);
      expect(status).toBe('cancelled');
    });

    it('returns WON when isWin is true even if status contains draw', () => {
      const status = service['parseBetStatus']('draw', true, []);
      expect(status).toBe('won');
    });

    it('returns LOST when isWin is false and status contains draw', () => {
      const status = service['parseBetStatus']('draw', false, []);
      expect(status).toBe('lost');
    });
  });
});
