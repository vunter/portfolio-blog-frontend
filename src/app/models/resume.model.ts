import { UserResponse } from './user.model';

// ============================================
// RESUME TEMPLATE
// ============================================

export type ResumeTemplateStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type PaperSize = 'A4' | 'LETTER' | 'LEGAL';
export type PageOrientation = 'PORTRAIT' | 'LANDSCAPE';

export interface ResumeTemplate {
  id: string;
  name: string;
  slug: string;
  alias?: string;
  description?: string;
  htmlContent: string;
  cssContent?: string;
  // Aliases for component compatibility
  htmlTemplate?: string;
  cssStyles?: string;
  // INT-06: Backend sends previewUrl, frontend aliases as thumbnailUrl
  thumbnailUrl?: string;
  previewUrl?: string;
  status: ResumeTemplateStatus;
  paperSize: PaperSize;
  orientation: PageOrientation;
  isDefault: boolean;
  downloadCount: number;
  // INT-06: Backend sends ownerId/ownerName instead of full author object
  author?: UserResponse;
  ownerId?: string;
  ownerName?: string;
  version?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeTemplateRequest {
  name: string;
  alias?: string;
  description?: string;
  htmlContent: string;
  cssContent?: string;
  status?: ResumeTemplateStatus;
  paperSize?: PaperSize;
  orientation?: PageOrientation;
  isDefault?: boolean;
}

export interface ResumeTemplateResponse {
  id: string;
  name: string;
  slug: string;
  alias?: string;
  description?: string;
  htmlContent: string;
  cssContent?: string;
  status: ResumeTemplateStatus;
  paperSize: PaperSize;
  orientation: PageOrientation;
  isDefault: boolean;
  downloadCount: number;
  // INT-06: Backend sends owner info, not full UserResponse
  author?: UserResponse;
  ownerId?: string;
  ownerName?: string;
  previewUrl?: string;
  version?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PdfGenerationRequest {
  html?: string;
  htmlContent?: string;
  templateId?: string;
  variables?: Record<string, string>;
  paperSize?: PaperSize;
  orientation?: PageOrientation;
  format?: 'A4' | 'Letter';
  filename?: string;
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  includeBackground?: boolean;
}
