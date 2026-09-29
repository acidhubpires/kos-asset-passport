import { AssetPassport, ProductEvent, ObservabilityMetrics } from '../types';

export const GOLDEN_ASSET_AP001: AssetPassport = {
  assetId: 'AP-001',
  tenantId: 'tenant-default',
  name: 'Telecom Site AP-001',
  assetType: 'TELECOM_TOWER',
  description: 'Torre de telecomunicações de transmissão celular 4G/5G com abrigo de baterias LFP e gerador auxiliar a diesel.',
  ownerContext: {
    operator: 'AcidHub Telco Infrastructure',
    responsibleTeam: 'Field Operations Southeast / Critical Infrastructure',
    criticalityTier: 'TIER_1',
    contactEmail: 'ops.southeast@acidhub.internal',
  },
  currentState: 'MAINTENANCE_REQUIRED',
  knownAttributes: {
    towerHeightMeters: 45,
    backupPowerType: 'Bateria LFP 48V + Gerador Diesel 30kVA',
    primaryCarriers: 'Claro, Vivo, TIM',
    structuralLicense: 'ANATEL-SP-2024-9982',
    lastPreventiveDate: '2026-03-15',
    nominalBatteryAutonomyHours: 8,
  },
  missingInformation: [
    'Certificado de calibração anual do retificador primário AC/DC',
    'Laudo de conformidade acústico-ambiental do gerador diesel 2026',
  ],
  spatial: {
    bindingId: 'sp-ap001-01',
    latitude: -23.55052,
    longitude: -46.633308,
    elevationMeters: 760,
    address: 'Av. Paulista, 1000 - Bela Vista',
    municipality: 'São Paulo',
    stateOrRegion: 'SP',
    country: 'Brasil',
    spatialPrecisionMeters: 5,
    boundAt: '2026-09-01T10:00:00.000Z',
    reconciliationStatus: 'ESTIMATED',
    disclaimer: 'SubjectIdentity != SpatialBinding; Location != Provenance; Document != Evidence',
  },
  observations: [
    {
      observationId: 'obs-001',
      assetId: 'AP-001',
      tenantId: 'tenant-default',
      observedAt: '2026-03-15T14:30:00.000Z',
      category: 'FIELD_INSPECTION',
      summary: 'Inspeção preventiva semestral de integridade estrutural e sistemas elétricos.',
      details: 'Vistoria física da estrutura vertical da torre de 45m e verificação de aterramento elétrico.',
      deltaDescription: 'Estrutura mecânica sem corrosão ativa; sistema de aterramento conforme norma NBR-5419.',
      recordedBy: 'Eng. Carlos Andrade (CREA-SP 506123)',
      evidenceRef: {
        evidenceId: 'ev-001',
        documentId: 'doc-inspec-2026-03',
        documentTitle: 'Relatório de Engenharia Estrutural #EE-902',
        fragmentId: 'frag-ee-902-sec3',
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        admissibilityStatus: 'ADMISSIBLE',
        freshnessTimestamp: '2026-03-15T14:30:00.000Z',
        custodySource: 'KOS Evidence Platform / Project Projections',
      },
    },
    {
      observationId: 'obs-002',
      assetId: 'AP-001',
      tenantId: 'tenant-default',
      observedAt: '2026-09-28T09:15:00.000Z',
      category: 'MAINTENANCE',
      summary: 'Alerta de degradação acelerada do banco de baterias de backup e falha no teste de partida do gerador.',
      details: 'Ciclo de descarga preventiva registrou queda súbita de tensão na terceira string e gerador não acoplou carga.',
      deltaDescription: 'Autonomia real caiu de 8h nominais para apenas 42 minutos. Temperatura interna da sala de energia atingiu 48°C.',
      recordedBy: 'Sistema de Telemetria Remota AcidHub / Agente de Campo',
      evidenceRef: {
        evidenceId: 'ev-002',
        documentId: 'doc-telemetry-2026-09-28',
        documentTitle: 'Log de Telemetria de Energia e Eventos de Contingência #TEL-0928',
        fragmentId: 'frag-tel-0928-battery-string',
        sha256: '9f83c6051a842e4822063e0237560f044cd0669e222a315ac0da10136a7c00f1',
        admissibilityStatus: 'ADMISSIBLE',
        freshnessTimestamp: '2026-09-28T09:15:00.000Z',
        custodySource: 'KOS Evidence Platform / Telemetry Ingestion',
      },
    },
  ],
  attentionItems: [
    {
      itemId: 'att-001',
      severity: 'CRITICAL',
      headline: 'Risco iminente de perda de contingência energética (SLA Tier 1 em risco)',
      candidateExplanation: 'O banco de baterias opera com apenas 42 minutos de autonomia (nominal 8 horas) com aquecimento a 48°C, somado à falha de acoplamento do gerador diesel. Em caso de instabilidade na rede concessionária, o site entrará em blackout.',
      evidenceBasis: 'Evidência Governamental #TEL-0928 (doc-telemetry-2026-09-28) e Relatório #EE-902 (doc-inspec-2026-03).',
      recommendedAction: 'Despacho emergencial de equipe técnica para troca do módulo de baterias e desengripamento do atuador do gerador.',
      raisedAt: '2026-09-28T09:30:00.000Z',
      isCandidateOnly: true,
    },
  ],
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-28T09:30:00.000Z',
};

export class LocalAdapter {
  private assets: Map<string, AssetPassport> = new Map();
  private events: ProductEvent[] = [];

  constructor() {
    this.assets.set(GOLDEN_ASSET_AP001.assetId, { ...GOLDEN_ASSET_AP001 });
    this.recordInitialEvents();
  }

  private recordInitialEvents() {
    this.events.push({
      eventId: 'evt-init-01',
      tenantId: 'tenant-default',
      assetId: 'AP-001',
      eventType: 'ASSET_CREATED',
      payload: { name: 'Telecom Site AP-001', type: 'TELECOM_TOWER' },
      occurredAt: '2026-09-01T10:00:00.000Z',
      persistedAt: '2026-09-01T10:00:00.000Z',
      note: 'Product events are not Evidence Chronicle.',
    });
    this.events.push({
      eventId: 'evt-init-02',
      tenantId: 'tenant-default',
      assetId: 'AP-001',
      eventType: 'LOCATION_BOUND',
      payload: { lat: -23.55052, lon: -46.633308, address: 'Av. Paulista, 1000' },
      occurredAt: '2026-09-01T10:05:00.000Z',
      persistedAt: '2026-09-01T10:05:00.000Z',
      note: 'SubjectIdentity != SpatialBinding',
    });
    this.events.push({
      eventId: 'evt-init-03',
      tenantId: 'tenant-default',
      assetId: 'AP-001',
      eventType: 'SOURCE_ASSOCIATED',
      payload: { docId: 'doc-inspec-2026-03', title: 'Relatório de Engenharia Estrutural #EE-902' },
      occurredAt: '2026-03-15T14:30:00.000Z',
      persistedAt: '2026-03-15T14:30:00.000Z',
    });
    this.events.push({
      eventId: 'evt-init-04',
      tenantId: 'tenant-default',
      assetId: 'AP-001',
      eventType: 'OBSERVATION_ADDED',
      payload: { observationId: 'obs-002', summary: 'Alerta de degradação acelerada do banco de baterias' },
      occurredAt: '2026-09-28T09:15:00.000Z',
      persistedAt: '2026-09-28T09:15:00.000Z',
    });
    this.events.push({
      eventId: 'evt-init-05',
      tenantId: 'tenant-default',
      assetId: 'AP-001',
      eventType: 'ATTENTION_RAISED',
      payload: { severity: 'CRITICAL', headline: 'Risco iminente de perda de contingência energética' },
      occurredAt: '2026-09-28T09:30:00.000Z',
      persistedAt: '2026-09-28T09:30:00.000Z',
    });
  }

  public listAssets(tenantId: string): AssetPassport[] {
    return Array.from(this.assets.values()).filter(a => a.tenantId === tenantId || tenantId === 'all');
  }

  public getAsset(assetId: string, tenantId: string): AssetPassport | undefined {
    const asset = this.assets.get(assetId);
    if (!asset) return undefined;
    if (asset.tenantId !== tenantId && tenantId !== 'all') return undefined;
    return asset;
  }

  public saveAsset(asset: AssetPassport): AssetPassport {
    asset.updatedAt = new Date().toISOString();
    this.assets.set(asset.assetId, asset);
    return asset;
  }

  public recordEvent(event: ProductEvent): ProductEvent {
    const recorded = {
      ...event,
      persistedAt: new Date().toISOString(),
      note: event.note || 'Product events are not Evidence Chronicle.',
    };
    this.events.push(recorded);
    return recorded;
  }

  public getEvents(assetId: string, tenantId: string): ProductEvent[] {
    return this.events.filter(e => e.assetId === assetId && (e.tenantId === tenantId || tenantId === 'all'));
  }

  public getObservabilityMetrics(tenantId: string): ObservabilityMetrics {
    const assets = this.listAssets(tenantId);
    let totalObservations = 0;
    let openAttentionCount = 0;
    let recentChangesCount = 0;
    let fresh = 0;
    let moderate = 0;
    let stale = 0;
    const now = Date.now();

    for (const a of assets) {
      totalObservations += a.observations.length;
      openAttentionCount += a.attentionItems.length;
      if (a.currentState === 'MAINTENANCE_REQUIRED' || a.currentState === 'DEGRADED') {
        recentChangesCount++;
      }
      for (const obs of a.observations) {
        if (obs.evidenceRef?.freshnessTimestamp) {
          const diffDays = (now - new Date(obs.evidenceRef.freshnessTimestamp).getTime()) / (1000 * 3600 * 24);
          if (diffDays <= 7) fresh++;
          else if (diffDays <= 30) moderate++;
          else stale++;
        }
      }
    }

    return {
      totalAssets: assets.length,
      totalObservations,
      openAttentionCount,
      freshnessBreakdown: { fresh, moderate, stale },
      recentChangesCount,
      observationsByMonth: [
        { period: '2026-03', count: 1 },
        { period: '2026-06', count: 0 },
        { period: '2026-08', count: 0 },
        { period: '2026-09', count: 1 },
      ],
      sourceCoverage: [
        { sourceName: 'KOS Evidence Platform', verifiedCount: 2 },
        { sourceName: 'Manual Operator Logs', verifiedCount: 0 },
      ],
    };
  }
}
