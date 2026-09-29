import { describe, it, expect } from 'vitest';
import { handler } from '../src/api/handler';
import { DynamoService } from '../src/core/dynamo-service';

describe('Cognito Auth & Tenant Isolation', () => {
  const dynamo = new DynamoService();

  it('correctly isolates assets by tenant', async () => {
    // Save asset for tenant-A
    await dynamo.saveAsset({
      assetId: 'asset-tenant-a',
      tenantId: 'tenant-a',
      name: 'Site Alpha',
      assetType: 'TELECOM_TOWER',
      description: 'Alpha Tower',
      ownerContext: {
        operator: 'Operator A',
        responsibleTeam: 'Team A',
        criticalityTier: 'TIER_1',
      },
      currentState: 'OPERATIONAL',
      knownAttributes: {},
      missingInformation: [],
      observations: [],
      attentionItems: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Save asset for tenant-B
    await dynamo.saveAsset({
      assetId: 'asset-tenant-b',
      tenantId: 'tenant-b',
      name: 'Site Beta',
      assetType: 'SOLAR_ARRAY',
      description: 'Beta Solar',
      ownerContext: {
        operator: 'Operator B',
        responsibleTeam: 'Team B',
        criticalityTier: 'TIER_2',
      },
      currentState: 'OPERATIONAL',
      knownAttributes: {},
      missingInformation: [],
      observations: [],
      attentionItems: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Verify tenant-a only sees Site Alpha
    const tenantAAssets = await dynamo.listAssets('tenant-a');
    expect(tenantAAssets.some(a => a.assetId === 'asset-tenant-a')).toBe(true);
    expect(tenantAAssets.some(a => a.assetId === 'asset-tenant-b')).toBe(false);

    // Verify tenant-b only sees Site Beta
    const tenantBAssets = await dynamo.listAssets('tenant-b');
    expect(tenantBAssets.some(a => a.assetId === 'asset-tenant-b')).toBe(true);
    expect(tenantBAssets.some(a => a.assetId === 'asset-tenant-a')).toBe(false);
  });

  it('authenticates via JWT claims in Lambda handler', async () => {
    const event = {
      rawPath: '/api/assets',
      requestContext: {
        http: { method: 'GET', path: '/api/assets' },
        authorizer: {
          jwt: {
            claims: {
              sub: 'user-sub-123',
              email: 'operator@tenant-a.com',
              'custom:tenant_id': 'tenant-a',
            },
          },
        },
      },
    };

    const response = await handler(event);
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body.every((a: any) => a.tenantId === 'tenant-a')).toBe(true);
  });
});
