import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { environment } from '../../../../environments/environment';
import { PageResponse, UserResponse, ArticleResponse, TagResponse, CommentResponse } from '../../../models';
import { ArticleVersionResponse, ArticleVersionListResponse, VersionCompareResponse } from '../../../models/article.model';

// ============================================
// ADMIN-SPECIFIC RESPONSE TYPES
// ============================================

export interface CustomVariable {
  id: number;
  key: string;
  value: string;
  description: string;
  templateId: string;
}

export interface TranslationItem {
  id: number;
  translationKey: string;
  locale: string;
  value: string;
  namespace: string;
  visibility: string;
  updatedAt: string;
}

export interface TranslationPage {
  items: TranslationItem[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

export interface DashboardStats {
  totalArticles: number;
  publishedArticles: number;
  draftArticles: number;
  totalViews: number;
  totalComments: number;
  pendingComments: number;
  totalUsers: number;
  totalTags: number;
  newsletterSubscribers: number;
}

export interface DashboardActivity {
  id: number;
  type: string;
  action: string;
  title: string;
  description: string;
  createdAt: string;
}

export interface AdminArticle {
  id: string;
  slug: string;
  title: string;
  status: string;
  viewCount: number;
  likeCount: number;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminComment {
  id: string;
  articleId: string;
  articleSlug: string;
  authorName: string;
  authorEmail: string;
  content: string;
  status: string;
  createdAt: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface NewsletterStats {
  total: number;
  active: number;
  confirmed: number;
  unsubscribed: number;
}

// CQ-09: Typed subscriber response instead of Record<string, unknown>
export interface SubscriberResponse {
  id: string;
  email: string;
  name?: string;
  status: string;
  confirmedAt?: string;
  createdAt: string;
}

export interface CacheStats {
  articlesCount: number;
  tagsCount: number;
  commentsCount: number;
  searchCount: number;
  feedCount: number;
}

// INT-12: Analytics types — aligned with backend AnalyticsSummary DTO
export interface AnalyticsSummary {
  totalViews: number;
  totalLikes: number;
  totalShares: number;
  uniqueVisitors: number;
  topArticles: { articleId: string; title: string; slug: string; views: number }[];
  dailyViews: { date: string; count: number }[];
  topReferrers: { referrer: string; count: number }[];
  topSources: { source: string; medium: string; count: number }[];
  period: string;
}

export interface AnalyticsTrend {
  date: string;
  views: number;
  visitors: number;
}

export interface SearchAnalytics {
  totalSearches: number;
  uniqueSearches: number;
  topSearches: { queryText: string; count: number }[];
  zeroResultSearches: { queryText: string; count: number }[];
}

export interface AnalyticsComparison {
  currentViews: number;
  currentLikes: number;
  currentShares: number;
  previousViews: number;
  previousLikes: number;
  previousShares: number;
}

// INT-12: User stats
export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  admins: number;
  authors: number;
}

// ============================================
// MEDIA LIBRARY TYPES
// ============================================

export type MediaPurpose = 'AVATAR' | 'BLOG_COVER' | 'BLOG_CONTENT' | 'COMMENT' | 'PROJECT' | 'TESTIMONIAL' | 'GENERAL';

export interface MediaAssetResponse {
  id: number;
  originalFilename: string;
  contentType: string;
  fileSize: number;
  purpose: MediaPurpose;
  altText?: string;
  url: string;
  storageType: string;
  createdAt: string;
}

export interface MediaListResponse {
  items: MediaAssetResponse[];
  totalItems: number;
  page: number;
  size: number;
  totalPages: number;
}

/**
 * Typed admin API service that centralizes all admin endpoint calls.
 * Provides proper typing and a single source of truth for admin URLs.
 * 
 * Components can adopt this service incrementally — replacing direct
 * ApiService calls with typed methods.
 */
@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private api = inject(ApiService);
  private http = inject(HttpClient);

  // ==================== DASHBOARD ====================

  getDashboardStats(): Observable<DashboardStats> {
    return this.api.get<DashboardStats>('/admin/dashboard/stats');
  }

  getDashboardActivity(): Observable<DashboardActivity[]> {
    return this.api.get<DashboardActivity[]>('/admin/dashboard/activity');
  }

  // ==================== ARTICLES ====================

  getArticles(page = 0, size = 10, status?: string): Observable<PageResponse<AdminArticle>> {
    const params: Record<string, string | number> = { page, size };
    if (status) params['status'] = status;
    return this.api.get<PageResponse<AdminArticle>>('/admin/articles', params);
  }

  getArticleById(id: string): Observable<AdminArticle> {
    return this.api.get<AdminArticle>(`/admin/articles/${id}`);
  }

  createArticle(data: Record<string, unknown>): Observable<AdminArticle> {
    return this.api.post<AdminArticle>('/admin/articles', data);
  }

  updateArticle(id: string, data: Record<string, unknown>): Observable<AdminArticle> {
    return this.api.put<AdminArticle>(`/admin/articles/${id}`, data);
  }

  publishArticle(id: string): Observable<AdminArticle> {
    return this.api.patch<AdminArticle>(`/admin/articles/${id}/publish`, {});
  }

  unpublishArticle(id: string): Observable<AdminArticle> {
    return this.api.patch<AdminArticle>(`/admin/articles/${id}/unpublish`, {});
  }

  archiveArticle(id: string): Observable<AdminArticle> {
    return this.api.patch<AdminArticle>(`/admin/articles/${id}/archive`, {});
  }

  deleteArticle(id: string): Observable<void> {
    return this.api.delete<void>(`/admin/articles/${id}`);
  }

  // ==================== COMMENTS ====================

  getComments(page = 0, size = 20, status?: string): Observable<PageResponse<AdminComment>> {
    const params: Record<string, string | number> = { page, size };
    if (status) params['status'] = status;
    return this.api.get<PageResponse<AdminComment>>('/admin/comments', params);
  }

  approveComment(id: string): Observable<AdminComment> {
    return this.api.put<AdminComment>(`/admin/comments/${id}/approve`, {});
  }

  rejectComment(id: string): Observable<AdminComment> {
    return this.api.put<AdminComment>(`/admin/comments/${id}/reject`, {});
  }

  deleteComment(id: string): Observable<void> {
    return this.api.delete<void>(`/admin/comments/${id}`);
  }

  // ==================== CONTACTS ====================

  getContactMessages(page = 0, size = 20): Observable<PageResponse<ContactMessage>> {
    return this.api.get<PageResponse<ContactMessage>>('/admin/contact/messages', { page, size });
  }

  markMessageAsRead(id: string): Observable<ContactMessage> {
    return this.api.put<ContactMessage>(`/admin/contact/messages/${id}/read`, {});
  }

  deleteMessage(id: string): Observable<void> {
    return this.api.delete<void>(`/admin/contact/messages/${id}`);
  }

  // ==================== NEWSLETTER ====================

  getNewsletterStats(): Observable<NewsletterStats> {
    return this.api.get<NewsletterStats>('/admin/newsletter/stats');
  }

  // CQ-09: Typed subscriber response
  getSubscribers(page = 0, size = 20): Observable<PageResponse<SubscriberResponse>> {
    return this.api.get<PageResponse<SubscriberResponse>>('/admin/newsletter/subscribers', { page, size });
  }

  deleteSubscriber(id: string): Observable<void> {
    return this.api.delete<void>(`/admin/newsletter/subscribers/${id}`);
  }

  exportSubscribersCsv(): Observable<Blob> {
    // INT-03: Use environment API URL instead of hardcoded '/api/v1'
    const baseUrl = `${environment.apiUrl}/${environment.apiVersion}`;
    // I-07: Add withCredentials for cookie-based auth consistency
    return this.http.get(`${baseUrl}/admin/newsletter/export`, { responseType: 'blob', withCredentials: true });
  }

  // ==================== USERS ====================

  getUsers(page = 0, size = 20): Observable<PageResponse<UserResponse>> {
    return this.api.get<PageResponse<UserResponse>>('/admin/users', { page, size });
  }

  createUser(data: Record<string, unknown>): Observable<UserResponse> {
    return this.api.post<UserResponse>('/admin/users', data);
  }

  updateUser(id: string, data: Record<string, unknown>): Observable<UserResponse> {
    return this.api.put<UserResponse>(`/admin/users/${id}`, data);
  }

  activateUser(id: string): Observable<UserResponse> {
    return this.api.put<UserResponse>(`/admin/users/${id}/activate`, {});
  }

  deactivateUser(id: string): Observable<UserResponse> {
    return this.api.put<UserResponse>(`/admin/users/${id}/deactivate`, {});
  }

  deleteUser(id: string): Observable<void> {
    return this.api.delete<void>(`/admin/users/${id}`);
  }

  // ==================== SETTINGS & CACHE ====================

  getSettings(): Observable<Record<string, unknown>> {
    return this.api.get<Record<string, unknown>>('/admin/settings');
  }

  updateSettings(data: Record<string, unknown>): Observable<Record<string, unknown>> {
    return this.api.put<Record<string, unknown>>('/admin/settings', data);
  }

  getCacheStats(): Observable<CacheStats> {
    return this.api.get<CacheStats>('/admin/cache/stats');
  }

  clearCache(): Observable<void> {
    return this.api.delete<void>('/admin/cache');
  }

  // ==================== IMAGE UPLOAD ====================

  uploadImage(file: File): Observable<{ url: string }> {
    return this.api.upload<{ url: string }>('/admin/images/upload', file);
  }

  // ==================== MEDIA LIBRARY ====================

  uploadMedia(file: File, purpose: string = 'GENERAL', altText?: string): Observable<MediaAssetResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const params = new URLSearchParams();
    params.set('purpose', purpose);
    if (altText) params.set('altText', altText);
    const baseUrl = `${environment.apiUrl}/${environment.apiVersion}`;
    return this.http.post<MediaAssetResponse>(
      `${baseUrl}/admin/media/upload?${params.toString()}`,
      formData,
      { withCredentials: true }
    );
  }

  getMediaAssets(page = 0, size = 20, purpose?: string): Observable<MediaListResponse> {
    const params: Record<string, string | number> = { page, size };
    if (purpose) params['purpose'] = purpose;
    return this.api.get<MediaListResponse>('/admin/media', params);
  }

  getMediaAsset(id: string): Observable<MediaAssetResponse> {
    return this.api.get<MediaAssetResponse>(`/admin/media/${id}`);
  }

  deleteMediaAsset(id: string): Observable<void> {
    return this.api.delete<void>(`/admin/media/${id}`);
  }

  // ==================== INT-12: Article Versions ====================

  getArticleVersions(articleId: string): Observable<ArticleVersionListResponse> {
    return this.api.get<ArticleVersionListResponse>(`/admin/articles/${articleId}/versions`);
  }

  getArticleVersion(articleId: string, versionNumber: number): Observable<ArticleVersionResponse> {
    return this.api.get<ArticleVersionResponse>(`/admin/articles/${articleId}/versions/${versionNumber}`);
  }

  compareVersions(articleId: string, fromVersion: number, toVersion: number): Observable<VersionCompareResponse> {
    return this.api.get<VersionCompareResponse>(`/admin/articles/${articleId}/versions/compare`, { fromVersion, toVersion });
  }

  restoreVersion(articleId: string, versionNumber: number, reason?: string): Observable<ArticleResponse> {
    const params = reason ? `?reason=${encodeURIComponent(reason)}` : '';
    return this.api.post<ArticleResponse>(`/admin/articles/${articleId}/versions/${versionNumber}/restore${params}`, {});
  }

  // ==================== INT-12: Export/Import ====================

  exportBlog(): Observable<Blob> {
    const baseUrl = `${environment.apiUrl}/${environment.apiVersion}`;
    return this.http.get(`${baseUrl}/admin/export`, { responseType: 'blob', withCredentials: true });
  }

  exportBlogJson(): Observable<Blob> {
    const baseUrl = `${environment.apiUrl}/${environment.apiVersion}`;
    return this.http.get(`${baseUrl}/admin/export/json`, { responseType: 'blob', withCredentials: true });
  }

  importBlog(file: File): Observable<{ message: string }> {
    return this.api.upload<{ message: string }>('/admin/export/import', file);
  }

  exportArticlesMarkdown(): Observable<Blob> {
    const baseUrl = `${environment.apiUrl}/${environment.apiVersion}`;
    return this.http.get(`${baseUrl}/admin/export/markdown`, { responseType: 'blob', withCredentials: true });
  }

  getExportStats(): Observable<Record<string, number>> {
    return this.api.get<Record<string, number>>('/admin/export/stats');
  }

  // ==================== INT-12: Analytics ====================

  getAnalyticsSummary(period = '30d'): Observable<AnalyticsSummary> {
    return this.api.get<AnalyticsSummary>('/admin/analytics/summary', { period });
  }

  getAnalytics(period = '30d'): Observable<AnalyticsSummary> {
    return this.api.get<AnalyticsSummary>('/admin/analytics', { period });
  }

  getSearchAnalytics(): Observable<SearchAnalytics> {
    return this.api.get<SearchAnalytics>('/admin/analytics/search');
  }

  getAnalyticsComparison(period = '30d'): Observable<AnalyticsComparison> {
    return this.api.get<AnalyticsComparison>('/admin/analytics/compare', { period });
  }

  // ==================== INC-05: Tag CRUD (update + delete) ====================

  getTags(page = 0, size = 50): Observable<PageResponse<TagResponse>> {
    return this.api.get<PageResponse<TagResponse>>('/admin/tags', { page, size });
  }

  createTag(data: { name: string; description?: string; color?: string }): Observable<TagResponse> {
    return this.api.post<TagResponse>('/admin/tags', data);
  }

  updateTag(id: string, data: { name?: string; description?: string; color?: string }): Observable<TagResponse> {
    return this.api.put<TagResponse>(`/admin/tags/${id}`, data);
  }

  deleteTag(id: string): Observable<void> {
    return this.api.delete<void>(`/admin/tags/${id}`);
  }

  // ==================== INC-09: Comment Spam ====================

  markCommentAsSpam(id: string): Observable<AdminComment> {
    return this.api.put<AdminComment>(`/admin/comments/${id}/spam`, {});
  }

  // ==================== INC-10: User Role Management ====================

  updateUserRole(id: string, role: string): Observable<UserResponse> {
    return this.api.put<UserResponse>(`/admin/users/${id}/role`, { role });
  }

  getUserStats(): Observable<UserStats> {
    return this.api.get<UserStats>('/admin/users/stats');
  }

  // ==================== EMAIL TEMPLATE MANAGEMENT ====================

  getEmailTemplates(): Observable<{ id: string; name: string; description: string; customized?: boolean }[]> {
    return this.api.get<{ id: string; name: string; description: string; customized?: boolean }[]>('/admin/settings/email-templates');
  }

  getEmailTemplatePreview(templateId: string): Observable<string> {
    return this.api.getText(`/admin/settings/email-templates/${templateId}/preview`);
  }

  getEmailTemplateSource(templateId: string): Observable<{
    templateId: string; html: string; isOverride: boolean;
    placeholders: Record<string, unknown>;
    customVariables: { global: CustomVariable[]; template: CustomVariable[] };
  }> {
    return this.api.get(`/admin/settings/email-templates/${templateId}/source`);
  }

  updateEmailTemplate(templateId: string, html: string): Observable<{ message: string }> {
    return this.api.put<{ message: string }>(`/admin/settings/email-templates/${templateId}`, { html });
  }

  deleteEmailTemplate(templateId: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/admin/settings/email-templates/${templateId}`);
  }

  previewCustomEmailTemplate(templateId: string, html: string): Observable<string> {
    return this.api.postText(`/admin/settings/email-templates/${templateId}/preview`, { html });
  }

  // Custom Variables
  getCustomVariables(templateId?: string): Observable<{ variables: CustomVariable[] }> {
    const params = templateId ? `?templateId=${templateId}` : '';
    return this.api.get(`/admin/settings/email-templates/custom-variables${params}`);
  }

  createCustomVariable(data: { key: string; value: string; description?: string; templateId?: string }): Observable<CustomVariable> {
    return this.api.post(`/admin/settings/email-templates/custom-variables`, data);
  }

  updateCustomVariable(id: number, data: { value: string; description?: string }): Observable<CustomVariable> {
    return this.api.put(`/admin/settings/email-templates/custom-variables/${id}`, data);
  }

  deleteCustomVariable(id: number): Observable<{ message: string }> {
    return this.api.delete(`/admin/settings/email-templates/custom-variables/${id}`);
  }

  // ==================== INT-12: Auth Token Verification ====================

  verifyToken(): Observable<{ valid: boolean; email?: string }> {
    return this.api.get<{ valid: boolean; email?: string }>('/auth/verify');
  }

  // ==================== INT-12: Fine-grained Cache Invalidation ====================

  clearCacheByName(cacheName: string): Observable<void> {
    return this.api.delete<void>(`/admin/cache/${cacheName}`);
  }

  // ==================== INT-12: Newsletter Batch Delete ====================

  deleteSubscribersBatch(ids: string[]): Observable<void> {
    return this.api.post<void>('/admin/newsletter/subscribers/delete-batch', { ids });
  }

  // ==================== I18N: Translation Management ====================

  getTranslations(locale: string, namespace: string, search?: string, page = 0, size = 50): Observable<TranslationPage> {
    const params: Record<string, string | number> = { locale, namespace, page, size };
    if (search) params['search'] = search;
    return this.api.get<TranslationPage>('/admin/settings/translations', params);
  }

  updateTranslation(id: number, value: string): Observable<{ status: string }> {
    return this.api.put<{ status: string }>(`/admin/settings/translations/${id}`, { value });
  }

  createTranslation(body: { translationKey: string; locale: string; value: string; namespace?: string; visibility?: string }): Observable<{ id: number; status: string }> {
    return this.api.post<{ id: number; status: string }>('/admin/settings/translations', body);
  }

  deleteTranslation(id: number): Observable<{ status: string }> {
    return this.api.delete<{ status: string }>(`/admin/settings/translations/${id}`);
  }

  invalidateI18nCache(): Observable<{ status: string }> {
    return this.api.post<{ status: string }>('/admin/settings/translations/cache/invalidate');
  }
}
