import { Injectable } from '@nestjs/common';

export interface DebouncedFunction {
  (...args: any[]): void;
  cancel: () => void;
  flush: () => void;
}

@Injectable()
export class DebounceService {
  create<T extends any[]>(
    func: (...args: T) => void,
    delay: number
  ): DebouncedFunction {
    let timeoutId: NodeJS.Timeout | null = null;
    let lastArgs: T | null = null;

    const debounced = (...args: T) => {
      lastArgs = args;
      
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      timeoutId = setTimeout(() => {
        if (lastArgs) {
          func(...lastArgs);
        }
        timeoutId = null;
        lastArgs = null;
      }, delay);
    };

    debounced.cancel = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
        lastArgs = null;
      }
    };

    debounced.flush = () => {
      if (timeoutId && lastArgs) {
        clearTimeout(timeoutId);
        func(...lastArgs);
        timeoutId = null;
        lastArgs = null;
      }
    };

    return debounced;
  }
}
