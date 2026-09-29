import { DynamoService } from '../core/dynamo-service';
import { AssetReasoner } from '../core/reasoning';
import { EvidenceAdapter } from '../adapters/evidence-adapter';
import { AssetPassport, Observation, SpatialBinding, ProductEvent } from '../types';

const dynamo = new DynamoService();
const reasoner = new AssetReasoner();
const evidence = new EvidenceAdapter();

interface APIGatewayEvent {
  rawPath?: string;
  path?: string;
  requestContext?: {
    http?: {
      method?: string;
      path?: string;
    };
    authorizer?: {
      jwt?: {
        claims?: Record<string, string>;
      };
    };
  };
  httpMethod?: string;
  headers?: Record<string, string>;
  body?: string;
}

function getCorsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With,X-Tenant-Id',
  };
}

export async function handler(event: APIGatewayEvent) {
  const method = (event.requestContext?.http?.method || event.httpMethod || 'GET').toUpperCase();
  const rawPath = event.rawPath || event.path || '/';

  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({ ok: true }),
    };
  }

  // Health check route (unauthenticated)
  if (rawPath === '/health' || rawPath === '/api/health') {
    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        status: 'HEALTHY',
        service: 'kos-asset-passport',
        timestamp: new Date().toISOString(),
        region: process.env.AWS_REGION || 'sa-east-1',
        dynamoConnected: dynamo.isAvailable(),
        evidenceAvailable: evidence.isAvailable(),
      }),
    };
  }

  // Tenant extraction from JWT claims or header or fallback
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  const headerTenant = event.headers?.['x-tenant-id'] || event.headers?.['X-Tenant-Id'];
  const tenantId = claims?.['custom:tenant_id'] || headerTenant || 'tenant-default';

  try {
    // 1. GET /api/assets
    if (method === 'GET' && (rawPath === '/api/assets' || rawPath === '/assets')) {
      const assets = await dynamo.listAssets(tenantId);
      return {
        statusCode: 200,
        headers: getCorsHeaders(),
        body: JSON.stringify(assets),
      };
    }

    // 2. POST /api/assets
    if (method === 'POST' && (rawPath === '/api/assets' || rawPath === '/assets')) {
      const payload = event.body ? JSON.parse(event.body) : {};
      if (!payload.name || !payload.assetType) {
        return {
          statusCode: 400,
          headers: getCorsHeaders(),
          body: JSON.stringify({ error: 'Missing required fields: name, assetType' }),
        };
      }

      const assetId = payload.assetId || `asset-${Date.now().toString(36)}`;
      const now = new Date().toISOString();
      const newAsset: AssetPassport = {
        assetId,
        tenantId,
        name: payload.name,
        assetType: payload.assetType,
        description: payload.description || '',
        ownerContext: payload.ownerContext || {
          operator: 'AcidHub Operations',
          responsibleTeam: 'Infrastructure Core',
          criticalityTier: 'TIER_2',
        },
        currentState: payload.currentState || 'COMMISSIONING',
        knownAttributes: payload.knownAttributes || {},
        missingInformation: payload.missingInformation || [],
        spatial: payload.spatial,
        observations: [],
        attentionItems: [],
        createdAt: now,
        updatedAt: now,
      };

      const saved = await dynamo.saveAsset(newAsset);

      // Persist ASSET_CREATED operational event
      await dynamo.recordEvent({
        eventId: `evt-${Date.now()}-created`,
        tenantId,
        assetId,
        eventType: 'ASSET_CREATED',
        payload: { name: newAsset.name, assetType: newAsset.assetType },
        occurredAt: now,
      });

      return {
        statusCode: 201,
        headers: getCorsHeaders(),
        body: JSON.stringify(saved),
      };
    }

    // Check parameterized paths: /api/assets/{assetId}/...
    const assetPathMatch = rawPath.match(/^\/(?:api\/)?assets\/([^/]+)(?:\/(.*))?$/);
    if (assetPathMatch) {
      const assetId = decodeURIComponent(assetPathMatch[1]);
      const subAction = assetPathMatch[2] || '';

      // GET /api/assets/{assetId}
      if (method === 'GET' && !subAction) {
        const asset = await dynamo.getAsset(tenantId, assetId);
        if (!asset) {
          return {
            statusCode: 404,
            headers: getCorsHeaders(),
            body: JSON.stringify({ error: `Asset not found: ${assetId}` }),
          };
        }
        return {
          statusCode: 200,
          headers: getCorsHeaders(),
          body: JSON.stringify(asset),
        };
      }

      // POST /api/assets/{assetId}/observations
      if (method === 'POST' && subAction === 'observations') {
        const asset = await dynamo.getAsset(tenantId, assetId);
        if (!asset) {
          return {
            statusCode: 404,
            headers: getCorsHeaders(),
            body: JSON.stringify({ error: `Asset not found: ${assetId}` }),
          };
        }

        const body = event.body ? JSON.parse(event.body) : {};
        const obsId = `obs-${Date.now().toString(36)}`;
        const now = new Date().toISOString();

        const newObs: Observation = {
          observationId: obsId,
          assetId,
          tenantId,
          observedAt: body.observedAt || now,
          category: body.category || 'MAINTENANCE',
          summary: body.summary || 'Nova observação registrada',
          details: body.details || '',
          deltaDescription: body.deltaDescription,
          recordedBy: body.recordedBy || claims?.email || 'Authenticated User',
          evidenceRef: body.evidenceRef,
        };

        asset.observations.push(newObs);

        // Record OBSERVATION_ADDED event
        await dynamo.recordEvent({
          eventId: `evt-${Date.now()}-obs`,
          tenantId,
          assetId,
          eventType: 'OBSERVATION_ADDED',
          payload: { observationId: obsId, category: newObs.category, summary: newObs.summary },
          occurredAt: now,
        });

        // If source/evidence document associated
        if (newObs.evidenceRef?.documentId) {
          await dynamo.recordEvent({
            eventId: `evt-${Date.now()}-src`,
            tenantId,
            assetId,
            eventType: 'SOURCE_ASSOCIATED',
            payload: {
              documentId: newObs.evidenceRef.documentId,
              title: newObs.evidenceRef.documentTitle,
              admissibility: newObs.evidenceRef.admissibilityStatus,
            },
            occurredAt: now,
          });
        }

        // If delta indicated change
        if (newObs.deltaDescription) {
          await dynamo.recordEvent({
            eventId: `evt-${Date.now()}-chg`,
            tenantId,
            assetId,
            eventType: 'CHANGE_DETECTED',
            payload: { delta: newObs.deltaDescription },
            occurredAt: now,
          });
        }

        // If attention raised or state altered
        if (body.attentionItem) {
          asset.attentionItems.push({
            ...body.attentionItem,
            itemId: `att-${Date.now().toString(36)}`,
            raisedAt: now,
            isCandidateOnly: true,
          });
          asset.currentState = body.attentionItem.severity === 'CRITICAL' ? 'MAINTENANCE_REQUIRED' : asset.currentState;

          await dynamo.recordEvent({
            eventId: `evt-${Date.now()}-att`,
            tenantId,
            assetId,
            eventType: 'ATTENTION_RAISED',
            payload: {
              severity: body.attentionItem.severity,
              headline: body.attentionItem.headline,
            },
            occurredAt: now,
          });
        }

        const saved = await dynamo.saveAsset(asset);
        return {
          statusCode: 201,
          headers: getCorsHeaders(),
          body: JSON.stringify(saved),
        };
      }

      // POST /api/assets/{assetId}/spatial
      if (method === 'POST' && subAction === 'spatial') {
        const asset = await dynamo.getAsset(tenantId, assetId);
        if (!asset) {
          return {
            statusCode: 404,
            headers: getCorsHeaders(),
            body: JSON.stringify({ error: `Asset not found: ${assetId}` }),
          };
        }

        const body = event.body ? JSON.parse(event.body) : {};
        const spatialBinding: SpatialBinding = {
          bindingId: `sp-${Date.now().toString(36)}`,
          latitude: body.latitude,
          longitude: body.longitude,
          elevationMeters: body.elevationMeters,
          address: body.address,
          municipality: body.municipality,
          stateOrRegion: body.stateOrRegion,
          country: body.country || 'Brasil',
          spatialPrecisionMeters: body.spatialPrecisionMeters || 10,
          boundAt: new Date().toISOString(),
          reconciliationStatus: body.reconciliationStatus || 'ESTIMATED',
          disclaimer: 'SubjectIdentity != SpatialBinding; Location != Provenance; Document != Evidence',
        };

        asset.spatial = spatialBinding;
        await dynamo.saveAsset(asset);

        await dynamo.recordEvent({
          eventId: `evt-${Date.now()}-loc`,
          tenantId,
          assetId,
          eventType: 'LOCATION_BOUND',
          payload: {
            lat: spatialBinding.latitude,
            lon: spatialBinding.longitude,
            reconciliationStatus: spatialBinding.reconciliationStatus,
          },
          occurredAt: spatialBinding.boundAt,
        });

        return {
          statusCode: 200,
          headers: getCorsHeaders(),
          body: JSON.stringify(asset),
        };
      }

      // POST /api/assets/{assetId}/chat
      if (method === 'POST' && subAction === 'chat') {
        const asset = await dynamo.getAsset(tenantId, assetId);
        if (!asset) {
          return {
            statusCode: 404,
            headers: getCorsHeaders(),
            body: JSON.stringify({ error: `Asset not found: ${assetId}` }),
          };
        }

        const body = event.body ? JSON.parse(event.body) : {};
        const query = body.query || 'Me mostre o que sabemos sobre este ativo.';
        const response = await reasoner.respondToQuery(asset, query);

        // Record CHAT_QUERY_RECORDED operational event
        await dynamo.recordEvent({
          eventId: `evt-${Date.now()}-chat`,
          tenantId,
          assetId,
          eventType: 'CHAT_QUERY_RECORDED',
          payload: { query, category: response.category, generatedBy: response.generatedBy },
          occurredAt: new Date().toISOString(),
        });

        return {
          statusCode: 200,
          headers: getCorsHeaders(),
          body: JSON.stringify(response),
        };
      }

      // GET /api/assets/{assetId}/timeline
      if (method === 'GET' && subAction === 'timeline') {
        const events = await dynamo.getEvents(tenantId, assetId);
        return {
          statusCode: 200,
          headers: getCorsHeaders(),
          body: JSON.stringify(events),
        };
      }
    }

    // 3. GET /api/observability
    if (method === 'GET' && (rawPath === '/api/observability' || rawPath === '/observability')) {
      const metrics = await dynamo.getObservabilityMetrics(tenantId);
      return {
        statusCode: 200,
        headers: getCorsHeaders(),
        body: JSON.stringify(metrics),
      };
    }

    // 4. GET /api/integrations
    if (method === 'GET' && (rawPath === '/api/integrations' || rawPath === '/integrations')) {
      return {
        statusCode: 200,
        headers: getCorsHeaders(),
        body: JSON.stringify({
          evidenceApi: {
            configured: true,
            endpoint: 'https://brgkao1ln5.execute-api.sa-east-1.amazonaws.com',
            status: evidence.isAvailable() ? 'AVAILABLE' : 'FALLBACK',
            notes: 'Read-only projection for subjects, passports, and evidence custody',
          },
          foundryApi: {
            configured: true,
            status: 'REFERENCE_PATTERN',
            notes: 'Project capability context pattern reused; isolated deployment',
          },
          studioCognition: {
            configured: true,
            status: 'CANDIDATE_ONLY',
            notes: 'Cognitive reasoning model; AI remains candidate; no authority transfer',
          },
        }),
      };
    }

    // Not found
    return {
      statusCode: 404,
      headers: getCorsHeaders(),
      body: JSON.stringify({ error: `Not found: ${method} ${rawPath}` }),
    };
  } catch (err: any) {
    console.error(`[HandlerError] ${err.message}`, err);
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({ error: 'Internal Server Error', message: err.message }),
    };
  }
}
