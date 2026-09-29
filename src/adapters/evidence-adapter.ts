import { EvidenceReference } from '../types';

export interface EvidenceProjectSubject {
  subjectId: string;
  name: string;
  type: string;
  status: string;
  metadata?: Record<string, any>;
}

export class EvidenceAdapter {
  private baseUrl: string;
  private authToken?: string;

  constructor(endpoint?: string, authToken?: string) {
    this.baseUrl = endpoint || process.env.EVIDENCE_API_URL || 'https://brgkao1ln5.execute-api.sa-east-1.amazonaws.com';
    this.authToken = authToken || process.env.EVIDENCE_AUTH_TOKEN;
  }

  public isAvailable(): boolean {
    return Boolean(this.baseUrl);
  }

  /**
   * Fetches subject projection from Evidence API, with deterministic fallback
   * if upstream Evidence API is unreachable, offline, or returns non-200.
   */
  public async getSubjectProjection(projectId: string, subjectId: string): Promise<EvidenceProjectSubject | null> {
    const url = `${this.baseUrl}/projects/${projectId}/subjects/${subjectId}`;
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const res = await fetch(url, { method: 'GET', headers });
      if (!res.ok) {
        console.warn(`[EvidenceAdapter] Fallback triggered: Evidence API returned status ${res.status} for ${url}`);
        return null;
      }
      return await res.json() as EvidenceProjectSubject;
    } catch (err: any) {
      console.warn(`[EvidenceAdapter] Fallback triggered: Network/Auth error contacting Evidence API (${err.message})`);
      return null;
    }
  }

  /**
   * Reads governed evidence artifact metadata
   */
  public async getEvidenceReference(projectId: string, artifactId: string): Promise<EvidenceReference | null> {
    const url = `${this.baseUrl}/projects/${projectId}/artifacts/${artifactId}`;
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const res = await fetch(url, { method: 'GET', headers });
      if (!res.ok) {
        console.warn(`[EvidenceAdapter] Artifact fetch fallback: status ${res.status}`);
        return null;
      }
      const data = await res.json() as any;
      return {
        evidenceId: data.artifactId || artifactId,
        documentId: data.documentId || artifactId,
        documentTitle: data.title || data.filename || 'Governed Evidence Document',
        admissibilityStatus: data.status === 'SEALED' ? 'ADMISSIBLE' : 'PENDING',
        freshnessTimestamp: data.createdAt || new Date().toISOString(),
        custodySource: 'KOS Evidence Platform',
        sha256: data.checksum,
      };
    } catch (err: any) {
      console.warn(`[EvidenceAdapter] Fallback on artifact read: ${err.message}`);
      return null;
    }
  }
}
