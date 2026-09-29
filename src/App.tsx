import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  FileText,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Send,
  Database,
  RefreshCw,
  PlusCircle,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  BarChart3,
  Layers,
  Lock,
  UserCheck
} from 'lucide-react';
import { AssetPassport, ChatMessage, ProductEvent, ObservabilityMetrics, Observation, AttentionItem } from './types';
import { GOLDEN_ASSET_AP001 } from './adapters/local-adapter';

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'passport' | 'map' | 'timeline'>('chat');
  const [asset, setAsset] = useState<AssetPassport>(GOLDEN_ASSET_AP001);
  const [events, setEvents] = useState<ProductEvent[]>([]);
  const [metrics, setMetrics] = useState<ObservabilityMetrics | null>(null);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showGovernanceDetails, setShowGovernanceDetails] = useState(false);
  const [showAddObsModal, setShowAddObsModal] = useState(false);

  // Authentication State (Cognito / Multi-tenant)
  const [auth, setAuth] = useState({
    isAuthenticated: true,
    email: 'operator@acidhub.internal',
    tenantId: 'tenant-default',
    role: 'Infrastructure Specialist',
  });

  // Chat message history
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'assistant',
      content: `Olá! Sou o assistente do **KOS Asset Passport**.
Estou pronto para apresentar o dossiê vivo e explicável do ativo **${asset.name}**.

Você pode me perguntar:
- *"Me mostre o que sabemos sobre este ativo."*
- *"O que merece atenção?"*
- *"Onde está localizado o ativo e qual a precisão?"*`,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      category: 'general',
      candidateNotice: true,
    },
  ]);

  // New Observation Form State
  const [newObsForm, setNewObsForm] = useState({
    summary: '',
    details: '',
    deltaDescription: '',
    category: 'MAINTENANCE' as const,
    docTitle: '',
    docId: '',
    raiseAttention: false,
    attentionHeadline: '',
    attentionSeverity: 'HIGH' as const,
  });

  // Load initial events and metrics from local or API
  useEffect(() => {
    fetchEvents();
    fetchMetrics();
  }, [asset.assetId, auth.tenantId]);

  const fetchEvents = async () => {
    try {
      const res = await fetch(`/api/assets/${asset.assetId}/timeline`, {
        headers: { 'X-Tenant-Id': auth.tenantId },
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch {
      // Fallback local events
      setEvents([
        {
          eventId: 'evt-1',
          tenantId: auth.tenantId,
          assetId: asset.assetId,
          eventType: 'ASSET_CREATED',
          payload: { name: asset.name, type: asset.assetType },
          occurredAt: '2026-09-01T10:00:00.000Z',
          persistedAt: '2026-09-01T10:00:00.000Z',
        },
        {
          eventId: 'evt-2',
          tenantId: auth.tenantId,
          assetId: asset.assetId,
          eventType: 'LOCATION_BOUND',
          payload: { lat: asset.spatial?.latitude, lon: asset.spatial?.longitude },
          occurredAt: '2026-09-01T10:05:00.000Z',
          persistedAt: '2026-09-01T10:05:00.000Z',
        },
        {
          eventId: 'evt-3',
          tenantId: auth.tenantId,
          assetId: asset.assetId,
          eventType: 'SOURCE_ASSOCIATED',
          payload: { title: 'Relatório de Engenharia Estrutural #EE-902' },
          occurredAt: '2026-03-15T14:30:00.000Z',
          persistedAt: '2026-03-15T14:30:00.000Z',
        },
        {
          eventId: 'evt-4',
          tenantId: auth.tenantId,
          assetId: asset.assetId,
          eventType: 'OBSERVATION_ADDED',
          payload: { summary: 'Alerta de degradação acelerada do banco de baterias' },
          occurredAt: '2026-09-28T09:15:00.000Z',
          persistedAt: '2026-09-28T09:15:00.000Z',
        },
        {
          eventId: 'evt-5',
          tenantId: auth.tenantId,
          assetId: asset.assetId,
          eventType: 'ATTENTION_RAISED',
          payload: { severity: 'CRITICAL', headline: 'Risco iminente de perda de contingência energética' },
          occurredAt: '2026-09-28T09:30:00.000Z',
          persistedAt: '2026-09-28T09:30:00.000Z',
        },
      ]);
    }
  };

  const fetchMetrics = async () => {
    try {
      const res = await fetch('/api/observability', {
        headers: { 'X-Tenant-Id': auth.tenantId },
      });
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch {
      setMetrics({
        totalAssets: 1,
        totalObservations: asset.observations.length,
        openAttentionCount: asset.attentionItems.length,
        freshnessBreakdown: { fresh: 1, moderate: 0, stale: 1 },
        recentChangesCount: 1,
        observationsByMonth: [
          { period: '2026-03', count: 1 },
          { period: '2026-09', count: 1 },
        ],
        sourceCoverage: [
          { sourceName: 'KOS Evidence Platform', verifiedCount: 2 },
          { sourceName: 'Manual Operator Logs', verifiedCount: 0 },
        ],
      });
    }
  };

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const res = await fetch(`/api/assets/${asset.assetId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': auth.tenantId,
        },
        body: JSON.stringify({ query: textToSend }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [
          ...prev,
          {
            id: `asst-${Date.now()}`,
            sender: 'assistant',
            content: data.answer,
            category: data.category,
            candidateNotice: data.candidateNotice,
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        fetchEvents();
      } else {
        throw new Error('API Error');
      }
    } catch {
      // Local candidate fallback response
      let localAnswer = '';
      let cat: 'explanation' | 'attention' | 'general' = 'general';

      const norm = textToSend.toLowerCase();
      if (norm.includes('o que sabemos') || norm.includes('me mostre')) {
        cat = 'explanation';
        localAnswer = `### 📋 Dossiê Vivo: ${asset.name} (${asset.assetId})

**1. O que é este ativo e estado atual:**
Este ativo é do tipo **${asset.assetType}**, operado por **${asset.ownerContext.operator}** (${asset.ownerContext.responsibleTeam}, Criticidade: ${asset.ownerContext.criticalityTier}).
O estado operacional observado no momento é **${asset.currentState}**.
${asset.description}

**2. Onde está:**
${asset.spatial?.address}, ${asset.spatial?.municipality} (${asset.spatial?.latitude}, ${asset.spatial?.longitude})
*(Nota de Governança: Identidade do Sujeito ≠ Vinculação Espacial; Localização ≠ Proveniência).*

**3. O que mudou recentemente:**
${asset.observations.map(o => `• [${new Date(o.observedAt).toLocaleDateString('pt-BR')}] ${o.summary}${o.deltaDescription ? ` -> ${o.deltaDescription}` : ''}`).join('\n')}

**4. Evidências que sustentam o estado:**
${asset.observations.filter(o => o.evidenceRef).map(o => `• ${o.evidenceRef?.documentTitle} (Status: ${o.evidenceRef?.admissibilityStatus}, Fonte: ${o.evidenceRef?.custodySource})`).join('\n')}

**5. Informações ausentes / lacunas de conhecimento:**
${asset.missingInformation.map(m => `• ${m}`).join('\n')}

---
*Aviso de Governança: Esta explicação é uma síntese explicativa e tem caráter de CANDIDATA. A autoridade deliberativa permanece sob supervisão humana e governança formal KOS.*`;
      } else if (norm.includes('atenção') || norm.includes('risco')) {
        cat = 'attention';
        localAnswer = `### ⚠️ Itens que Merecem Atenção Prioritária: ${asset.name}

${asset.attentionItems.map((item, idx) => `
**Item ${idx + 1}: [${item.severity}] ${item.headline}**
- **Explicação do Risco:** ${item.candidateExplanation}
- **Base Probatória:** ${item.evidenceBasis}
- **Ação Recomendada:** ${item.recommendedAction}
- **Identificado em:** ${new Date(item.raisedAt).toLocaleString('pt-BR')}
`).join('\n---\n')}

---
> **[AVISO DE GOVERNANÇA KOS]**  
> As recomendações acima constituem **PROPOSIÇÃO CANDIDATA** gerada com base nas observações e telemetria disponíveis. Nenhuma decisão automática ou mutação física de autoridade é executada sem homologação do operador responsável.`;
      } else {
        localAnswer = `Entendi sua pergunta sobre **${asset.name}**: "${textToSend}".

Registramos **${asset.observations.length} observações**, **${asset.attentionItems.length} alertas de atenção** e estado **${asset.currentState}**.
Você pode usar os atalhos rápidos abaixo:
- *"Me mostre o que sabemos sobre este ativo."*
- *"O que merece atenção?"*`;
      }

      setMessages(prev => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          content: localAnswer,
          category: cat,
          candidateNotice: true,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newObsForm.summary) return;

    const newObs: Observation = {
      observationId: `obs-${Date.now()}`,
      assetId: asset.assetId,
      tenantId: auth.tenantId,
      observedAt: new Date().toISOString(),
      category: newObsForm.category,
      summary: newObsForm.summary,
      details: newObsForm.details,
      deltaDescription: newObsForm.deltaDescription || undefined,
      recordedBy: auth.email,
      evidenceRef: newObsForm.docTitle
        ? {
            evidenceId: `ev-${Date.now()}`,
            documentId: newObsForm.docId || `doc-${Date.now()}`,
            documentTitle: newObsForm.docTitle,
            admissibilityStatus: 'ADMISSIBLE',
            freshnessTimestamp: new Date().toISOString(),
            custodySource: 'KOS Evidence Platform',
            sha256: '9f83c6051a842e4822063e0237560f044cd0669e222a315ac0da10136a7c00f1',
          }
        : undefined,
    };

    let updatedAttention = [...asset.attentionItems];
    let updatedState = asset.currentState;

    if (newObsForm.raiseAttention && newObsForm.attentionHeadline) {
      const attItem: AttentionItem = {
        itemId: `att-${Date.now()}`,
        severity: newObsForm.attentionSeverity,
        headline: newObsForm.attentionHeadline,
        candidateExplanation: newObsForm.details || newObsForm.summary,
        evidenceBasis: newObsForm.docTitle || 'Observação de campo registrada',
        recommendedAction: 'Ação corretiva prioritária recomendada',
        raisedAt: new Date().toISOString(),
        isCandidateOnly: true,
      };
      updatedAttention.push(attItem);
      updatedState = 'MAINTENANCE_REQUIRED';
    }

    const updatedAsset: AssetPassport = {
      ...asset,
      observations: [...asset.observations, newObs],
      attentionItems: updatedAttention,
      currentState: updatedState,
      updatedAt: new Date().toISOString(),
    };

    setAsset(updatedAsset);
    setShowAddObsModal(false);
    setNewObsForm({
      summary: '',
      details: '',
      deltaDescription: '',
      category: 'MAINTENANCE',
      docTitle: '',
      docId: '',
      raiseAttention: false,
      attentionHeadline: '',
      attentionSeverity: 'HIGH',
    });

    // Record events in timeline
    const now = new Date().toISOString();
    setEvents(prev => [
      {
        eventId: `evt-added-${Date.now()}`,
        tenantId: auth.tenantId,
        assetId: asset.assetId,
        eventType: 'OBSERVATION_ADDED',
        payload: { summary: newObs.summary, category: newObs.category },
        occurredAt: now,
      },
      ...(newObs.evidenceRef
        ? [
            {
              eventId: `evt-src-${Date.now()}`,
              tenantId: auth.tenantId,
              assetId: asset.assetId,
              eventType: 'SOURCE_ASSOCIATED' as const,
              payload: { title: newObs.evidenceRef.documentTitle },
              occurredAt: now,
            },
          ]
        : []),
      ...(newObsForm.raiseAttention
        ? [
            {
              eventId: `evt-att-${Date.now()}`,
              tenantId: auth.tenantId,
              assetId: asset.assetId,
              eventType: 'ATTENTION_RAISED' as const,
              payload: { headline: newObsForm.attentionHeadline, severity: newObsForm.attentionSeverity },
              occurredAt: now,
            },
          ]
        : []),
      ...prev,
    ]);

    // Send to backend API
    try {
      await fetch(`/api/assets/${asset.assetId}/observations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': auth.tenantId,
        },
        body: JSON.stringify({
          ...newObs,
          attentionItem: newObsForm.raiseAttention
            ? {
                severity: newObsForm.attentionSeverity,
                headline: newObsForm.attentionHeadline,
                candidateExplanation: newObsForm.details || newObsForm.summary,
                evidenceBasis: newObsForm.docTitle || 'Observação registrada',
                recommendedAction: 'Ação corretiva prioritária recomendada',
              }
            : undefined,
        }),
      });
      fetchMetrics();
    } catch {
      console.warn('Backend unavailable, local state retained.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur px-6 py-3.5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg text-slate-100 tracking-tight">KOS Asset Passport</span>
              <span className="text-xs px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-400 font-mono">
                sa-east-1
              </span>
            </div>
            <p className="text-xs text-slate-400">Dossiê Vivo & Explicável de Ativos · KOS Projection</p>
          </div>
        </div>

        {/* Auth & Tenant Context */}
        <div className="flex items-center space-x-4">
          <div className="hidden md:flex items-center space-x-2 text-xs bg-slate-800/80 px-3 py-1.5 rounded-md border border-slate-700">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-300">Cognito:</span>
            <span className="text-emerald-400 font-mono">{auth.email}</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">Tenant:</span>
            <span className="text-sky-300 font-mono">{auth.tenantId}</span>
          </div>

          <button
            onClick={() => setShowAddObsModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Nova Observação</span>
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="flex-1 flex flex-col max-w-7xl w-full mx-auto p-4 md:p-6 space-y-5">
        {/* Landing Card: Asset Identity & Current State Summary */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center space-x-2.5">
                <h1 className="text-xl font-bold text-white tracking-tight">{asset.name}</h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-slate-800 text-slate-300 border border-slate-700">
                  {asset.assetId}
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                  asset.currentState === 'MAINTENANCE_REQUIRED'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                }`}>
                  {asset.currentState === 'MAINTENANCE_REQUIRED' ? 'MANUTENÇÃO REQUERIDA' : asset.currentState}
                </span>
              </div>
              <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">{asset.description}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 pt-1">
                <span><strong>Operador:</strong> {asset.ownerContext.operator}</span>
                <span>•</span>
                <span><strong>Responsável:</strong> {asset.ownerContext.responsibleTeam}</span>
                <span>•</span>
                <span><strong>Criticidade:</strong> <span className="text-rose-400 font-medium">{asset.ownerContext.criticalityTier}</span></span>
                <span>•</span>
                <span><strong>Atualizado:</strong> {new Date(asset.updatedAt).toLocaleString('pt-BR')}</span>
              </div>
            </div>

            {/* Evidence support indicator */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs space-y-1">
                <div className="text-slate-400 font-medium flex items-center space-x-1.5">
                  <Shield className="w-3.5 h-3.5 text-sky-400" />
                  <span>Suporte Probatório KOS</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-base font-bold text-sky-400">{asset.observations.filter(o => o.evidenceRef).length}</span>
                  <span className="text-slate-400">evidências governadas</span>
                </div>
                <span className="inline-block text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  100% Admissíveis
                </span>
              </div>

              {asset.attentionItems.length > 0 && (
                <div className="bg-amber-950/40 border border-amber-500/30 rounded-lg p-3 text-xs space-y-1">
                  <div className="text-amber-400 font-medium flex items-center space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Atenção Prioritária</span>
                  </div>
                  <div className="text-slate-200 font-semibold truncate max-w-[220px]">
                    {asset.attentionItems[0].headline}
                  </div>
                  <span className="text-[10px] text-amber-300 font-mono">
                    Proposição Candidata (AI)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Progressive disclosure: Provenance & Governance */}
          <div className="mt-4 pt-3 border-t border-slate-800/80">
            <button
              onClick={() => setShowGovernanceDetails(!showGovernanceDetails)}
              className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-sky-300 transition"
            >
              {showGovernanceDetails ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <span>Ver detalhes de Proveniência & Governança (KEM/KEK, Admissibilidade, Regras de Autoridade)</span>
            </button>

            {showGovernanceDetails && (
              <div className="mt-3 p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs space-y-2 text-slate-300">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[11px] font-semibold uppercase">Separação de Autoridade</span>
                    <p className="text-slate-300 text-[11px] mt-0.5">
                      AI permanece estritamente CANDIDATA. Decisões deliberativas não são delegadas à IA sem homologação humana.
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-semibold uppercase">Postura Espacial</span>
                    <p className="text-slate-300 text-[11px] mt-0.5">
                      SubjectIdentity ≠ SpatialBinding; Documento ≠ Evidência; Localização ≠ Proveniência.
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-semibold uppercase">Isolamento Operacional</span>
                    <p className="text-slate-300 text-[11px] mt-0.5">
                      Eventos do produto persistem na tabela isolada <code className="text-sky-400">KosAssetPassport-dev-StateTable</code> e não afetam o Chronicle Evidence.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Primary Navigation Bar (Max 4 tabs per UX spec) */}
        <div className="flex border-b border-slate-800 space-x-1">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === 'chat'
                ? 'border-sky-500 text-sky-400 bg-sky-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat (Início)</span>
          </button>

          <button
            onClick={() => setActiveTab('passport')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === 'passport'
                ? 'border-sky-500 text-sky-400 bg-sky-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Passport (Dossiê)</span>
          </button>

          <button
            onClick={() => setActiveTab('map')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === 'map'
                ? 'border-sky-500 text-sky-400 bg-sky-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Map / Contexto</span>
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === 'timeline'
                ? 'border-sky-500 text-sky-400 bg-sky-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Timeline</span>
          </button>
        </div>

        {/* VIEW 1: CHAT (Default Home) */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow">
            {/* Quick Action Suggestion Chips */}
            <div className="bg-slate-950/60 p-3 border-b border-slate-800 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 mr-1 flex items-center space-x-1">
                <span>Perguntas Rápidas:</span>
              </span>
              <button
                onClick={() => handleSendMessage('Me mostre o que sabemos sobre este ativo.')}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-white px-3 py-1 rounded-full border border-slate-700 transition"
              >
                💬 "Me mostre o que sabemos sobre este ativo."
              </button>
              <button
                onClick={() => handleSendMessage('O que merece atenção?')}
                className="text-xs bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 hover:text-white px-3 py-1 rounded-full border border-amber-500/30 transition flex items-center space-x-1"
              >
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span>"O que merece atenção?"</span>
              </button>
              <button
                onClick={() => handleSendMessage('Onde está localizado o ativo e qual a precisão espacial?')}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-1 rounded-full border border-slate-700 transition"
              >
                📍 "Onde está localizado o ativo?"
              </button>
            </div>

            {/* Chat Messages Log */}
            <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4 max-h-[500px]">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-3xl rounded-xl p-4 text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'bg-slate-800/90 text-slate-200 border border-slate-700/80 shadow'
                    }`}
                  >
                    {/* Candidate Badge if generated by cognitive assistant */}
                    {msg.sender === 'assistant' && msg.candidateNotice && (
                      <div className="mb-2 flex items-center space-x-1.5 text-[11px] text-sky-300 font-mono bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/60 w-fit">
                        <Shield className="w-3 h-3" />
                        <span>Explicação Candidata (KOS Reasoning)</span>
                      </div>
                    )}

                    <div className="whitespace-pre-line prose prose-invert prose-sm max-w-none">
                      {msg.content}
                    </div>

                    <div className="mt-2 text-[10px] text-right text-slate-400">
                      {msg.timestamp}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-center space-x-2 text-xs text-sky-400 italic py-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Sintetizando dossiê explicativo...</span>
                </div>
              )}
            </div>

            {/* Chat Input Bar */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center space-x-2">
              <input
                type="text"
                value={inputQuery}
                onChange={e => setInputQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                placeholder="Pergunte em linguagem natural sobre o ativo (ex: O que mudou recentemente?)..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={isLoading || !inputQuery.trim()}
                className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg flex items-center space-x-1 text-sm font-medium transition"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Enviar</span>
              </button>
            </div>
          </div>
        )}

        {/* VIEW 2: PASSPORT (Dossiê Completo) */}
        {activeTab === 'passport' && (
          <div className="space-y-5">
            {/* Identity & Technical Specifications */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <h3 className="text-base font-semibold text-white flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-sky-400" />
                  <span>Atributos Conhecidos & Especificações</span>
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {Object.entries(asset.knownAttributes).map(([k, v]) => (
                    <div key={k} className="bg-slate-950 p-2.5 rounded border border-slate-800">
                      <span className="text-slate-400 block font-mono text-[11px]">{k}</span>
                      <span className="font-semibold text-slate-200">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Missing Information / Knowledge Gaps */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <h3 className="text-base font-semibold text-white flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Informações Ausentes / Lacunas</span>
                </h3>
                <div className="space-y-2">
                  {asset.missingInformation.map((m, idx) => (
                    <div key={idx} className="bg-slate-950 p-3 rounded border border-slate-800 text-xs flex items-start space-x-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span className="text-slate-300">{m}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Governed Evidence & Associated Sources */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-base font-semibold text-white flex items-center space-x-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Fontes & Evidências Governamentais KOS</span>
              </h3>
              <div className="space-y-3">
                {asset.observations.filter(o => o.evidenceRef).map(o => (
                  <div key={o.observationId} className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-sky-300">{o.evidenceRef?.documentTitle}</span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {o.evidenceRef?.admissibilityStatus}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{o.details}</p>
                    <div className="flex flex-wrap gap-4 text-[11px] text-slate-500 pt-1 font-mono">
                      <span>Doc ID: {o.evidenceRef?.documentId}</span>
                      <span>Custódia: {o.evidenceRef?.custodySource}</span>
                      <span>SHA256: {o.evidenceRef?.sha256?.substring(0, 16)}...</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Simple Charts Section (freshness, observations, coverage) */}
            {metrics && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
                  <span className="text-slate-400 font-semibold uppercase flex items-center space-x-1.5">
                    <BarChart3 className="w-4 h-4 text-sky-400" />
                    <span>Frescor das Evidências</span>
                  </span>
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between">
                      <span>Recentes (&lt; 7 dias)</span>
                      <span className="font-bold text-emerald-400">{metrics.freshnessBreakdown.fresh}</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full" style={{ width: '50%' }}></div>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span>Históricas (&gt; 30 dias)</span>
                      <span className="font-bold text-slate-400">{metrics.freshnessBreakdown.stale}</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-slate-500 h-full" style={{ width: '50%' }}></div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
                  <span className="text-slate-400 font-semibold uppercase flex items-center space-x-1.5">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    <span>Observações no Tempo</span>
                  </span>
                  <div className="flex items-end space-x-4 h-24 pt-4 px-2">
                    {metrics.observationsByMonth.map(m => (
                      <div key={m.period} className="flex-1 flex flex-col items-center space-y-1">
                        <div
                          className="w-full bg-indigo-500/80 rounded-t"
                          style={{ height: `${m.count * 40 + 10}px` }}
                        ></div>
                        <span className="text-[10px] text-slate-400">{m.period}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
                  <span className="text-slate-400 font-semibold uppercase flex items-center space-x-1.5">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span>Cobertura de Fontes</span>
                  </span>
                  <div className="space-y-2 pt-2">
                    {metrics.sourceCoverage.map(sc => (
                      <div key={sc.sourceName} className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-800">
                        <span>{sc.sourceName}</span>
                        <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 font-bold font-mono">
                          {sc.verifiedCount} docs
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: MAP / CONTEXT */}
        {activeTab === 'map' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <MapPin className="w-5 h-5 text-rose-400" />
                  <span>Painel Espacial & Contexto Geográfico</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Localização física e amarração cartográfica com salvaguardas epistemológicas.
                </p>
              </div>
              <span className="text-xs px-3 py-1 rounded-full font-mono bg-amber-500/10 text-amber-300 border border-amber-500/30">
                Status: {asset.spatial?.reconciliationStatus || 'ESTIMATED'}
              </span>
            </div>

            {/* Spatial Governance Disclaimer */}
            <div className="bg-slate-950 border border-sky-500/30 rounded-lg p-3.5 text-xs text-sky-300 space-y-1">
              <span className="font-semibold block uppercase text-[11px] text-sky-400">Postura Epistêmica Espacial:</span>
              <p className="font-mono text-[11px]">
                {asset.spatial?.disclaimer || 'SubjectIdentity != SpatialBinding; Location != Provenance; Document != Evidence'}
              </p>
              <p className="text-[11px] text-slate-400 pt-1">
                Uma coordenada mapeada não constitui verdade de autoridade até que seja reconciliada e homologada pelo processo formal de governança.
              </p>
            </div>

            {/* Location Specs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-xs block">Latitude</span>
                <span className="text-base font-mono font-bold text-white">{asset.spatial?.latitude}°</span>
              </div>
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-xs block">Longitude</span>
                <span className="text-base font-mono font-bold text-white">{asset.spatial?.longitude}°</span>
              </div>
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-xs block">Altitude</span>
                <span className="text-base font-mono font-bold text-white">{asset.spatial?.elevationMeters || 760} m</span>
              </div>
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-xs block">Precisão Estimada</span>
                <span className="text-base font-mono font-bold text-emerald-400">± {asset.spatial?.spatialPrecisionMeters || 5} m</span>
              </div>
            </div>

            {/* Visual Coordinate Simulated Map Panel */}
            <div className="w-full h-64 bg-slate-950 border border-slate-800 rounded-xl relative overflow-hidden flex items-center justify-center">
              {/* Map grid lines simulation */}
              <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]"></div>
              
              <div className="z-10 flex flex-col items-center space-y-2 p-6 bg-slate-900/90 border border-slate-700/80 rounded-lg shadow-xl backdrop-blur max-w-md text-center">
                <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/60 flex items-center justify-center text-rose-400 animate-pulse">
                  <MapPin className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-sm text-white">{asset.name}</h4>
                <p className="text-xs text-slate-300">{asset.spatial?.address}, {asset.spatial?.municipality} - {asset.spatial?.stateOrRegion}</p>
                <div className="text-[11px] font-mono text-slate-400 pt-1">
                  EPSG:4326 WGS-84 · Lat {asset.spatial?.latitude}, Lon {asset.spatial?.longitude}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: TIMELINE (Histórico de Eventos Operacionais) */}
        {activeTab === 'timeline' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-sky-400" />
                  <span>Timeline Compacta de Eventos Operacionais</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Registro sequencial auditável na tabela DynamoDB do produto (não é Evidence Chronicle).
                </p>
              </div>
              <button
                onClick={fetchEvents}
                className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 px-3 py-1.5 rounded border border-slate-700 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Atualizar</span>
              </button>
            </div>

            <div className="space-y-4 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-800">
              {events.map((evt, idx) => (
                <div key={evt.eventId || idx} className="relative flex items-start space-x-4 pl-8">
                  <div className={`absolute left-2 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                    evt.eventType === 'ATTENTION_RAISED'
                      ? 'bg-amber-400'
                      : evt.eventType === 'ASSET_CREATED'
                      ? 'bg-sky-400'
                      : evt.eventType === 'OBSERVATION_ADDED'
                      ? 'bg-indigo-400'
                      : 'bg-emerald-400'
                  }`}></div>
                  <div className="flex-1 bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-sky-400">{evt.eventType}</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {new Date(evt.occurredAt).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div className="text-xs text-slate-300">
                      {JSON.stringify(evt.payload, null, 2)}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono flex items-center space-x-1 pt-1">
                      <Database className="w-3 h-3 text-slate-600" />
                      <span>DynamoDB: PK=TENANT#{evt.tenantId}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal: Adicionar Observação / Evidência */}
      {showAddObsModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center space-x-2">
                <PlusCircle className="w-5 h-5 text-sky-400" />
                <span>Registrar Nova Observação / Evidência</span>
              </h3>
              <button
                onClick={() => setShowAddObsModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddObservation} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Resumo da Observação *</label>
                <input
                  type="text"
                  required
                  value={newObsForm.summary}
                  onChange={e => setNewObsForm({ ...newObsForm, summary: e.target.value })}
                  placeholder="Ex: Inspeção de rotina do sistema de climatização"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Detalhes Técnicos</label>
                <textarea
                  rows={2}
                  value={newObsForm.details}
                  onChange={e => setNewObsForm({ ...newObsForm, details: e.target.value })}
                  placeholder="Ex: Verificado nível de refrigerante R410A..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Alteração / Delta Observado</label>
                <input
                  type="text"
                  value={newObsForm.deltaDescription}
                  onChange={e => setNewObsForm({ ...newObsForm, deltaDescription: e.target.value })}
                  placeholder="Ex: Temperatura estabilizada em 21°C após substituição do filtro"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="border-t border-slate-800 pt-3">
                <label className="block text-slate-400 mb-1 font-semibold">Título do Documento / Evidência Associada</label>
                <input
                  type="text"
                  value={newObsForm.docTitle}
                  onChange={e => setNewObsForm({ ...newObsForm, docTitle: e.target.value })}
                  placeholder="Ex: Relatório Técnico de Manutenção #RTM-2026-09"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newObsForm.raiseAttention}
                    onChange={e => setNewObsForm({ ...newObsForm, raiseAttention: e.target.checked })}
                    className="rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-0"
                  />
                  <span className="font-semibold text-amber-300">Levantar Alerta de Atenção (Candidate AI)</span>
                </label>

                {newObsForm.raiseAttention && (
                  <div className="space-y-2 pt-2">
                    <input
                      type="text"
                      value={newObsForm.attentionHeadline}
                      onChange={e => setNewObsForm({ ...newObsForm, attentionHeadline: e.target.value })}
                      placeholder="Título do alerta de atenção..."
                      className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white focus:outline-none focus:border-amber-500"
                    />
                    <select
                      value={newObsForm.attentionSeverity}
                      onChange={e => setNewObsForm({ ...newObsForm, attentionSeverity: e.target.value as any })}
                      className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-white"
                    >
                      <option value="CRITICAL">CRITICAL</option>
                      <option value="HIGH">HIGH</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="LOW">LOW</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddObsModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold"
                >
                  Salvar Observação & Persistir Eventos
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 px-6 py-4 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 mt-auto">
        <div className="flex items-center space-x-2">
          <span>KOS Asset Passport v0.1.0</span>
          <span>•</span>
          <span>Authorship PIRESAAO / ACIDHUB KOS</span>
        </div>
        <div className="flex items-center space-x-4">
          <span>KEM/KEK Compatible</span>
          <span>•</span>
          <span>CloudFront + S3 + API Gateway + Lambda + DynamoDB + Cognito</span>
        </div>
      </footer>
    </div>
  );
}
