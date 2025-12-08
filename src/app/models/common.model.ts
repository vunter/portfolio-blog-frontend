// ============================================
// COMMON TYPES
// ============================================

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

// ============================================
// NEWSLETTER
// ============================================

export interface NewsletterSubscriber {
  id: string;
  email: string;
  name?: string;
  confirmed: boolean;
  active: boolean;
  subscribedAt: string;
  confirmedAt?: string;
  unsubscribedAt?: string;
}
