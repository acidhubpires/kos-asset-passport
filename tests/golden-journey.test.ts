import { describe, it, expect } from 'vitest';
import { handler } from '../src/api/handler';

describe('End-to-End Authenticated Golden Journey: Telecom Site AP-001', () => {
  const tenantId = 'tenant-golden-ap001';
  const userEmail = 'operator@acidhub.internal';

  const authClaims = {
    sub: 'cognito-user-ap001-uuid',
    email: userEmail,
    'custom:tenant_id': tenantId,
  };

  it('completes the 13-step Golden Journey successfully', async () => {
    // ----------------------------------------------------
    // STEP 1: Cognito Login / Authenticated Context
    // ----------------------------------------------------
    expect(authClaims.email).toBe(userEmail);
    expect(authClaims['custom:tenant_id']).toBe(tenantId);

    // ----------------------------------------------------
    // STEP 2 & 3: Create/Open Asset Passport with Identity
    // ----------------------------------------------------
    const createRes = await handler({
      rawPath: '/api/assets',
      headers: { 'X-Tenant-Id': tenantId },
      requestContext: {
        http: { method: 'POST', path: '/api/assets' },
        authorizer: { jwt: { claims: authClaims } },
      },
      body: JSON.stringify({
        assetId: 'AP-001-GOLDEN',
        name: 'Telecom Site AP-001',
        assetType: 'TELECOM_TOWER',
        description: 'Torre de telecomunicações 4G/5G com baterias LFP e gerador auxiliar.',
        currentState: 'OPERATIONAL',
        ownerContext: {
          operator: 'AcidHub Telco Infrastructure',
          responsibleTeam: 'Field Operations Southeast',
          criticalityTier: 'TIER_1',
        },
        knownAttributes: {
          heightMeters: 45,
          carriers: 'Claro, Vivo, TIM',
        },
        missingInformation: [
          'Laudo de conformidade acústico-ambiental do gerador diesel 2026',
        ],
      }),
    });

    expect(createRes.statusCode).toBe(201);
    const asset = JSON.parse(createRes.body);
    expect(asset.assetId).toBe('AP-001-GOLDEN');
    expect(asset.name).toBe('Telecom Site AP-001');

    // ----------------------------------------------------
    // STEP 4: Associate at least one source or evidence-backed observation
    // ----------------------------------------------------
    const obsRes = await handler({
      rawPath: '/api/assets/AP-001-GOLDEN/observations',
      headers: { 'X-Tenant-Id': tenantId },
      requestContext: {
        http: { method: 'POST', path: '/api/assets/AP-001-GOLDEN/observations' },
        authorizer: { jwt: { claims: authClaims } },
      },
      body: JSON.stringify({
        category: 'MAINTENANCE',
        summary: 'Alerta de degradação acelerada do banco de baterias de backup',
        details: 'Ciclo de descarga preventiva registrou queda súbita de tensão.',
        deltaDescription: 'Autonomia real caiu para apenas 42 minutos. Temperatura 48°C.',
        recordedBy: userEmail,
        evidenceRef: {
          documentId: 'doc-telemetry-2026-09-28',
          documentTitle: 'Log de Telemetria de Energia e Eventos #TEL-0928',
          admissibilityStatus: 'ADMISSIBLE',
          freshnessTimestamp: new Date().toISOString(),
          custodySource: 'KOS Evidence Platform',
          sha256: '9f83c6051a842e4822063e0237560f044cd0669e222a315ac0da10136a7c00f1',
        },
        attentionItem: {
          severity: 'CRITICAL',
          headline: 'Risco iminente de perda de contingência energética (SLA Tier 1 em risco)',
          candidateExplanation: 'Banco de baterias com apenas 42min de autonomia.',
          evidenceBasis: 'Log #TEL-0928',
          recommendedAction: 'Substituição preventiva do módulo de baterias',
        },
      }),
    });

    expect(obsRes.statusCode).toBe(201);
    const updatedAsset = JSON.parse(obsRes.body);
    expect(updatedAsset.observations.length).toBe(1);
    expect(updatedAsset.attentionItems.length).toBe(1);

    // ----------------------------------------------------
    // STEP 5 & 6: Chat-first interaction: "Me mostre o que sabemos sobre este ativo."
    // ----------------------------------------------------
    const chat1Res = await handler({
      rawPath: '/api/assets/AP-001-GOLDEN/chat',
      headers: { 'X-Tenant-Id': tenantId },
      requestContext: {
        http: { method: 'POST', path: '/api/assets/AP-001-GOLDEN/chat' },
        authorizer: { jwt: { claims: authClaims } },
      },
      body: JSON.stringify({ query: 'Me mostre o que sabemos sobre este ativo.' }),
    });

    expect(chat1Res.statusCode).toBe(200);
    const chat1Data = JSON.parse(chat1Res.body);
    expect(chat1Data.category).toBe('explanation');
    expect(chat1Data.candidateNotice).toBe(true);
    expect(chat1Data.answer).toContain('Telecom Site AP-001');
    expect(chat1Data.answer).toContain('O que mudou recentemente');
    expect(chat1Data.answer).toContain('Evidências que sustentam o estado');

    // ----------------------------------------------------
    // STEP 7: Show simple spatial/context panel
    // ----------------------------------------------------
    const spatialRes = await handler({
      rawPath: '/api/assets/AP-001-GOLDEN/spatial',
      headers: { 'X-Tenant-Id': tenantId },
      requestContext: {
        http: { method: 'POST', path: '/api/assets/AP-001-GOLDEN/spatial' },
        authorizer: { jwt: { claims: authClaims } },
      },
      body: JSON.stringify({
        latitude: -23.55052,
        longitude: -46.633308,
        elevationMeters: 760,
        address: 'Av. Paulista, 1000 - Bela Vista',
        municipality: 'São Paulo',
        stateOrRegion: 'SP',
        reconciliationStatus: 'ESTIMATED',
      }),
    });

    expect(spatialRes.statusCode).toBe(200);
    const spatialAsset = JSON.parse(spatialRes.body);
    expect(spatialAsset.spatial.latitude).toBe(-23.55052);
    expect(spatialAsset.spatial.disclaimer).toContain('SubjectIdentity != SpatialBinding');

    // ----------------------------------------------------
    // STEP 8: Show compact timeline
    // ----------------------------------------------------
    const timelineRes = await handler({
      rawPath: '/api/assets/AP-001-GOLDEN/timeline',
      headers: { 'X-Tenant-Id': tenantId },
      requestContext: {
        http: { method: 'GET', path: '/api/assets/AP-001-GOLDEN/timeline' },
        authorizer: { jwt: { claims: authClaims } },
      },
    });

    expect(timelineRes.statusCode).toBe(200);
    const timelineEvents = JSON.parse(timelineRes.body);
    expect(timelineEvents.length).toBeGreaterThanOrEqual(4);

    // ----------------------------------------------------
    // STEP 9: Show simple charts (Observability metrics)
    // ----------------------------------------------------
    const metricsRes = await handler({
      rawPath: '/api/observability',
      headers: { 'X-Tenant-Id': tenantId },
      requestContext: {
        http: { method: 'GET', path: '/api/observability' },
        authorizer: { jwt: { claims: authClaims } },
      },
    });

    expect(metricsRes.statusCode).toBe(200);
    const metrics = JSON.parse(metricsRes.body);
    expect(metrics.freshnessBreakdown).toBeDefined();
    expect(metrics.observationsByMonth).toBeDefined();
    expect(metrics.sourceCoverage).toBeDefined();

    // ----------------------------------------------------
    // STEP 10 & 11: User asks "O que merece atenção?" -> Candidate-only explanation
    // ----------------------------------------------------
    const chat2Res = await handler({
      rawPath: '/api/assets/AP-001-GOLDEN/chat',
      headers: { 'X-Tenant-Id': tenantId },
      requestContext: {
        http: { method: 'POST', path: '/api/assets/AP-001-GOLDEN/chat' },
        authorizer: { jwt: { claims: authClaims } },
      },
      body: JSON.stringify({ query: 'O que merece atenção?' }),
    });

    expect(chat2Res.statusCode).toBe(200);
    const chat2Data = JSON.parse(chat2Res.body);
    expect(chat2Data.category).toBe('attention');
    expect(chat2Data.candidateNotice).toBe(true);
    expect(chat2Data.answer).toContain('Risco iminente de perda de contingência energética');
    expect(chat2Data.answer).toContain('PROPOSIÇÃO CANDIDATA');

    // ----------------------------------------------------
    // STEP 12 & 13: Operational events persisted in DynamoDB
    // ----------------------------------------------------
    const finalTimelineRes = await handler({
      rawPath: '/api/assets/AP-001-GOLDEN/timeline',
      headers: { 'X-Tenant-Id': tenantId },
      requestContext: {
        http: { method: 'GET', path: '/api/assets/AP-001-GOLDEN/timeline' },
        authorizer: { jwt: { claims: authClaims } },
      },
    });

    const finalEvents = JSON.parse(finalTimelineRes.body);
    const eventTypes = finalEvents.map((e: any) => e.eventType);

    expect(eventTypes).toContain('ASSET_CREATED');
    expect(eventTypes).toContain('OBSERVATION_ADDED');
    expect(eventTypes).toContain('SOURCE_ASSOCIATED');
    expect(eventTypes).toContain('LOCATION_BOUND');
    expect(eventTypes).toContain('ATTENTION_RAISED');
    expect(eventTypes).toContain('CHAT_QUERY_RECORDED');
  });
});
