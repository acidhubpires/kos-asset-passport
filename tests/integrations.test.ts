import { describe, it, expect } from 'vitest';
import { EvidenceAdapter } from '../src/adapters/evidence-adapter';
import { handler } from '../src/api/handler';

describe('Evidence/Source Projection & Unavailable Integration Behavior', () => {
  it('gracefully handles unreachable/unavailable upstream Evidence API without throwing', async () => {
    // Create an adapter pointing to an unreachable dummy endpoint
    const offlineAdapter = new EvidenceAdapter('http://127.0.0.1:59999/unreachable');

    const subject = await offlineAdapter.getSubjectProjection('proj-123', 'sub-456');
    // Expect graceful null return, not unhandled exception
    expect(subject).toBeNull();

    const artifact = await offlineAdapter.getEvidenceReference('proj-123', 'art-789');
    expect(artifact).toBeNull();
  });

  it('exposes integration status route with clear boundary documentation', async () => {
    const res = await handler({
      rawPath: '/api/integrations',
      requestContext: { http: { method: 'GET', path: '/api/integrations' } },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.evidenceApi).toBeDefined();
    expect(body.evidenceApi.provenanceTruth).toBe('FIXTURE_ONLY');
    expect(body.foundryApi.status).toBe('REFERENCE_PATTERN');
    expect(body.studioCognition.status).toBe('CANDIDATE_ONLY');
  });

  it('provides observability metrics without synthetic universal score', async () => {
    const res = await handler({
      rawPath: '/api/observability',
      requestContext: { http: { method: 'GET', path: '/api/observability' } },
    });

    expect(res.statusCode).toBe(200);
    const metrics = JSON.parse(res.body);
    expect(metrics.totalAssets).toBeGreaterThan(0);
    expect(metrics.freshnessBreakdown).toBeDefined();
    expect(metrics.sourceCoverage).toBeDefined();
    expect(metrics.observationsByMonth).toBeDefined();

    // Verify absence of synthetic universal score
    expect(metrics.score).toBeUndefined();
    expect(metrics.universalScore).toBeUndefined();
  });
});
