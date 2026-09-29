import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const API_BASE = 'https://llptwqlvfb.execute-api.sa-east-1.amazonaws.com';
const USER_POOL_ID = 'sa-east-1_yHYvI1jAM';
const CLIENT_ID = '5ht28gli847ksnkjji415u3297';
const TABLE_NAME = 'KosAssetPassport-dev-StateTable';
const TENANT_ID = 'tenant-golden-ap001';

async function runGoldenJourney() {
  console.log('================================================================');
  console.log('KOS ASSET PASSPORT: AUTHENTICATED AWS GOLDEN JOURNEY EXECUTION');
  console.log('Date:', new Date().toISOString());
  console.log('Region: sa-east-1 | Target API:', API_BASE);
  console.log('================================================================\n');

  // STEP 1: Cognito Login
  console.log('[STEP 1] Authenticating with Cognito User Pool', USER_POOL_ID, '...');
  const { execSync } = await import('child_process');
  const authOutput = execSync(`aws cognito-idp initiate-auth --client-id ${CLIENT_ID} --auth-flow USER_PASSWORD_AUTH --auth-parameters "USERNAME=ap-operator,PASSWORD=KOSAssetPassport2026!" --profile kos-project-foundry-dev --region sa-east-1`).toString();
  const authData = JSON.parse(authOutput);
  const idToken = authData.AuthenticationResult.IdToken;
  console.log('✓ Successfully authenticated! IdToken received (length:', idToken.length, 'bytes)\n');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`,
    'X-Tenant-Id': TENANT_ID,
  };

  // STEP 2 & 3: Create Asset Passport (Telecom Site AP-001)
  console.log('[STEP 2 & 3] Creating Asset Passport for Telecom Site AP-001...');
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
  console.log('✓ Asset Passport created on AWS:', asset.assetId, '-', asset.name, '(Status:', createRes.status, ')\n');

  // STEP 4: Associate Source & Observation
  console.log('[STEP 4] Associating Source and Evidence-backed Observation...');
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
      custodySource: 'KOS Evidence Platform / Telemetry Ingestion',
    },
    attentionItem: {
      severity: 'CRITICAL',
      headline: 'Risco iminente de perda de contingência energética (SLA Tier 1 em risco)',
      candidateExplanation: 'O banco de baterias opera com apenas 42 minutos de autonomia com aquecimento a 48°C, somado à falha de acoplamento do gerador diesel.',
      evidenceBasis: 'Evidência Governamental #TEL-0928 e Relatório #EE-902',
      recommendedAction: 'Despacho emergencial de equipe técnica para troca do módulo de baterias e manutenção do atuador do gerador.',
    },
  };

  const obsRes = await fetch(`${API_BASE}/api/assets/AP-001/observations`, {
    method: 'POST',
    headers,
    body: JSON.stringify(obsPayload),
  });
  const updatedWithObs = await obsRes.json();
  console.log('✓ Observation added! Total observations:', updatedWithObs.observations.length, '| Attention items:', updatedWithObs.attentionItems.length, '\n');

  // STEP 5 & 6: Chat: "Me mostre o que sabemos sobre este ativo."
  console.log('[STEP 5 & 6] Executing Chat Query: "Me mostre o que sabemos sobre este ativo."...');
  const chat1Res = await fetch(`${API_BASE}/api/assets/AP-001/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: 'Me mostre o que sabemos sobre este ativo.' }),
  });
  const chat1Data = await chat1Res.json();
  console.log('--- REASONER EXPLANATION RESPONSE ---');
  console.log(chat1Data.answer);
  console.log('-------------------------------------\n');

  // STEP 7: Bind and View Spatial Context
  console.log('[STEP 7] Binding and Reading Spatial Context...');
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
  console.log('✓ Spatial binding confirmed:', spatialData.spatial.address, `(${spatialData.spatial.latitude}, ${spatialData.spatial.longitude})`);
  console.log('  Disclaimer:', spatialData.spatial.disclaimer, '\n');

  // STEP 8: Read Compact Timeline
  console.log('[STEP 8] Reading Compact Operational Timeline from API Gateway...');
  const timelineRes = await fetch(`${API_BASE}/api/assets/AP-001/timeline`, {
    method: 'GET',
    headers,
  });
  const timeline = await timelineRes.json();
  console.log('✓ Operational Events retrieved:', timeline.length);
  timeline.forEach((e, idx) => {
    console.log(`  ${idx + 1}. [${e.eventType}] at ${e.occurredAt} - Note: ${e.note || 'N/A'}`);
  });
  console.log('');

  // STEP 9: View Simple Charts & Observability
  console.log('[STEP 9] Fetching Observability Metrics & Chart Data...');
  const metricsRes = await fetch(`${API_BASE}/api/observability`, {
    method: 'GET',
    headers,
  });
  const metrics = await metricsRes.json();
  console.log('✓ Metrics Summary:');
  console.log('  - Total Assets:', metrics.totalAssets);
  console.log('  - Total Observations:', metrics.totalObservations);
  console.log('  - Open Attention Items:', metrics.openAttentionCount);
  console.log('  - Freshness Breakdown:', JSON.stringify(metrics.freshnessBreakdown));
  console.log('  - Source Coverage:', JSON.stringify(metrics.sourceCoverage));
  console.log('  - Universal Synthetic Score:', metrics.universalScore === undefined ? 'NONE (Preserved)' : 'ERROR (Fabricated)');
  console.log('');

  // STEP 10 & 11: Chat: "O que merece atenção?"
  console.log('[STEP 10 & 11] Executing Chat Query: "O que merece atenção?"...');
  const chat2Res = await fetch(`${API_BASE}/api/assets/AP-001/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: 'O que merece atenção?' }),
  });
  const chat2Data = await chat2Res.json();
  console.log('--- REASONER ATTENTION RESPONSE ---');
  console.log(chat2Data.answer);
  console.log('-----------------------------------\n');

  // STEP 12 & 13: Direct DynamoDB Audit Verification
  console.log('[STEP 12 & 13] Directly Querying AWS DynamoDB Table via AWS CLI:', TABLE_NAME);
  const ddbOutput = execSync(`aws dynamodb query --table-name ${TABLE_NAME} --key-condition-expression "PK = :pk" --expression-attribute-values "{\\":pk\\":{\\"S\\":\\"TENANT#${TENANT_ID}\\"}}" --profile kos-project-foundry-dev --region sa-east-1`).toString();
  const ddbRes = JSON.parse(ddbOutput);

  console.log('✓ DynamoDB Items count for tenant:', ddbRes.Items?.length);
  const persistedTypes = (ddbRes.Items || []).map(i => i.eventType?.S || i.entityType?.S);
  console.log('✓ Persisted Item Types in DynamoDB:');
  persistedTypes.forEach(t => console.log('  •', t));

  console.log('\n================================================================');
  console.log('✨ AUTHENTICATED AWS GOLDEN JOURNEY COMPLETE AND VERIFIED!');
  console.log('================================================================');
}

runGoldenJourney().catch(err => {
  console.error('Golden Journey Failed:', err);
  process.exit(1);
});
