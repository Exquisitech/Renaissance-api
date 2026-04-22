import { NextResponse } from 'next/server';
import { ArticleService } from '../../../../lib/article-service';
import { AppDataSource } from '../../../../database/data-source';

/**
 * GET /api/articles/[id]
 *
 * Returns the full content of a published article by its UUID or slug,
 * including author profile, publication metadata, and up to 5 related articles.
 *
 * Query params:
 *   - by=slug   (optional) — treat [id] as a slug instead of a UUID
 *
 * Responses:
 *   200  ArticleDetail
 *   400  Invalid id
 *   404  Article not found or not published
 *   500  Internal error
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params;

  if (!id || id.trim() === '') {
    return NextResponse.json(
      { error: 'Article id is required' },
      { status: 400 },
    );
  }

  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const service = new ArticleService(AppDataSource);

    // Detect slug vs UUID: UUIDs match the standard 8-4-4-4-12 pattern
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );

    const article = isUuid
      ? await service.getArticleById(id)
      : await service.getArticleBySlug(id);

    if (!article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: article });
  } catch (error) {
    console.error('[GET /api/articles/:id] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
