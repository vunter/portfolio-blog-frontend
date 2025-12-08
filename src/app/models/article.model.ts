import { UserResponse } from './user.model';

// ============================================
// ARTICLE
// ============================================

export type ArticleStatus = 'DRAFT' | 'PUBLISHED' | 'SCHEDULED' | 'ARCHIVED';

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
  featuredImageUrl?: string; // Alias for coverImageUrl
  status: ArticleStatus;
  publishedAt?: string;
  scheduledAt?: string;
  author: UserResponse;
  tags: TagResponse[];
  viewCount: number;
  likeCount: number;
  commentCount: number;
  readingTimeMinutes: number;
  seoTitle?: string;
  metaTitle?: string; // Alias for seoTitle
  seoDescription?: string;
  metaDescription?: string; // Alias for seoDescription
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
  featuredImageUrl?: string; // Alias for coverImageUrl
  status: ArticleStatus;
  publishedAt?: string;
  author: UserResponse;
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

export interface ArticleVersionResponse extends ArticleVersion {}

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
  author?: UserResponse;
  authorName?: string;
  authorEmail?: string;
  content: string;
  status: CommentStatus;
  parentId?: string;
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

export interface SearchSuggestion {
  text: string;
  value?: string; // Alias for text
  type: 'article' | 'tag';
  slug: string;
}
