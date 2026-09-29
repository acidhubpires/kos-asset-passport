import { describe, it, expect } from 'vitest';
import { AssetReasoner } from '../src/core/reasoning';
import { GOLDEN_ASSET_AP001 } from '../src/adapters/local-adapter';
import { handler } from '../src/api/handler';

describe('Chat Interaction & Candidate Reasoning', () => {
  const reasoner = new AssetReasoner();

  it('answers "Me mostre o que sabemos sobre este ativo." with complete living dossier', async () => {
    const res = await reasoner.respondToQuery(GOLDEN_ASSET_AP001, 'Me mostre o que sabemos sobre este ativo.');
    expect(res.category).toBe('explanation');
    expect(res.candidateNotice).toBe(true);

    // Verify explainable aspects
    expect(res.answer).toContain('Telecom Site AP-001');
    expect(res.answer).toContain('TELECOM_TOWER');
    expect(res.answer).toContain('Onde está');
    expect(res.answer).toContain('O que mudou recentemente');
    expect(res.answer).toContain('Evidências que sustentam o estado');
    expect(res.answer).toContain('Informações ausentes / lacunas de conhecimento');
    expect(res.answer).toContain('CANDIDATA');
  });

  it('answers "O que merece atenção?" returning candidate-only explanation without universal score', async () => {
    const res = await reasoner.respondToQuery(GOLDEN_ASSET_AP001, 'O que merece atenção?');
    expect(res.category).toBe('attention');
    expect(res.candidateNotice).toBe(true);

    expect(res.answer).toContain('Itens que Merecem Atenção Prioritária');
    expect(res.answer).toContain('CRITICAL');
    expect(res.answer).toContain('contingência energética');
    expect(res.answer).toContain('Ação Recomendada');
    expect(res.answer).toContain('PROPOSIÇÃO CANDIDATA');

    // Confirm no synthetic universal score is fabricated
    expect(res.answer.toLowerCase()).not.toContain('score global');
    expect(res.answer.toLowerCase()).not.toContain('score universal');
  });

  it('records CHAT_QUERY_RECORDED event via API handler', async () => {
    const chatEvent = {
      rawPath: '/api/assets/AP-001/chat',
      headers: { 'X-Tenant-Id': 'tenant-default' },
      requestContext: { http: { method: 'POST', path: '/api/assets/AP-001/chat' } },
      body: JSON.stringify({ query: 'O que merece atenção?' }),
    };

    const res = await handler(chatEvent);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.candidateNotice).toBe(true);

    // Check timeline has CHAT_QUERY_RECORDED
    const timelineRes = await handler({
      rawPath: '/api/assets/AP-001/timeline',
      headers: { 'X-Tenant-Id': 'tenant-default' },
      requestContext: { http: { method: 'GET', path: '/api/assets/AP-001/timeline' } },
    });
    const events = JSON.parse(timelineRes.body);
    expect(events.some((e: any) => e.eventType === 'CHAT_QUERY_RECORDED')).toBe(true);
  });
});
