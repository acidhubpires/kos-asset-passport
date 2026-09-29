import { describe, it, expect } from 'vitest';
import { AssetReasoner } from '../src/core/reasoning';
import { GOLDEN_ASSET_AP001 } from '../src/adapters/local-adapter';
import { handler } from '../src/api/handler';

describe('Chat Interaction & Candidate Reasoning: Bounded Capabilities', () => {
  const reasoner = new AssetReasoner();

  it('answers "Me mostre o que sabemos sobre este ativo." with complete living dossier', async () => {
    const res = await reasoner.respondToQuery(GOLDEN_ASSET_AP001, 'Me mostre o que sabemos sobre este ativo.');
    expect(res.category).toBe('explanation');
    expect(res.intent).toBe('ASSET_IDENTITY');
    expect(res.candidateNotice).toBe(true);

    expect(res.answer).toContain('Telecom Site AP-001');
    expect(res.answer).toContain('TELECOM_TOWER');
    expect(res.answer).toContain('Onde está');
    expect(res.answer).toContain('O que mudou recentemente');
    expect(res.answer).toContain('Evidências que sustentam o estado');
    expect(res.answer).toContain('Informações ausentes / lacunas de conhecimento');
    expect(res.answer).toContain('CANDIDATA');
  });

  it('answers spatial query: "Where is the asset located and what is the spatial precision?"', async () => {
    const res = await reasoner.respondToQuery(
      GOLDEN_ASSET_AP001,
      'Where is the asset located and what is the spatial precision?'
    );
    expect(res.intent).toBe('SPATIAL_LOCATION_AND_PRECISION');
    expect(res.answer).toContain('-23.55052');
    expect(res.answer).toContain('-46.633308');
    expect(res.answer).toContain('Precisão Espacial');
    expect(res.answer).toContain('± 5 metros');
    expect(res.answer).toContain('SubjectIdentity != SpatialBinding');
  });

  it('answers recent changes query: "What changed recently?"', async () => {
    const res = await reasoner.respondToQuery(GOLDEN_ASSET_AP001, 'What changed recently?');
    expect(res.intent).toBe('RECENT_CHANGES');
    expect(res.answer).toContain('O que Mudou Recentemente');
    expect(res.answer).toContain('Autonomia real caiu');
    expect(res.answer).toContain('42 minutos');
  });

  it('answers supporting evidence query: "Quais as evidências que sustentam o estado?"', async () => {
    const res = await reasoner.respondToQuery(GOLDEN_ASSET_AP001, 'Quais as evidências que sustentam o estado?');
    expect(res.intent).toBe('SUPPORTING_EVIDENCE');
    expect(res.answer).toContain('Evidências que Sustentam o Estado Atual');
    expect(res.answer).toContain('ADMISSIBLE');
    expect(res.answer).toContain('SHA-256');
    expect(res.answer).toContain('Documento ≠ Evidência');
  });

  it('answers missing information query: "O que está faltando?"', async () => {
    const res = await reasoner.respondToQuery(GOLDEN_ASSET_AP001, 'O que está faltando?');
    expect(res.intent).toBe('MISSING_INFORMATION');
    expect(res.answer).toContain('Informações Ausentes / Lacunas de Conhecimento');
    expect(res.answer).toContain('retificador primário');
    expect(res.answer).toContain('Informação Ausente ≠ Falso');
  });

  it('answers attention query: "O que merece atenção?" with candidate explanation without synthetic universal score', async () => {
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

  it('epistemically safely fails on out-of-context query: "What will the dollar exchange rate be tomorrow?"', async () => {
    const res = await reasoner.respondToQuery(
      GOLDEN_ASSET_AP001,
      'What will the dollar exchange rate be tomorrow?'
    );
    expect(res.category).toBe('out_of_context');
    expect(res.intent).toBe('OUT_OF_CONTEXT');
    expect(res.answer).toContain('Consulta Fora do Escopo');
    expect(res.answer).toContain('não está estabelecida no contexto deste Asset Passport');
    // Ensure no speculative dollar value was fabricated
    expect(res.answer).not.toContain('R$');
    expect(res.answer).not.toContain('USD');
  });

  it('epistemically safely fails on Portuguese out-of-context query: "Qual a cotação do dólar amanhã?"', async () => {
    const res = await reasoner.respondToQuery(
      GOLDEN_ASSET_AP001,
      'Qual a cotação do dólar amanhã?'
    );
    expect(res.category).toBe('out_of_context');
    expect(res.intent).toBe('OUT_OF_CONTEXT');
    expect(res.answer).toContain('não está estabelecida no contexto');
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

    const timelineRes = await handler({
      rawPath: '/api/assets/AP-001/timeline',
      headers: { 'X-Tenant-Id': 'tenant-default' },
      requestContext: { http: { method: 'GET', path: '/api/assets/AP-001/timeline' } },
    });
    const events = JSON.parse(timelineRes.body);
    expect(events.some((e: any) => e.eventType === 'CHAT_QUERY_RECORDED')).toBe(true);
  });
});
