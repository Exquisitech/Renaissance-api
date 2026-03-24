import { CacheInterceptor } from '@nestjs/cache-manager';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NO_CACHE_METADATA } from '../decorators/no-cache.decorator';
import { CACHE_KEY_METADATA } from '../decorators/cache-key.decorator';

@Injectable()
export class HttpCacheInterceptor extends CacheInterceptor {
  protected trackBy(context: ExecutionContext): string | undefined {
    const reflector = this.reflector;
    const isNoCache = reflector.get(NO_CACHE_METADATA, context.getHandler());

    if (isNoCache) {
      return undefined;
    }

    const request = context.switchToHttp().getRequest();
    const { httpAdapter } = this.httpAdapterHost;
    const isGetRequest = httpAdapter.getRequestMethod(request) === 'GET';
    const excludePaths: string[] = []; // Add paths to exclude if needed

    if (
      !isGetRequest ||
      (isGetRequest &&
        excludePaths.includes(httpAdapter.getRequestUrl(request)))
    ) {
      return undefined;
    }

    const cacheKeyMetadata = reflector.get(
      CACHE_KEY_METADATA,
      context.getHandler(),
    );

    if (cacheKeyMetadata) {
      return `${cacheKeyMetadata}-${httpAdapter.getRequestUrl(request)}`;
    }

    return httpAdapter.getRequestUrl(request);
  }
}
