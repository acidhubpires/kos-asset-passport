import { describe, it, expect } from 'vitest';
import { handler } from '../src/api/handler';

describe('Asset Creation, Spatial Context & Event Persistence', () => {
  const tenantId = 'tenant-test-asset';

  it('creates an asset passport and persists ASSET_CREATED operational event', async () => {
    const createEvent = {
      rawPath: '/api/assets',
      headers: { 'X-Tenant-Id': tenantId },
      requestContext: {
        http: { method: 'POST', path: '/api/assets' },
      },
      body: JSON.stringify({
        assetId: 'AP-TEST-99',
        name: 'Test Transmission Tower 99',
        assetType: 'TELECOM_TOWER',
        description: 'Test telecom tower for automated suite',
        currentState: 'OPERATIONAL',
        ownerContext: {
          operator: 'AcidHub Test Telco',
          responsibleTeam: 'Network Infra',
          criticalityTier: 'TIER_1',
        },
      }),
    };

    const res = await handler(createEvent);
    expect(res.statusCode).toBe(201);
    const created = JSON.parse(res.body);
    expect(created.assetId).toBe('AP-TEST-99');
    expect(created.name).toBe('Test Transmission Tower 99');

    // Verify event in timeline
    const timelineRes = await handler({
      rawPath: '/api/assets/AP-TEST-99/timeline',
      headers: { 'X-Tenant-Id': tenantId },
      requestContext: { http: { method: 'GET', path: '/api/assets/AP-TEST-99/timeline' } },
    });
    expect(timelineRes.statusCode).toBe(200);
    const events = JSON.parse(timelineRes.body);
    expect(events.some((e: any) => e.eventType === 'ASSET_CREATED')).toBe(true);
  });

  it('binds spatial location and enforces epistemological spatial disclaimer', async () => {
    const bindSpatialEvent = {
      rawPath: '/api/assets/AP-TEST-99/spatial',
      headers: { 'X-Tenant-Id': tenantId },
      requestContext: { http: { method: 'POST', path: '/api/assets/AP-TEST-99/spatial' } },
      body: JSON.stringify({
        latitude: -23.55052,
        longitude: -46.633308,
        elevationMeters: 760,
        address: 'Av. Paulista, 1000',
        municipality: 'São Paulo',
        stateOrRegion: 'SP',
        reconciliationStatus: 'ESTIMATED',
      }),
    };

    const res = await handler(bindSpatialEvent);
    expect(res.statusCode).toBe(200);
    const updated = JSON.parse(res.body);
    expect(updated.spatial).toBeDefined();
    expect(updated.spatial.latitude).toBe(-23.55052);
    expect(updated.spatial.reconciliationStatus).toBe('ESTIMATED');
    expect(updated.spatial.disclaimer).toContain('SubjectIdentity != SpatialBinding');
  });

  it('associates an observation with governed source and emits OBSERVATION_ADDED, SOURCE_ASSOCIATED, ATTENTION_RAISED', async () => {
    const obsEvent = {
      rawPath: '/api/assets/AP-TEST-99/observations',
      headers: { 'X-Tenant-Id': tenantId },
      requestContext: { http: { method: 'POST', path: '/api/assets/AP-TEST-99/observations' } },
      body: JSON.stringify({
        category: 'MAINTENANCE',
        summary: 'Falha no banco de baterias redundante',
        details: 'Tensão residual de 38V; gerador diesel não iniciou automaticamente.',
        deltaDescription: 'Autonomia caiu para 45 minutos.',
        evidenceRef: {
          documentId: 'doc-report-2026',
          documentTitle: 'Relatório Técnico #RT-009',
          admissibilityStatus: 'ADMISSIBLE',
          freshnessTimestamp: new Date().toISOString(),
          custodySource: 'KOS Evidence Platform',
        },
        attentionItem: {
          severity: 'CRITICAL',
          headline: 'Alerta crítico de perda iminente de energia',
          candidateExplanation: 'Site sem redundância energética por degradação das baterias.',
          evidenceBasis: 'Relatório Técnico #RT-009',
          recommendedAction: 'Despacho de emergência para substituição das células',
        },
      }),
    };

    const res = await handler(obsEvent);
    expect(res.statusCode).toBe(201);
    const updated = JSON.parse(res.body);
    expect(updated.observations.length).toBeGreaterThan(0);
    expect(updated.attentionItems.length).toBeGreaterThan(0);
    expect(updated.attentionItems[0].isCandidateOnly).toBe(true);

    // Verify operational events in timeline
    const timelineRes = await handler({
      rawPath: '/api/assets/AP-TEST-99/timeline',
      headers: { 'X-Tenant-Id': tenantId },
      requestContext: { http: { method: 'GET', path: '/api/assets/AP-TEST-99/timeline' } },
    });
    const events = JSON.parse(timelineRes.body);
    expect(events.some((e: any) => e.eventType === 'OBSERVATION_ADDED')).toBe(true);
    expect(events.some((e: any) => e.eventType === 'SOURCE_ASSOCIATED')).toBe(true);
    expect(events.some((e: any) => e.eventType === 'ATTENTION_RAISED')).toBe(true);
  });
});
