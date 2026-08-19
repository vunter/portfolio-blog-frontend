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

// AUD18-01: Aligned with backend SubscriberResponse — the API sends a `status`
// enum string, not `active`/`confirmed` booleans.
export type NewsletterSubscriberStatus = 'PENDING' | 'CONFIRMED' | 'UNSUBSCRIBED';

export interface NewsletterSubscriber {
  id: string;
  email: string;
  name?: string;
  status: NewsletterSubscriberStatus;
  subscribedAt: string;
  confirmedAt?: string;
  unsubscribedAt?: string;
  // Account link visibility (null/absent when not linked)
  userId?: string;
  linkedAt?: string;
  linkOrigin?: string;
}
