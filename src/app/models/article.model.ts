// ============================================
// ARTICLE
// ============================================

export type ArticleStatus = 'DRAFT' | 'PUBLISHED' | 'SCHEDULED' | 'REVIEW' | 'ARCHIVED';

/**
 * Lightweight author info returned within article responses.
 * Matches backend ArticleResponse.AuthorInfo (not the full UserResponse).
 */
export interface AuthorInfo {
  id: string;
  name: string;
  avatarUrl?: string;
  bio?: string;
}

export interface ArticleRequest {
  slug: string;
  title: string;
  content: string;
  excerpt?: string;
  coverImageUrl?: string;
  status?: ArticleStatus;
  scheduledAt?: string;
  tagSlugs?: string[];
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
}

export interface ArticleResponse {
  id: string;
  slug: string;
  title: string;
  subtitle?: string; // INT-08: Backend sends subtitle, frontend must model it
  content: string;
  contentHtml: string;
  excerpt?: string;
  coverImageUrl?: string;
  status: ArticleStatus;
  publishedAt?: string;
  scheduledAt?: string;
  author: AuthorInfo;
  tags: TagResponse[];
  viewCount: number;
  likeCount: number;
  commentCount: number;
  readingTimeMinutes: number;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleSummaryResponse {
  id: string;
  slug: string;
  title: string;
  excerpt?: string;
  coverImageUrl?: string;
  status: ArticleStatus;
  publishedAt?: string;
  author: AuthorInfo;
  tags: TagResponse[];
  viewCount: number;
  likeCount: number;
  commentCount: number;
  readingTimeMinutes: number;
  createdAt: string;
}

// ============================================
// ARTICLE VERSION
// ============================================

export interface ArticleVersion {
  id: string;
  articleId: string;
  versionNumber: number;
  title: string;
  subtitle?: string;
  content: string;
  excerpt?: string;
  coverImageUrl?: string;
  changeSummary?: string;
  changedBy?: string;
  changedByName?: string;
  createdAt: string;
}

export type ArticleVersionResponse = ArticleVersion;

export interface ArticleVersionListResponse {
  articleId: string;
  versions: ArticleVersionResponse[];
  totalVersions: number;
}

export interface VersionCompareResponse {
  articleId: string;
  fromVersion: number;
  toVersion: number;
  titleChanged: boolean;
  subtitleChanged: boolean;
  contentChanged: boolean;
  excerptChanged: boolean;
  contentLengthDiff: number;
  fromDate: string;
  toDate: string;
}

// ============================================
// TAG
// ============================================

export interface TagRequest {
  name: string;
  description?: string;
  color?: string;
}

export interface TagResponse {
  id: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  names?: Record<string, string>;
  descriptions?: Record<string, string>;
  articleCount: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// COMMENT
// ============================================

export type CommentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SPAM';

export interface CommentRequest {
  content: string;
  authorName?: string;
  authorEmail?: string;
  parentId?: string;
  recaptchaToken?: string;
}

export interface CommentResponse {
  id: string;
  articleId: string;
  articleSlug: string;
  articleTitle: string;
  authorName?: string;
  content: string;
  status: CommentStatus;
  parentId?: string;
  moderationNote?: string;
  likesCount?: number;
  replies?: CommentResponse[];
  createdAt: string;
  updatedAt: string;
}

// ============================================
// SEARCH
// ============================================

export interface SearchResponse {
  content: ArticleSummaryResponse[];
  totalElements: number;
  page: number;
  size: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

// AUD18-06: removed dead `slug` — it was fabricated client-side and never read
export interface SearchSuggestion {
  text: string;
  value?: string; // Alias for text
  type: 'article' | 'tag';
}

// ============================================
// ARTICLE REVIEW
// ============================================

// AUD19C-02: Snowflake ids are serialized as JSON strings by the backend —
// modeling them as number would corrupt values above 2^53.
export interface ArticleReview {
  id: string;
  articleId: string;
  reviewerId: string;
  status: string; // APPROVED, CHANGES_REQUESTED, PENDING
  feedback?: string;
  createdAt: string;
  updatedAt?: string;
}

// ============================================
// ARTICLE TRANSLATION (i18n)
// ============================================

export interface ArticleI18nResponse {
  // AUD19C-02: Snowflake id — string, see ArticleReview note.
  articleId: string;
  locale: string;
  title: string;
  subtitle: string;
  content: string;
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  autoTranslated: boolean;
  reviewed: boolean;
  translatedAt: string;
}
