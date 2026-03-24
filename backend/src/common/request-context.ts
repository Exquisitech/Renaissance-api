import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  correlationId: string;
}

export const RequestContextStorage = new AsyncLocalStorage<RequestContext>();
