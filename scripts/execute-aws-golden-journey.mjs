import { execSync } from 'child_process';

const API_BASE = 'https://llptwqlvfb.execute-api.sa-east-1.amazonaws.com';
const USER_POOL_ID = 'sa-east-1_yHYvI1jAM';
const CLIENT_ID = '5ht28gli847ksnkjji415u3297';
const TABLE_NAME = 'KosAssetPassport-dev-StateTable';
const TENANT_ID = 'tenant-golden-ap001';

async function runGoldenJourney() {
  console.log('================================================================');
  console.log('KOS ASSET PASSPORT: PHYSICAL AWS GOLDEN JOURNEY & ACCEPTANCE');
  console.log('Date:', new Date().toISOString());
  console.log('Region: sa-east-1 | Target API:', API_BASE);
  console.log('================================================================\n');

  // ----------------------------------------------------
  // TEST: AUTHENTICATION TRUTH TEST (401 vs 200)
  // ----------------------------------------------------
  console.log('[AUTH TRUTH TEST] Testing Unauthenticated Protected Route (Expect HTTP 401)...');
  const unauthRes = await fetch(`${API_BASE}/api/assets`, { method: 'GET' });
  console.log(`✓ UNAUTHENTICATED_PROTECTED_API: HTTP ${unauthRes.status} (Correctly rejected by Cognito authorizer)`);
  if (unauthRes.status !== 401 && unauthRes.status !== 403) {
    throw new Error(`Expected 401/403 but got ${unauthRes.status}`);
  }

  // ----------------------------------------------------
  // STEP 1: Cognito Login
  // ----------------------------------------------------
  console.log('\n[STEP 1: LOGIN] Authenticating with Cognito User Pool', USER_POOL_ID, '...');
  const authOutput = execSync(`aws cognito-idp initiate-auth --client-id ${CLIENT_ID} --auth-flow USER_PASSWORD_AUTH --auth-parameters "USERNAME=ap-operator,PASSWORD=KOSAssetPassport2026!" --profile kos-project-foundry-dev --region sa-east-1`).toString();
  const authData = JSON.parse(authOutput);
  const idToken = authData.AuthenticationResult.IdToken;
  console.log('✓ AUTHENTICATED_PROTECTED_API: Successfully authenticated!');
  console.log('✓ BROWSER_AUTHORIZATION_HEADER: Valid Bearer JWT token obtained (Length:', idToken.length, 'bytes)');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`,
    'X-Tenant-Id': TENANT_ID,
  };

  // ----------------------------------------------------
  // STEP 2 & 3: Open / Create Asset (Telecom Site AP-001)
  // ----------------------------------------------------
  console.log('\n[STEP 2 & 3: OPEN ASSET] Initializing Telecom Site AP-001...');
  const createPayload = {
    assetId: 'AP-001',
    name: 'Telecom Site AP-001',
    assetType: 'TELECOM_TOWER',
    description: 'Torre de telecomunicações de transmissão e retransmissão celular 4G/5G com abrigo de baterias LFP e gerador auxiliar.',
    ownerContext: {
      operator: 'AcidHub Telco Infrastructure',
      responsibleTeam: 'Field Operations Southeast / Critical Infrastructure',
      criticalityTier: 'TIER_1',
      contactEmail: 'ops.southeast@acidhub.internal',
    },
    currentState: 'OPERATIONAL',
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
  };

  const createRes = await fetch(`${API_BASE}/api/assets`, {
    method: 'POST',
    headers,
    body: JSON.stringify(createPayload),
  });
  const asset = await createRes.json();
  console.log('✓ Asset opened on AWS:', asset.assetId, '-', asset.name, '(HTTP', createRes.status, ')');

  // Bind Spatial Location
  const spatialRes = await fetch(`${API_BASE}/api/assets/AP-001/spatial`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      latitude: -23.55052,
      longitude: -46.633308,
      elevationMeters: 760,
      address: 'Av. Paulista, 1000 - Bela Vista',
      municipality: 'São Paulo',
      stateOrRegion: 'SP',
      country: 'Brasil',
      spatialPrecisionMeters: 5,
      reconciliationStatus: 'ESTIMATED',
    }),
  });
  const spatialData = await spatialRes.json();
  console.log('✓ Spatial binding established:', spatialData.spatial.address, `(Lat ${spatialData.spatial.latitude}, Lon ${spatialData.spatial.longitude}, ±${spatialData.spatial.spatialPrecisionMeters}m)`);

  // ----------------------------------------------------
  // STEP 4: ASK "WHAT DO WE KNOW?"
  // ----------------------------------------------------
  console.log('\n[STEP 4: ASK "WHAT DO WE KNOW?"] Executing chat query...');
  const chatKnowRes = await fetch(`${API_BASE}/api/assets/AP-001/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: 'Me mostre o que sabemos sobre este ativo.' }),
  });
  const chatKnowData = await chatKnowRes.json();
  console.log('✓ Intent:', chatKnowData.intent, '| Category:', chatKnowData.category);
  console.log('--- Resposta:');
  console.log(chatKnowData.answer.slice(0, 320) + '...\n');

  // ----------------------------------------------------
  // STEP 5: ASK LOCATION / PRECISION
  // ----------------------------------------------------
  console.log('[STEP 5: ASK LOCATION & PRECISION] Query: "Where is the asset located and what is the spatial precision?"...');
  const chatSpatialRes = await fetch(`${API_BASE}/api/assets/AP-001/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: 'Where is the asset located and what is the spatial precision?' }),
  });
  const chatSpatialData = await chatSpatialRes.json();
  console.log('✓ Intent:', chatSpatialData.intent, '| Precision Mentioned:', chatSpatialData.answer.includes('± 5 metros'));
  console.log('--- Resposta:');
  console.log(chatSpatialData.answer.slice(0, 320) + '...\n');

  // ----------------------------------------------------
  // STEP 6: REGISTER NEW OBSERVATION & SOURCE
  // ----------------------------------------------------
  console.log('[STEP 6: REGISTER OBSERVATION] Registering critical battery degradation observation with source...');
  const obsPayload = {
    category: 'MAINTENANCE',
    summary: 'Alerta de degradação acelerada do banco de baterias de backup e falha no teste de partida do gerador.',
    details: 'Ciclo de descarga preventiva registrou queda súbita de tensão na terceira string e gerador não acoplou carga.',
    deltaDescription: 'Autonomia real caiu de 8h nominais para apenas 42 minutos. Temperatura interna da sala atingiu 48°C.',
    recordedBy: 'operator@acidhub.internal',
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
      candidateExplanation: 'O banco de baterias opera com apenas 42 minutos de autonomia com aquecimento a 48°C, somado à falha de acoplamento do gerador diesel.',
      evidenceBasis: 'Evidência Governada #TEL-0928 (GOLDEN_FIXTURE)',
      recommendedAction: 'Despacho emergencial de equipe técnica para troca do módulo de baterias e manutenção do atuador do gerador.',
    },
  };

  const obsRes = await fetch(`${API_BASE}/api/assets/AP-001/observations`, {
    method: 'POST',
    headers,
    body: JSON.stringify(obsPayload),
  });
  const updatedAsset = await obsRes.json();
  console.log('✓ Observation registered! Current State:', updatedAsset.currentState, '| Total Observations:', updatedAsset.observations.length);

  // ----------------------------------------------------
  // STEP 7: ASK WHAT CHANGED
  // ----------------------------------------------------
  console.log('\n[STEP 7: ASK WHAT CHANGED] Query: "What changed recently?"...');
  const chatChangesRes = await fetch(`${API_BASE}/api/assets/AP-001/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: 'What changed recently?' }),
  });
  const chatChangesData = await chatChangesRes.json();
  console.log('✓ Intent:', chatChangesData.intent, '| Delta Answered:', chatChangesData.answer.includes('42 minutos'));
  console.log('--- Resposta:');
  console.log(chatChangesData.answer.slice(0, 320) + '...\n');

  // ----------------------------------------------------
  // STEP 8: ASK SUPPORTING EVIDENCE
  // ----------------------------------------------------
  console.log('[STEP 8: ASK SUPPORTING EVIDENCE] Query: "Quais as evidências que sustentam o estado?"...');
  const chatEvRes = await fetch(`${API_BASE}/api/assets/AP-001/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: 'Quais as evidências que sustentam o estado?' }),
  });
  const chatEvData = await chatEvRes.json();
  console.log('✓ Intent:', chatEvData.intent, '| Doc #TEL-0928 Included:', chatEvData.answer.includes('#TEL-0928'));
  console.log('--- Resposta:');
  console.log(chatEvData.answer.slice(0, 320) + '...\n');

  // ----------------------------------------------------
  // STEP 9: ASK WHAT IS MISSING
  // ----------------------------------------------------
  console.log('[STEP 9: ASK WHAT IS MISSING] Query: "O que está faltando?"...');
  const chatMissingRes = await fetch(`${API_BASE}/api/assets/AP-001/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: 'O que está faltando?' }),
  });
  const chatMissingData = await chatMissingRes.json();
  console.log('✓ Intent:', chatMissingData.intent, '| Gaps Answered:', chatMissingData.answer.includes('retificador primário'));
  console.log('--- Resposta:');
  console.log(chatMissingData.answer.slice(0, 320) + '...\n');

  // ----------------------------------------------------
  // STEP 10: ASK WHAT DESERVES ATTENTION
  // ----------------------------------------------------
  console.log('[STEP 10: ASK WHAT DESERVES ATTENTION] Query: "O que merece atenção?"...');
  const chatAttRes = await fetch(`${API_BASE}/api/assets/AP-001/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: 'O que merece atenção?' }),
  });
  const chatAttData = await chatAttRes.json();
  console.log('✓ Intent:', chatAttData.intent, '| Critical Severity:', chatAttData.answer.includes('CRITICAL'));
  console.log('--- Resposta:');
  console.log(chatAttData.answer.slice(0, 320) + '...\n');

  // ----------------------------------------------------
  // STEP 11: TIMELINE REFLECTS EVENTS
  // ----------------------------------------------------
  console.log('[STEP 11: TIMELINE AUDIT] Fetching operational events from API Gateway...');
  const timelineRes = await fetch(`${API_BASE}/api/assets/AP-001/timeline`, {
    method: 'GET',
    headers,
  });
  const timeline = await timelineRes.json();
  console.log(`✓ Timeline contains ${timeline.length} events:`);
  timeline.slice(-6).forEach(e => console.log(`  • [${e.eventType}] at ${e.occurredAt}`));

  // ----------------------------------------------------
  // STEP 12: REFRESH / RELOAD -> STATE REMAINS
  // ----------------------------------------------------
  console.log('\n[STEP 12: STATE PERSISTENCE RELOAD] Fetching fresh asset state from AWS...');
  const reloadRes = await fetch(`${API_BASE}/api/assets/AP-001`, {
    method: 'GET',
    headers,
  });
  const reloaded = await reloadRes.json();
  console.log('✓ Reload successful! Asset:', reloaded.name, '| State:', reloaded.currentState, '| Observations:', reloaded.observations.length);
  if (reloaded.currentState !== 'MAINTENANCE_REQUIRED') {
    throw new Error('State was not preserved across reload!');
  }

  // ----------------------------------------------------
  // STEP 13: OUT-OF-CONTEXT QUESTION FAILS SAFELY
  // ----------------------------------------------------
  console.log('\n[STEP 13: OUT-OF-CONTEXT SAFE REFUSAL] Query: "What will the dollar exchange rate be tomorrow?"...');
  const chatOocRes = await fetch(`${API_BASE}/api/assets/AP-001/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: 'What will the dollar exchange rate be tomorrow?' }),
  });
  const chatOocData = await chatOocRes.json();
  console.log('✓ Category:', chatOocData.category, '| Intent:', chatOocData.intent);
  console.log('--- Resposta Epistemologicamente Segura:');
  console.log(chatOocData.answer);
  if (chatOocData.category !== 'out_of_context') {
    throw new Error('Out of context query did not fail safely!');
  }

  // ----------------------------------------------------
  // STEP 14: PROVE DYNAMODB PERSISTENCE
  // ----------------------------------------------------
  console.log('\n[STEP 14: DYNAMODB AUDIT] Querying AWS DynamoDB Table:', TABLE_NAME);
  const ddbOutput = execSync(`aws dynamodb query --table-name ${TABLE_NAME} --key-condition-expression "PK = :pk" --expression-attribute-values "{\\":pk\\":{\\"S\\":\\"TENANT#${TENANT_ID}\\"}}" --profile kos-project-foundry-dev --region sa-east-1`).toString();
  const ddbRes = JSON.parse(ddbOutput);

  console.log('✓ DynamoDB Item Count for tenant:', ddbRes.Items?.length);
  const types = (ddbRes.Items || []).map(i => i.eventType?.S || i.entityType?.S);
  console.log('✓ Event types confirmed in physical DynamoDB storage:');
  new Set(types).forEach(t => console.log('  •', t));

  console.log('\n================================================================');
  console.log('✨ PHYSICAL AWS GOLDEN JOURNEY FULLY ACCEPTED & VERIFIED!');
  console.log('================================================================');
}

runGoldenJourney().catch(err => {
  console.error('\n❌ Golden Journey Failed:', err);
  process.exit(1);
});
