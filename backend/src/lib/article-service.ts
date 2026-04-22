import { DataSource, Repository } from 'typeorm';
import { Post, PostStatus, PostType } from '../posts/entities/post.entity';

export interface ArticleAuthor {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  avatar: string | null;
  bio: string | null;
}

export interface ArticlePublication {
  publishedAt: Date | null;
  updatedAt: Date;
  views: number;
  likes: number;
  tags: string[];
  categories: { id: string; name: string; slug: string }[];
}

export interface RelatedArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImage: string | null;
  publishedAt: Date | null;
  author: Pick<ArticleAuthor, 'id' | 'firstName' | 'lastName' | 'username'>;
  tags: string[];
}

export interface ArticleDetail {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  featuredImage: string | null;
  type: PostType;
  seoTitle: string | null;
  seoDescription: string | null;
  metadata: Record<string, any> | null;
  author: ArticleAuthor;
  publication: ArticlePublication;
  relatedArticles: RelatedArticle[];
}

export class ArticleService {
  private readonly postRepository: Repository<Post>;

  /** Max related articles returned */
  private readonly RELATED_LIMIT = 5;

  constructor(private readonly dataSource: DataSource) {
    this.postRepository = dataSource.getRepository(Post);
  }

  /**
   * Retrieve full article detail by ID.
   * Loads author, categories, and related articles.
   * Increments the view counter atomically.
   */
  async getArticleById(id: string): Promise<ArticleDetail | null> {
    const article = await this.postRepository.findOne({
      where: { id, status: PostStatus.PUBLISHED },
      relations: ['author', 'categories', 'comments'],
    });

    if (!article) return null;

    // Increment view count without blocking the response
    this.postRepository
      .increment({ id }, 'views', 1)
      .catch(() => {/* non-critical */});

    const relatedArticles = await this.findRelatedArticles(article);

    return this.toArticleDetail(article, relatedArticles);
  }

  /**
   * Retrieve full article detail by slug.
   */
  async getArticleBySlug(slug: string): Promise<ArticleDetail | null> {
    const article = await this.postRepository.findOne({
      where: { slug, status: PostStatus.PUBLISHED },
      relations: ['author', 'categories', 'comments'],
    });

    if (!article) return null;

    this.postRepository
      .increment({ slug }, 'views', 1)
      .catch(() => {/* non-critical */});

    const relatedArticles = await this.findRelatedArticles(article);

    return this.toArticleDetail(article, relatedArticles);
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  /**
   * Find related articles by shared tags or categories,
   * falling back to most-recent published articles of the same type.
   */
  private async findRelatedArticles(article: Post): Promise<Post[]> {
    const categoryIds = (article.categories ?? []).map((c) => c.id);
    const tags: string[] = article.tags ?? [];

    const qb = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('post.categories', 'categories')
      .where('post.id != :id', { id: article.id })
      .andWhere('post.status = :status', { status: PostStatus.PUBLISHED });

    if (categoryIds.length > 0 || tags.length > 0) {
      qb.andWhere(
        '(categories.id IN (:...categoryIds) OR post.tags && ARRAY[:...tags]::text[])',
        {
          categoryIds: categoryIds.length > 0 ? categoryIds : ['__none__'],
          tags: tags.length > 0 ? tags : ['__none__'],
        },
      );
    } else {
      // No shared signals — fall back to same post type
      qb.andWhere('post.type = :type', { type: article.type });
    }

    return qb
      .orderBy('post.published_at', 'DESC')
      .take(this.RELATED_LIMIT)
      .getMany();
  }

  private toArticleDetail(article: Post, related: Post[]): ArticleDetail {
    const author = article.author;

    return {
      id: article.id,
      title: article.title,
      slug: article.slug,
      content: article.content,
      excerpt: article.excerpt ?? null,
      featuredImage: article.featuredImage ?? null,
      type: article.type,
      seoTitle: article.seoTitle ?? null,
      seoDescription: article.seoDescription ?? null,
      metadata: article.metadata ?? null,
      author: {
        id: author.id,
        firstName: author.firstName ?? null,
        lastName: author.lastName ?? null,
        username: author.username ?? null,
        avatar: author.avatar ?? null,
        bio: author.bio ?? null,
      },
      publication: {
        publishedAt: article.publishedAt ?? null,
        updatedAt: article.updatedAt,
        views: article.views,
        likes: article.likes,
        tags: article.tags ?? [],
        categories: (article.categories ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
        })),
      },
      relatedArticles: related.map((r) => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
        excerpt: r.excerpt ?? null,
        featuredImage: r.featuredImage ?? null,
        publishedAt: r.publishedAt ?? null,
        author: {
          id: r.author.id,
          firstName: r.author.firstName ?? null,
          lastName: r.author.lastName ?? null,
          username: r.author.username ?? null,
        },
        tags: r.tags ?? [],
      })),
    };
  }
}
