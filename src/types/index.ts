export type AssetType =
  | 'TELECOM_TOWER'
  | 'SOLAR_ARRAY'
  | 'SUBSTATION'
  | 'INDUSTRIAL_EQUIPMENT'
  | 'FACILITY'
  | 'LOGISTICS_NODE';

export type AssetState =
  | 'OPERATIONAL'
  | 'MAINTENANCE_REQUIRED'
  | 'DEGRADED'
  | 'OFFLINE'
  | 'COMMISSIONING';

export type AttentionSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface SpatialBinding {
  bindingId: string;
  latitude: number;
  longitude: number;
  elevationMeters?: number;
  address?: string;
  municipality?: string;
  stateOrRegion?: string;
  country?: string;
  spatialPrecisionMeters?: number;
  boundAt: string;
  reconciliationStatus: 'UNRECONCILED' | 'RECONCILED' | 'ESTIMATED';
  disclaimer: string; // "SubjectIdentity != SpatialBinding; Location != Provenance"
}

export interface EvidenceReference {
  evidenceId: string;
  documentId?: string;
  documentTitle?: string;
  fragmentId?: string;
  sha256?: string;
  admissibilityStatus: 'ADMISSIBLE' | 'PENDING' | 'LOCAL_RECORD';
  freshnessTimestamp: string;
  custodySource: string; // e.g. "KOS Evidence Platform / Telemetry", "Field Dispatch Report"
}

export interface Observation {
  observationId: string;
  assetId: string;
  tenantId: string;
  observedAt: string;
  category: 'TELEMETRY' | 'FIELD_INSPECTION' | 'MAINTENANCE' | 'COMPLIANCE' | 'INCIDENT';
  summary: string;
  details: string;
  deltaDescription?: string;
  evidenceRef?: EvidenceReference;
  recordedBy: string;
}

export interface AttentionItem {
  itemId: string;
  severity: AttentionSeverity;
  headline: string;
  candidateExplanation: string;
  evidenceBasis: string;
  recommendedAction: string;
  raisedAt: string;
  isCandidateOnly: true; // AI remains CANDIDATE
}

export interface AssetPassport {
  assetId: string;
  tenantId: string;
  name: string;
  assetType: AssetType;
  description: string;
  ownerContext: {
    operator: string;
    responsibleTeam: string;
    criticalityTier: 'TIER_1' | 'TIER_2' | 'TIER_3';
    contactEmail?: string;
  };
  currentState: AssetState;
  knownAttributes: Record<string, string | number | boolean>;
  missingInformation: string[];
  spatial?: SpatialBinding;
  observations: Observation[];
  attentionItems: AttentionItem[];
  createdAt: string;
  updatedAt: string;
}

export type ProductEventType =
  | 'ASSET_CREATED'
  | 'SOURCE_ASSOCIATED'
  | 'OBSERVATION_ADDED'
  | 'LOCATION_BOUND'
  | 'CHANGE_DETECTED'
  | 'ATTENTION_RAISED'
  | 'CHAT_QUERY_RECORDED';

export interface ProductEvent {
  eventId: string;
  tenantId: string;
  assetId: string;
  eventType: ProductEventType;
  payload: Record<string, any>;
  occurredAt: string;
  persistedAt?: string;
  note?: string; // Product events are not Evidence Chronicle
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  category?: 'explanation' | 'attention' | 'general';
  candidateNotice?: boolean;
}

export interface ObservabilityMetrics {
  totalAssets: number;
  totalObservations: number;
  openAttentionCount: number;
  freshnessBreakdown: {
    fresh: number; // < 7 days
    moderate: number; // 7-30 days
    stale: number; // > 30 days
  };
  recentChangesCount: number;
  observationsByMonth: { period: string; count: number }[];
  sourceCoverage: { sourceName: string; verifiedCount: number }[];
}

export interface IntegrationStatus {
  evidenceApi: {
    configured: boolean;
    endpoint: string;
    status: 'AVAILABLE' | 'UNAVAILABLE' | 'FALLBACK';
  };
  foundryApi: {
    configured: boolean;
    status: 'REFERENCE_PATTERN' | 'LOCAL';
  };
  studioCognition: {
    configured: boolean;
    status: 'CANDIDATE_ONLY' | 'LOCAL_SYNTHESIS';
  };
}
