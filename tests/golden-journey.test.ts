import { describe, it, expect } from 'vitest';
import { handler } from '../src/api/handler';

describe('Comprehensive Authenticated Golden Journey: Telecom Site AP-001', () => {
  const tenantId = 'tenant-golden-journey-final';
  const userEmail = 'operator@acidhub.internal';

  const authClaims = {
    sub: 'cognito-user-ap001-uuid',
    email: userEmail,
    'custom:tenant_id': tenantId,
  };

  it('completes the comprehensive Golden Journey with all semantic questions, persistence, and safe failure', async () => {
    // ----------------------------------------------------
    // STEP 1: Cognito Login / Authenticated Context
    // ----------------------------------------------------
    expect(authClaims.email).toBe(userEmail);
    expect(authClaims['custom:tenant_id']).toBe(tenantId);

    // ----------------------------------------------------
    // STEP 2 & 3: Create / Open Asset with Identity & Attributes
    // ----------------------------------------------------
    const createRes = await handler({
      rawPath: '/api/assets',
      headers: { 'X-Tenant-Id': tenantId },
      requestContext: {
        http: { method: 'POST', path: '/api/assets' },
        authorizer: { jwt: { claims: authClaims } },
      },
      body: JSON.stringify({
        assetId: 'AP-001-ACCEPTED',
        name: 'Telecom Site AP-001',
        assetType: 'TELECOM_TOWER',
        description: 'Torre de telecomunicações de transmissão e retransmissão celular 4G/5G com abrigo de baterias LFP e gerador auxiliar.',
        currentState: 'OPERATIONAL',
        ownerContext: {
          operator: 'AcidHub Telco Infrastructure',
          responsibleTeam: 'Field Operations Southeast / Critical Infrastructure',
          criticalityTier: 'TIER_1',
          contactEmail: 'ops.southeast@acidhub.internal',
        },
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
      }),
    });

    expect(createRes.statusCode).toBe(201);
    const asset = JSON.parse(createRes.body);
    expect(asset.assetId).toBe('AP-001-ACCEPTED');
    expect(asset.name).toBe('Telecom Site AP-001');

    // Bind spatial location
    await handler({
      rawPath: '/api/assets/AP-001-ACCEPTED/spatial',
      headers: { 'X-Tenant-Id': tenantId },
      requestContext: {
        http: { method: 'POST', path: '/api/assets/AP-001-ACCEPTED/spatial' },
        authorizer: { jwt: { claims: authClaims } },
      },
      body: JSON.stringify({
        latitude: -23.55052,
        longitude: -46.633308,
        elevationMeters: 760,
        address: 'Av. Paulista, 1000 - Bela Vista',
        municipality: 'São Paulo',
        stateOrRegion: 'SP',
        spatialPrecisionMeters: 5,
        reconciliationStatus: 'ESTIMATED',
      }),
    });

    // ----------------------------------------------------
    // STEP 4: Ask "WHAT DO WE KNOW?"
    // ----------------------------------------------------
    const whatDoWeKnowRes = await handler({
      rawPath: '/api/assets/AP-001-ACCEPTED/chat',
      headers: { 'X-Tenant-Id': tenantId },
      requestContext: {
        http: { method: 'POST', path: '/api/assets/AP-001-ACCEPTED/chat' },
        authorizer: { jwt: { claims: authClaims } },
      },
      body: JSON.stringify({ query: 'Me mostre o que sabemos sobre este ativo.' }),
    });
    expect(whatDoWeKnowRes.statusCode).toBe(200);
    const knowData = JSON.parse(whatDoWeKnowRes.body);
    expect(knowData.answer).toContain('Telecom Site AP-001');
    expect(knowData.candidateNotice).toBe(true);

    // ----------------------------------------------------
    // STEP 5: Ask LOCATION / PRECISION
    // ----------------------------------------------------
    const spatialChatRes = await handler({
      rawPath: '/api/assets/AP-001-ACCEPTED/chat',
      headers: { 'X-Tenant-Id': tenantId },
      requestContext: {
        http: { method: 'POST', path: '/api/assets/AP-001-ACCEPTED/chat' },
        authorizer: { jwt: { claims: authClaims } },
      },
      body: JSON.stringify({ query: 'Where is the asset located and what is the spatial precision?' }),
    });
    expect(spatialChatRes.statusCode).toBe(200);
    const spatialChatData = JSON.parse(spatialChatRes.body);
    expect(spatialChatData.intent).toBe('SPATIAL_LOCATION_AND_PRECISION');
    expect(spatialChatData.answer).toContain('-23.55052');
    expect(spatialChatData.answer).toContain('± 5 metros');
    expect(spatialChatData.answer).toContain('SubjectIdentity != SpatialBinding');

    // ----------------------------------------------------
    // STEP 6: Register NEW OBSERVATION with source and attention
    // ----------------------------------------------------
    const obsRes = await handler({
      rawPath: '/api/assets/AP-001-ACCEPTED/observations',
      headers: { 'X-Tenant-Id': tenantId },
      requestContext: {
        http: { method: 'POST', path: '/api/assets/AP-001-ACCEPTED/observations' },
        authorizer: { jwt: { claims: authClaims } },
      },
      body: JSON.stringify({
        category: 'MAINTENANCE',
        summary: 'Alerta de degradação acelerada do banco de baterias de backup e falha no teste de partida do gerador.',
        details: 'Ciclo de descarga preventiva registrou queda súbita de tensão na terceira string e gerador não acoplou carga.',
        deltaDescription: 'Autonomia real caiu de 8h nominais para apenas 42 minutos. Temperatura interna da sala atingiu 48°C.',
        recordedBy: userEmail,
        evidenceRef: {
          documentId: 'doc-telemetry-2026-09-28',
          documentTitle: 'Log de Telemetria de Energia e Eventos de Contingência #TEL-0928',
          fragmentId: 'frag-tel-0928-battery-string',
          sha256: '9f83c6051a842e4822063e0237560f044cd0669e222a315ac0da10136a7c00f1',
          admissibilityStatus: 'ADMISSIBLE',
          freshnessTimestamp: '2026-09-28T09:15:00.000Z',
          custodySource: 'GOLDEN_FIXTURE (Local Adapter Baseline)',
          provenanceType: 'GOLDEN_FIXTURE',
        },
        attentionItem: {
          severity: 'CRITICAL',
          headline: 'Risco iminente de perda de contingência energética (SLA Tier 1 em risco)',
          candidateExplanation: 'O banco de baterias opera com apenas 42 minutos de autonomia com aquecimento a 48°C, somado à falha do gerador.',
          evidenceBasis: 'Evidência Governada #TEL-0928',
          recommendedAction: 'Despacho emergencial de equipe técnica para troca do módulo de baterias',
        },
      }),
    });
    expect(obsRes.statusCode).toBe(201);

    // ----------------------------------------------------
    // STEP 7: Ask WHAT CHANGED
    // ----------------------------------------------------
    const changesChatRes = await handler({
      rawPath: '/api/assets/AP-001-ACCEPTED/chat',
      headers: { 'X-Tenant-Id': tenantId },
      requestContext: {
        http: { method: 'POST', path: '/api/assets/AP-001-ACCEPTED/chat' },
        authorizer: { jwt: { claims: authClaims } },
      },
      body: JSON.stringify({ query: 'What changed recently?' }),
    });
    expect(changesChatRes.statusCode).toBe(200);
    const changesChatData = JSON.parse(changesChatRes.body);
    expect(changesChatData.intent).toBe('RECENT_CHANGES');
    expect(changesChatData.answer).toContain('Autonomia real caiu');
    expect(changesChatData.answer).toContain('42 minutos');

    // ----------------------------------------------------
    // STEP 8: Ask SUPPORTING EVIDENCE
    // ----------------------------------------------------
    const evidenceChatRes = await handler({
      rawPath: '/api/assets/AP-001-ACCEPTED/chat',
      headers: { 'X-Tenant-Id': tenantId },
      requestContext: {
        http: { method: 'POST', path: '/api/assets/AP-001-ACCEPTED/chat' },
        authorizer: { jwt: { claims: authClaims } },
      },
      body: JSON.stringify({ query: 'Quais as evidências que sustentam o estado?' }),
    });
    expect(evidenceChatRes.statusCode).toBe(200);
    const evData = JSON.parse(evidenceChatRes.body);
    expect(evData.intent).toBe('SUPPORTING_EVIDENCE');
    expect(evData.answer).toContain('#TEL-0928');
    expect(evData.answer).toContain('Documento ≠ Evidência');

    // ----------------------------------------------------
    // STEP 9: Ask WHAT IS MISSING
    // ----------------------------------------------------
    const missingChatRes = await handler({
      rawPath: '/api/assets/AP-001-ACCEPTED/chat',
      headers: { 'X-Tenant-Id': tenantId },
      requestContext: {
        http: { method: 'POST', path: '/api/assets/AP-001-ACCEPTED/chat' },
        authorizer: { jwt: { claims: authClaims } },
      },
      body: JSON.stringify({ query: 'O que está faltando?' }),
    });
    expect(missingChatRes.statusCode).toBe(200);
    const missingData = JSON.parse(missingChatRes.body);
    expect(missingData.intent).toBe('MISSING_INFORMATION');
    expect(missingData.answer).toContain('retificador primário');
    expect(missingData.answer).toContain('Informação Ausente ≠ Falso');

    // ----------------------------------------------------
    // STEP 10: Ask WHAT DESERVES ATTENTION
    // ----------------------------------------------------
    const attentionChatRes = await handler({
      rawPath: '/api/assets/AP-001-ACCEPTED/chat',
      headers: { 'X-Tenant-Id': tenantId },
      requestContext: {
        http: { method: 'POST', path: '/api/assets/AP-001-ACCEPTED/chat' },
        authorizer: { jwt: { claims: authClaims } },
      },
      body: JSON.stringify({ query: 'O que merece atenção?' }),
    });
    expect(attentionChatRes.statusCode).toBe(200);
    const attentionData = JSON.parse(attentionChatRes.body);
    expect(attentionData.intent).toBe('ATTENTION_ITEMS');
    expect(attentionData.answer).toContain('CRITICAL');
    expect(attentionData.answer).toContain('contingência energética');
    expect(attentionData.answer).toContain('PROPOSIÇÃO CANDIDATA');

    // ----------------------------------------------------
    // STEP 11: Timeline reflects all events
    // ----------------------------------------------------
    const timelineRes = await handler({
      rawPath: '/api/assets/AP-001-ACCEPTED/timeline',
      headers: { 'X-Tenant-Id': tenantId },
      requestContext: {
        http: { method: 'GET', path: '/api/assets/AP-001-ACCEPTED/timeline' },
        authorizer: { jwt: { claims: authClaims } },
      },
    });
    expect(timelineRes.statusCode).toBe(200);
    const timeline = JSON.parse(timelineRes.body);
    const types = timeline.map((e: any) => e.eventType);
    expect(types).toContain('ASSET_CREATED');
    expect(types).toContain('LOCATION_BOUND');
    expect(types).toContain('OBSERVATION_ADDED');
    expect(types).toContain('SOURCE_ASSOCIATED');
    expect(types).toContain('CHANGE_DETECTED');
    expect(types).toContain('ATTENTION_RAISED');
    expect(types).toContain('CHAT_QUERY_RECORDED');

    // ----------------------------------------------------
    // STEP 12: Reload / State Remains
    // ----------------------------------------------------
    const reloadRes = await handler({
      rawPath: '/api/assets/AP-001-ACCEPTED',
      headers: { 'X-Tenant-Id': tenantId },
      requestContext: {
        http: { method: 'GET', path: '/api/assets/AP-001-ACCEPTED' },
        authorizer: { jwt: { claims: authClaims } },
      },
    });
    expect(reloadRes.statusCode).toBe(200);
    const reloaded = JSON.parse(reloadRes.body);
    expect(reloaded.assetId).toBe('AP-001-ACCEPTED');
    expect(reloaded.observations.length).toBeGreaterThan(0);
    expect(reloaded.currentState).toBe('MAINTENANCE_REQUIRED');

    // ----------------------------------------------------
    // STEP 13: OUT-OF-CONTEXT QUESTION FAILS SAFELY
    // ----------------------------------------------------
    const oocRes = await handler({
      rawPath: '/api/assets/AP-001-ACCEPTED/chat',
      headers: { 'X-Tenant-Id': tenantId },
      requestContext: {
        http: { method: 'POST', path: '/api/assets/AP-001-ACCEPTED/chat' },
        authorizer: { jwt: { claims: authClaims } },
      },
      body: JSON.stringify({ query: 'What will the dollar exchange rate be tomorrow?' }),
    });
    expect(oocRes.statusCode).toBe(200);
    const oocData = JSON.parse(oocRes.body);
    expect(oocData.intent).toBe('OUT_OF_CONTEXT');
    expect(oocData.category).toBe('out_of_context');
    expect(oocData.answer).toContain('Consulta Fora do Escopo');
    expect(oocData.answer).toContain('não está estabelecida no contexto deste Asset Passport');
  });
});
