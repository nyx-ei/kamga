export type MemberRegistrationActionCode =
  | 'KMG-AUTH-401'
  | 'KMG-REF-001'
  | 'KMG-REF-004'
  | 'KMG-RG-001'
  | 'KMG-RG-002'
  | 'KMG-RG-003'
  | 'KMG-RG-004'
  | 'KMG-SYS-000';

export type MemberRegistrationActionResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      code: MemberRegistrationActionCode;
    };

export const MEMBER_REGISTRATION_STORAGE_KEY = 'kamga.memberRegistration.v1';
export const MAX_SESSION_EVIDENCE_BYTES = 2 * 1024 * 1024;
export const MEMBER_EVIDENCE_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;

export type MemberEvidenceMimeType = (typeof MEMBER_EVIDENCE_MIME_TYPES)[number];

export type StoredEvidenceFile = {
  dataUrl: string;
  mimeType: MemberEvidenceMimeType;
  name: string;
};

export type StoredMemberRegistration = {
  consent: true;
  dateOfArrivalCanada: string;
  email: string;
  firstName: string;
  governmentId: StoredEvidenceFile;
  immigrationProof: StoredEvidenceFile;
  lastName: string;
  locale: 'en' | 'fr';
  phone: string;
  referralToken: string;
  sin: string;
};
