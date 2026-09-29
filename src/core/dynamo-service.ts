import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { AssetPassport, ProductEvent, ObservabilityMetrics } from '../types';
import { LocalAdapter, GOLDEN_ASSET_AP001 } from '../adapters/local-adapter';

export class DynamoService {
  private docClient?: DynamoDBDocumentClient;
  private tableName: string;
  private localFallback: LocalAdapter;

  constructor(tableName?: string, region = 'sa-east-1') {
    this.tableName = tableName || process.env.TABLE_NAME || 'KosAssetPassport-dev-StateTable';
    this.localFallback = new LocalAdapter();

    try {
      const client = new DynamoDBClient({ region });
      this.docClient = DynamoDBDocumentClient.from(client, {
        marshallOptions: { removeUndefinedValues: true },
      });
    } catch {
      this.docClient = undefined;
    }
  }

  public isAvailable(): boolean {
    return Boolean(this.docClient && process.env.AWS_EXECUTION_ENV);
  }

  // --- Assets ---

  public async getAsset(tenantId: string, assetId: string): Promise<AssetPassport | null> {
    if (!this.isAvailable()) {
      return this.localFallback.getAsset(assetId, tenantId) || null;
    }

    try {
      const res = await this.docClient!.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            PK: `TENANT#${tenantId}`,
            SK: `ASSET#${assetId}`,
          },
        })
      );
      if (res.Item) {
        return res.Item.data as AssetPassport;
      }
      // If not found in DynamoDB, check fallback golden asset if matches
      if (assetId === GOLDEN_ASSET_AP001.assetId) {
        return this.localFallback.getAsset(assetId, tenantId) || null;
      }
      return null;
    } catch (err: any) {
      console.warn(`[DynamoService] getAsset fallback: ${err.message}`);
      return this.localFallback.getAsset(assetId, tenantId) || null;
    }
  }

  public async saveAsset(asset: AssetPassport): Promise<AssetPassport> {
    asset.updatedAt = new Date().toISOString();

    if (!this.isAvailable()) {
      return this.localFallback.saveAsset(asset);
    }

    try {
      await this.docClient!.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            PK: `TENANT#${asset.tenantId}`,
            SK: `ASSET#${asset.assetId}`,
            entityType: 'ASSET_PASSPORT',
            assetId: asset.assetId,
            tenantId: asset.tenantId,
            name: asset.name,
            assetType: asset.assetType,
            currentState: asset.currentState,
            updatedAt: asset.updatedAt,
            data: asset,
          },
        })
      );
      // Keep local in sync
      this.localFallback.saveAsset(asset);
      return asset;
    } catch (err: any) {
      console.warn(`[DynamoService] saveAsset fallback: ${err.message}`);
      return this.localFallback.saveAsset(asset);
    }
  }

  public async listAssets(tenantId: string): Promise<AssetPassport[]> {
    if (!this.isAvailable()) {
      return this.localFallback.listAssets(tenantId);
    }

    try {
      const res = await this.docClient!.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          ExpressionAttributeValues: {
            ':pk': `TENANT#${tenantId}`,
            ':skPrefix': 'ASSET#',
          },
        })
      );
      const items = (res.Items || []).map(i => i.data as AssetPassport);
      if (items.length === 0) {
        return this.localFallback.listAssets(tenantId);
      }
      return items;
    } catch (err: any) {
      console.warn(`[DynamoService] listAssets fallback: ${err.message}`);
      return this.localFallback.listAssets(tenantId);
    }
  }

  // --- Events ---

  public async recordEvent(event: ProductEvent): Promise<ProductEvent> {
    const timestamp = event.occurredAt || new Date().toISOString();
    const eventId = event.eventId || `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const fullEvent: ProductEvent = {
      ...event,
      eventId,
      occurredAt: timestamp,
      persistedAt: new Date().toISOString(),
      note: 'Product events are not Evidence Chronicle.',
    };

    if (!this.isAvailable()) {
      return this.localFallback.recordEvent(fullEvent);
    }

    try {
      await this.docClient!.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            PK: `TENANT#${fullEvent.tenantId}`,
            SK: `EVENT#${fullEvent.assetId}#${timestamp}#${eventId}`,
            entityType: 'PRODUCT_EVENT',
            eventType: fullEvent.eventType,
            assetId: fullEvent.assetId,
            tenantId: fullEvent.tenantId,
            occurredAt: timestamp,
            persistedAt: fullEvent.persistedAt,
            payload: fullEvent.payload,
            note: fullEvent.note,
          },
        })
      );
      this.localFallback.recordEvent(fullEvent);
      return fullEvent;
    } catch (err: any) {
      console.warn(`[DynamoService] recordEvent fallback: ${err.message}`);
      return this.localFallback.recordEvent(fullEvent);
    }
  }

  public async getEvents(tenantId: string, assetId: string): Promise<ProductEvent[]> {
    if (!this.isAvailable()) {
      return this.localFallback.getEvents(assetId, tenantId);
    }

    try {
      const res = await this.docClient!.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          ExpressionAttributeValues: {
            ':pk': `TENANT#${tenantId}`,
            ':skPrefix': `EVENT#${assetId}#`,
          },
        })
      );
      const events: ProductEvent[] = (res.Items || []).map(i => ({
        eventId: (i.SK as string).split('#').pop() || '',
        tenantId: i.tenantId,
        assetId: i.assetId,
        eventType: i.eventType,
        payload: i.payload,
        occurredAt: i.occurredAt,
        persistedAt: i.persistedAt,
        note: i.note,
      }));

      if (events.length === 0) {
        return this.localFallback.getEvents(assetId, tenantId);
      }
      return events;
    } catch (err: any) {
      console.warn(`[DynamoService] getEvents fallback: ${err.message}`);
      return this.localFallback.getEvents(assetId, tenantId);
    }
  }

  // --- Observability Metrics ---

  public async getObservabilityMetrics(tenantId: string): Promise<ObservabilityMetrics> {
    return this.localFallback.getObservabilityMetrics(tenantId);
  }
}
