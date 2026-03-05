// ============================================
// RESUME PROFILE
// ============================================

export interface ResumeProfileEducation {
  id?: string;
  institution: string;
  location: string;
  degree: string;
  fieldOfStudy?: string;
  startDate: string;
  endDate: string;
  description?: string;
  sortOrder: number;
}

export interface ResumeProfileExperience {
  id?: string;
  company: string;
  position: string;
  startDate: string;
  endDate?: string;
  bullets: string[];
  sortOrder: number;
}

export interface ResumeProfileSkill {
  id?: string;
  category: string;
  content: string;
  sortOrder: number;
}

export interface ResumeProfileLanguage {
  id?: string;
  name: string;
  proficiency: string;
  sortOrder: number;
}

export interface ResumeProfileCertification {
  id?: string;
  name: string;
  issuer?: string;
  issueDate?: string;
  credentialUrl?: string;
  description?: string;
  sortOrder: number;
}

export interface ResumeProfileAdditionalInfo {
  id?: string;
  label: string;
  content: string;
  sortOrder: number;
}

export interface ResumeProfileHomeCustomization {
  id?: string;
  label: string;
  content: string;
  sortOrder: number;
}

export interface ResumeProfileTestimonial {
  id?: string;
  authorName: string;
  authorRole: string;
  authorCompany: string;
  authorImageUrl?: string;
  text: string;
  accentColor?: string;
  sortOrder: number;
}

export interface ResumeProfileProficiency {
  id?: string;
  category?: string;
  skillName: string;
  percentage: number;
  icon?: string;
  sortOrder: number;
}

export interface ResumeProfileProject {
  id?: string;
  title: string;
  description: string;
  imageUrl?: string;
  projectUrl?: string;
  repoUrl?: string;
  techTags: string[];
  featured?: boolean;
  sortOrder: number;
}

export interface ResumeProfileLearningTopic {
  id?: string;
  title: string;
  emoji?: string;
  description: string;
  colorTheme?: string;
  sortOrder: number;
}

export interface ResumeProfile {
  id?: string;
  ownerId?: string;
  locale?: string;
  fullName: string;
  title?: string;
  avatarUrl?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  website?: string;
  location?: string;
  professionalSummary?: string;
  interests?: string;
  workMode?: string;
  timezone?: string;
  employmentType?: string;
  createdAt?: string;
  updatedAt?: string;
  educations: ResumeProfileEducation[];
  experiences: ResumeProfileExperience[];
  skills: ResumeProfileSkill[];
  languages: ResumeProfileLanguage[];
  certifications: ResumeProfileCertification[];
  additionalInfo: ResumeProfileAdditionalInfo[];
  homeCustomization: ResumeProfileHomeCustomization[];
  testimonials: ResumeProfileTestimonial[];
  proficiencies: ResumeProfileProficiency[];
  projects: ResumeProfileProject[];
  learningTopics: ResumeProfileLearningTopic[];
}

export interface ResumeProfileRequest {
  fullName: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  website?: string;
  location?: string;
  professionalSummary?: string;
  interests?: string;
  workMode?: string;
  timezone?: string;
  employmentType?: string;
  educations?: ResumeProfileEducation[];
  experiences?: ResumeProfileExperience[];
  skills?: ResumeProfileSkill[];
  languages?: ResumeProfileLanguage[];
  certifications?: ResumeProfileCertification[];
  additionalInfo?: ResumeProfileAdditionalInfo[];
  homeCustomization?: ResumeProfileHomeCustomization[];
  testimonials?: ResumeProfileTestimonial[];
  proficiencies?: ResumeProfileProficiency[];
  projects?: ResumeProfileProject[];
  learningTopics?: ResumeProfileLearningTopic[];
}
