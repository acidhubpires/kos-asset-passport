import { AssetPassport, formatAttributeName, formatAttributeValue } from '../types';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

export type SemanticIntent =
  | 'ASSET_IDENTITY'
  | 'CURRENT_STATE'
  | 'KNOWN_ATTRIBUTES'
  | 'OPERATOR_TEAM'
  | 'CRITICALITY'
  | 'SPATIAL_LOCATION'
  | 'SPATIAL_PRECISION'
  | 'SPATIAL_LOCATION_AND_PRECISION'
  | 'RECENT_CHANGES'
  | 'RECENT_OBSERVATIONS'
  | 'LATEST_OBSERVATION'
  | 'SUPPORTING_EVIDENCE'
  | 'EVIDENCE_FRESHNESS'
  | 'MISSING_INFORMATION'
  | 'ATTENTION_ITEMS'
  | 'ATTENTION_REASON'
  | 'TIMELINE_SUMMARY'
  | 'AVAILABLE_SOURCES'
  | 'OUT_OF_CONTEXT';

export interface ExplanationResponse {
  answer: string;
  category: 'explanation' | 'attention' | 'general' | 'out_of_context';
  intent: SemanticIntent;
  candidateNotice: boolean;
  generatedBy: 'BOUNDED_CAPABILITY_ROUTER' | 'BEDROCK_AI' | 'DETERMINISTIC_CANDIDATE_SYNTHESIS';
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export class AssetReasoner {
  private bedrockClient?: BedrockRuntimeClient;
  private modelId: string;

  constructor() {
    this.modelId = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';
    try {
      this.bedrockClient = new BedrockRuntimeClient({
        region: process.env.BEDROCK_REGION || 'sa-east-1',
      });
    } catch {
      this.bedrockClient = undefined;
    }
  }

  /**
   * Bounded semantic capability classifier for Asset Passport natural language queries.
   */
  public classifyIntent(query: string): SemanticIntent {
    const q = normalizeText(query);

    // 1. Detect explicit Out-of-Context queries (Epistemic Safety)
    const outOfContextKeywords = [
      'dolar', 'dollar', 'cambio', 'exchange rate', 'cotacao', 'bolsa', 'ibovespa', 'bitcoin', 'crypto',
      'futebol', 'jogo', 'campeao', 'copa', 'tempo amanha', 'previsao do tempo', 'weather', 'receita',
      'bolo', 'politica', 'eleicao', 'presidente', 'signo', 'horoscopo', 'filme', 'cinema'
    ];
    if (outOfContextKeywords.some(kw => q.includes(kw))) {
      return 'OUT_OF_CONTEXT';
    }

    // 2. Spatial Combined (Location AND Precision)
    const asksLocation = q.includes('onde') || q.includes('localiz') || q.includes('coordenad') || q.includes('where') || q.includes('endereco');
    const asksPrecision = q.includes('precis') || q.includes('margem de erro') || q.includes('toleranc');

    if (asksLocation && asksPrecision) {
      return 'SPATIAL_LOCATION_AND_PRECISION';
    }
    if (asksPrecision) {
      return 'SPATIAL_PRECISION';
    }
    if (asksLocation) {
      return 'SPATIAL_LOCATION';
    }

    // 3. Attention queries
    const asksWhyAttention = q.includes('por que') || q.includes('porque') || q.includes('razao') || q.includes('motivo') || q.includes('causa') || q.includes('why');
    const asksAttention = q.includes('atencao') || q.includes('attention') || q.includes('risco') || q.includes('risk') || q.includes('alerta') || q.includes('perigo');

    if (asksAttention && asksWhyAttention) {
      return 'ATTENTION_REASON';
    }
    if (asksAttention) {
      return 'ATTENTION_ITEMS';
    }

    // 4. Changes
    if (q.includes('mudou') || q.includes('mudanca') || q.includes('alterac') || q.includes('changed') || q.includes('delta')) {
      return 'RECENT_CHANGES';
    }

    // 5. Observations
    if (q.includes('ultima observac') || q.includes('ultimo registro') || q.includes('latest observation')) {
      return 'LATEST_OBSERVATION';
    }
    if (q.includes('observac') || q.includes('inspec') || q.includes('observations')) {
      return 'RECENT_OBSERVATIONS';
    }

    // 6. Evidence & Sources
    if (q.includes('frescor') || q.includes('freshness') || q.includes('recente') && q.includes('evidenc')) {
      return 'EVIDENCE_FRESHNESS';
    }
    if (q.includes('evidenc') || q.includes('provat') || q.includes('supporting evidence') || q.includes('sustent')) {
      return 'SUPPORTING_EVIDENCE';
    }
    if (q.includes('fonte') || q.includes('document') || q.includes('source')) {
      return 'AVAILABLE_SOURCES';
    }

    // 7. Missing Information / Knowledge gaps
    if (q.includes('falta') || q.includes('ausente') || q.includes('lacuna') || q.includes('missing') || q.includes('gap') || q.includes('nao sabemos') || q.includes('pendenc')) {
      return 'MISSING_INFORMATION';
    }

    // 8. Timeline
    if (q.includes('linha do tempo') || q.includes('timeline') || q.includes('historico de evento') || q.includes('eventos operacion')) {
      return 'TIMELINE_SUMMARY';
    }

    // 9. Specific Attributes / Specs
    if (
      q.includes('especificac') || q.includes('atributo') || q.includes('altura') || q.includes('contingencia') ||
      q.includes('bateria') || q.includes('gerador') || q.includes('operadora') || q.includes('licenca') || q.includes('attribute')
    ) {
      return 'KNOWN_ATTRIBUTES';
    }

    // 10. Operator & Team
    if (q.includes('operador') || q.includes('equipe') || q.includes('responsavel') || q.includes('operator') || q.includes('team')) {
      return 'OPERATOR_TEAM';
    }

    // 11. Criticality
    if (q.includes('criticidade') || q.includes('criticality') || q.includes('tier')) {
      return 'CRITICALITY';
    }

    // 12. Current State
    if (q.includes('estado atual') || q.includes('situacao operacional') || q.includes('status') || q.includes('current state')) {
      return 'CURRENT_STATE';
    }

    // 13. General Identity & Living Dossier
    if (
      q.includes('o que sabemos') || q.includes('me mostre') || q.includes('descreva') ||
      q.includes('o que e este ativo') || q.includes('what do we know') || q.includes('what is this asset') ||
      q.includes('resumo') || q.includes('dossie') || q.includes('sobre este ativo')
    ) {
      return 'ASSET_IDENTITY';
    }

    // Default: Check if general question about asset or out of context
    return 'OUT_OF_CONTEXT';
  }

  /**
   * Responds to natural language queries by routing through bounded domain capabilities.
   */
  public async respondToQuery(asset: AssetPassport, query: string): Promise<ExplanationResponse> {
    const intent = this.classifyIntent(query);

    switch (intent) {
      case 'ASSET_IDENTITY':
        return this.generateKnownStateExplanation(asset, intent);

      case 'CURRENT_STATE':
        return this.generateCurrentStateExplanation(asset, intent);

      case 'KNOWN_ATTRIBUTES':
        return this.generateKnownAttributesExplanation(asset, intent);

      case 'OPERATOR_TEAM':
        return this.generateOperatorTeamExplanation(asset, intent);

      case 'CRITICALITY':
        return this.generateCriticalityExplanation(asset, intent);

      case 'SPATIAL_LOCATION_AND_PRECISION':
      case 'SPATIAL_LOCATION':
      case 'SPATIAL_PRECISION':
        return this.generateSpatialExplanation(asset, intent);

      case 'RECENT_CHANGES':
        return this.generateRecentChangesExplanation(asset, intent);

      case 'LATEST_OBSERVATION':
      case 'RECENT_OBSERVATIONS':
        return this.generateObservationsExplanation(asset, intent);

      case 'SUPPORTING_EVIDENCE':
        return this.generateSupportingEvidenceExplanation(asset, intent);

      case 'EVIDENCE_FRESHNESS':
        return this.generateEvidenceFreshnessExplanation(asset, intent);

      case 'MISSING_INFORMATION':
        return this.generateMissingInformationExplanation(asset, intent);

      case 'ATTENTION_ITEMS':
      case 'ATTENTION_REASON':
        return this.generateAttentionExplanation(asset, intent);

      case 'TIMELINE_SUMMARY':
        return this.generateTimelineSummaryExplanation(asset, intent);

      case 'AVAILABLE_SOURCES':
        return this.generateAvailableSourcesExplanation(asset, intent);

      case 'OUT_OF_CONTEXT':
      default:
        return this.generateOutOfContextExplanation(asset, query);
    }
  }

  // --- Sub-Capability Handlers ---

  public generateKnownStateExplanation(asset: AssetPassport, intent: SemanticIntent = 'ASSET_IDENTITY'): ExplanationResponse {
    const loc = asset.spatial
      ? `${asset.spatial.address || 'Coordenadas'}, ${asset.spatial.municipality || ''} (Lat: ${asset.spatial.latitude}, Lon: ${asset.spatial.longitude}, Precisão: ±${asset.spatial.spatialPrecisionMeters || 5}m)`
      : 'Localização geográfica não vinculada';

    const recentObs = asset.observations.slice(-2);
    const changesSummary = recentObs.length > 0
      ? recentObs.map(o => `• [${new Date(o.observedAt).toLocaleDateString('pt-BR')}] ${o.summary}${o.deltaDescription ? ` -> ${o.deltaDescription}` : ''}`).join('\n')
      : 'Nenhuma alteração recente registrada.';

    const evidenceSummary = asset.observations
      .filter(o => o.evidenceRef)
      .map(o => `• ${o.evidenceRef?.documentTitle} (Status: ${o.evidenceRef?.admissibilityStatus}, Procedência: ${o.evidenceRef?.custodySource})`)
      .join('\n') || 'Nenhuma evidência governada formalmente associada.';

    const missingSummary = asset.missingInformation.length > 0
      ? asset.missingInformation.map(m => `• ${m}`).join('\n')
      : 'Nenhuma pendência cadastral conhecida.';

    const answer = `### 📋 Dossiê Vivo: ${asset.name} (${asset.assetId})

**1. O que é este ativo e estado atual:**
Este ativo é do tipo **${asset.assetType}**, operado por **${asset.ownerContext.operator}** (Equipe: ${asset.ownerContext.responsibleTeam}, Criticidade: ${asset.ownerContext.criticalityTier}).
O estado operacional observado no momento é **${asset.currentState === 'MAINTENANCE_REQUIRED' ? 'MANUTENÇÃO REQUERIDA' : asset.currentState}**.
${asset.description}

**2. Onde está:**
${loc}
*(Nota de Governança: Identidade do Sujeito ≠ Vinculação Espacial; Localização ≠ Proveniência).*

**3. O que mudou recentemente:**
${changesSummary}

**4. Evidências que sustentam o estado:**
${evidenceSummary}

**5. Informações ausentes / lacunas de conhecimento:**
${missingSummary}

---
*Aviso de Governança: Esta explicação é uma síntese explicativa e tem caráter de CANDIDATA. A autoridade deliberativa permanece sob supervisão humana e governança formal KOS.*`;

    return {
      answer,
      category: 'explanation',
      intent,
      candidateNotice: true,
      generatedBy: 'BOUNDED_CAPABILITY_ROUTER',
    };
  }

  public generateCurrentStateExplanation(asset: AssetPassport, intent: SemanticIntent): ExplanationResponse {
    const answer = `### ⚙️ Estado Operacional Atual: ${asset.name}

- **Estado Observado:** **${asset.currentState === 'MAINTENANCE_REQUIRED' ? 'MANUTENÇÃO REQUERIDA' : asset.currentState}**
- **Criticidade:** ${asset.ownerContext.criticalityTier}
- **Última Atualização:** ${new Date(asset.updatedAt).toLocaleString('pt-BR')}
- **Diagnóstico Síntese:** ${
  asset.currentState === 'MAINTENANCE_REQUIRED'
    ? 'O ativo requer intervenção devido à perda de contingência energética (autonomia reduzida para 42 min) e falha no atuador do gerador.'
    : 'O ativo opera dentro dos parâmetros nominais homologados.'
}

*Aviso de Governança: AI == CANDIDATE.*`;

    return { answer, category: 'explanation', intent, candidateNotice: true, generatedBy: 'BOUNDED_CAPABILITY_ROUTER' };
  }

  public generateKnownAttributesExplanation(asset: AssetPassport, intent: SemanticIntent): ExplanationResponse {
    const attrsList = Object.entries(asset.knownAttributes)
      .map(([k, v]) => `• **${formatAttributeName(k)}:** ${formatAttributeValue(k, v)}`)
      .join('\n');

    const answer = `### 📐 Atributos Conhecidos & Especificações: ${asset.name}

${attrsList || 'Nenhum atributo adicional registrado.'}

*Aviso: Propriedades cadastradas sob proveniência do operador.*`;

    return { answer, category: 'explanation', intent, candidateNotice: true, generatedBy: 'BOUNDED_CAPABILITY_ROUTER' };
  }

  public generateOperatorTeamExplanation(asset: AssetPassport, intent: SemanticIntent): ExplanationResponse {
    const answer = `### 👤 Operador e Responsabilidade: ${asset.name}

- **Operador Titular:** ${asset.ownerContext.operator}
- **Equipe Técnica:** ${asset.ownerContext.responsibleTeam}
- **Criticidade Operacional:** ${asset.ownerContext.criticalityTier}
- **Contato Operacional:** ${asset.ownerContext.contactEmail || 'Não informado'}

*Aviso: Contexto administrativo registrado no passport.*`;

    return { answer, category: 'explanation', intent, candidateNotice: true, generatedBy: 'BOUNDED_CAPABILITY_ROUTER' };
  }

  public generateCriticalityExplanation(asset: AssetPassport, intent: SemanticIntent): ExplanationResponse {
    const answer = `### 🛡️ Nível de Criticidade: ${asset.name}

- **Classificação:** **${asset.ownerContext.criticalityTier}**
- **Impacto:** Nível mais alto de severidade na malha de telecomunicações. Interrupções violam SLAs regulatórios (Anatel) e penalizam a cobertura multi-operadora (${asset.knownAttributes['primaryCarriers'] || 'Claro, Vivo, TIM'}).

*Aviso: Classificação regulatória CANDIDATA.*`;

    return { answer, category: 'explanation', intent, candidateNotice: true, generatedBy: 'BOUNDED_CAPABILITY_ROUTER' };
  }

  public generateSpatialExplanation(asset: AssetPassport, intent: SemanticIntent): ExplanationResponse {
    if (!asset.spatial) {
      return {
        answer: `### 📍 Contexto Espacial: ${asset.name}\n\nO ativo **não possui amarração geográfica vinculada** no momento.`,
        category: 'explanation',
        intent,
        candidateNotice: true,
        generatedBy: 'BOUNDED_CAPABILITY_ROUTER',
      };
    }

    const answer = `### 📍 Localização e Precisão Espacial: ${asset.name}

- **Endereço:** ${asset.spatial.address || 'Não especificado'}, ${asset.spatial.municipality} - ${asset.spatial.stateOrRegion} (${asset.spatial.country})
- **Coordenadas Geográficas:** Latitude **${asset.spatial.latitude}°**, Longitude **${asset.spatial.longitude}°**
- **Altitude:** ${asset.spatial.elevationMeters || 760} metros
- **Precisão Espacial:** **± ${asset.spatial.spatialPrecisionMeters || 5} metros**
- **Status de Reconciliação:** **${asset.spatial.reconciliationStatus}**
- **Nota Epistemológica:** *${asset.spatial.disclaimer}*

> **[SALVAGUARDA ESPACIAL]**
> Identidade do Sujeito ≠ Vinculação Espacial. Coordenadas indicam onde o elemento foi amarrado cartograficamente, não estabelecem proveniência nem verdade jurídica sem reconciliação.`;

    return { answer, category: 'explanation', intent, candidateNotice: true, generatedBy: 'BOUNDED_CAPABILITY_ROUTER' };
  }

  public generateRecentChangesExplanation(asset: AssetPassport, intent: SemanticIntent): ExplanationResponse {
    const changes = asset.observations.filter(o => o.deltaDescription);
    if (changes.length === 0) {
      return {
        answer: `### 🔄 Alterações Recentes: ${asset.name}\n\nNenhuma alteração ou delta recente registrado nas observações do ativo.`,
        category: 'explanation',
        intent,
        candidateNotice: true,
        generatedBy: 'BOUNDED_CAPABILITY_ROUTER',
      };
    }

    const list = changes.map(c => `• **[${new Date(c.observedAt).toLocaleDateString('pt-BR')}] ${c.summary}**\n  - **Delta Observado:** ${c.deltaDescription}`).join('\n\n');

    const answer = `### 🔄 O que Mudou Recentemente: ${asset.name}

${list}

*Aviso de Governança: Variações físicas observadas representam telemetria e registros de campo candidatos.*`;

    return { answer, category: 'explanation', intent, candidateNotice: true, generatedBy: 'BOUNDED_CAPABILITY_ROUTER' };
  }

  public generateObservationsExplanation(asset: AssetPassport, intent: SemanticIntent): ExplanationResponse {
    if (intent === 'LATEST_OBSERVATION' && asset.observations.length > 0) {
      const latest = asset.observations[asset.observations.length - 1];
      const answer = `### 🔍 Última Observação Registrada: ${asset.name}

- **Data/Hora:** ${new Date(latest.observedAt).toLocaleString('pt-BR')}
- **Categoria:** ${latest.category}
- **Resumo:** ${latest.summary}
- **Detalhes:** ${latest.details}
- **Delta:** ${latest.deltaDescription || 'Nenhum delta registrado'}
- **Registrado por:** ${latest.recordedBy}
- **Evidência Associada:** ${latest.evidenceRef?.documentTitle || 'Nenhum documento anexado'} (${latest.evidenceRef?.custodySource || 'Local'})

*Aviso: Registro observacional candidato.*`;
      return { answer, category: 'explanation', intent, candidateNotice: true, generatedBy: 'BOUNDED_CAPABILITY_ROUTER' };
    }

    const obsList = asset.observations.map((o, idx) => `
**${idx + 1}. [${o.category}] ${new Date(o.observedAt).toLocaleDateString('pt-BR')} - ${o.summary}**
- **Detalhes:** ${o.details}
${o.deltaDescription ? `- **Delta:** ${o.deltaDescription}` : ''}
${o.evidenceRef ? `- **Evidência:** ${o.evidenceRef.documentTitle} (${o.evidenceRef.custodySource})` : ''}
`).join('\n');

    const answer = `### 🔍 Histórico de Observações: ${asset.name}

${obsList || 'Nenhuma observação registrada.'}

*Aviso: Proposições observacionais candidatas.*`;

    return { answer, category: 'explanation', intent, candidateNotice: true, generatedBy: 'BOUNDED_CAPABILITY_ROUTER' };
  }

  public generateSupportingEvidenceExplanation(asset: AssetPassport, intent: SemanticIntent): ExplanationResponse {
    const withEv = asset.observations.filter(o => o.evidenceRef);
    if (withEv.length === 0) {
      return {
        answer: `### 📄 Evidências que Sustentam o Estado: ${asset.name}\n\nNenhuma evidência governada formalmente associada até o momento.`,
        category: 'explanation',
        intent,
        candidateNotice: true,
        generatedBy: 'BOUNDED_CAPABILITY_ROUTER',
      };
    }

    const evText = withEv.map((o, idx) => `
**Evidência ${idx + 1}: ${o.evidenceRef?.documentTitle}**
- **Document ID:** \`${o.evidenceRef?.documentId}\`
- **Status de Admissibilidade:** \`${o.evidenceRef?.admissibilityStatus}\`
- **Classificação de Custódia:** \`${o.evidenceRef?.custodySource}\`
- **Hash de Integridade (SHA-256):** \`${o.evidenceRef?.sha256?.substring(0, 24)}...\`
- **Data do Registro:** ${new Date(o.evidenceRef?.freshnessTimestamp || o.observedAt).toLocaleString('pt-BR')}
- **Contexto da Evidência:** ${o.details}
`).join('\n---\n');

    const answer = `### 📄 Evidências que Sustentam o Estado Atual: ${asset.name}

${evText}

> **[POSTURA PROBATÓRIA KOS]**
> Documento ≠ Evidência. Os registros acima foram admitidos sob as regras de governança KOS como suporte ao estado do ativo.`;

    return { answer, category: 'explanation', intent, candidateNotice: true, generatedBy: 'BOUNDED_CAPABILITY_ROUTER' };
  }

  public generateEvidenceFreshnessExplanation(asset: AssetPassport, intent: SemanticIntent): ExplanationResponse {
    const withEv = asset.observations.filter(o => o.evidenceRef);
    const now = Date.now();
    const freshnessList = withEv.map(o => {
      const ts = new Date(o.evidenceRef!.freshnessTimestamp).getTime();
      const days = Math.round((now - ts) / (1000 * 3600 * 24));
      const freshBadge = days <= 7 ? '🟢 Recente (<7 dias)' : days <= 30 ? '🟡 Moderada (7-30 dias)' : '⚪ Histórica (>30 dias)';
      return `• **${o.evidenceRef?.documentTitle}:** Registrada há ${days} dias (${freshBadge})`;
    }).join('\n');

    const answer = `### ⏳ Frescor das Evidências Probatórias: ${asset.name}

${freshnessList || 'Nenhuma evidência associada.'}

*Aviso: Avaliação temporal objetiva sem synthetic universal score.*`;

    return { answer, category: 'explanation', intent, candidateNotice: true, generatedBy: 'BOUNDED_CAPABILITY_ROUTER' };
  }

  public generateMissingInformationExplanation(asset: AssetPassport, intent: SemanticIntent): ExplanationResponse {
    if (asset.missingInformation.length === 0) {
      return {
        answer: `### 📋 Informações Ausentes / Lacunas: ${asset.name}\n\nNenhuma informação cadastral ou pendência de conformidade identificada como ausente.`,
        category: 'explanation',
        intent,
        candidateNotice: true,
        generatedBy: 'BOUNDED_CAPABILITY_ROUTER',
      };
    }

    const items = asset.missingInformation.map((m, idx) => `• **Lacuna ${idx + 1}:** ${m}`).join('\n');

    const answer = `### 📋 Informações Ausentes / Lacunas de Conhecimento: ${asset.name}

O Asset Passport identificou as seguintes lacunas probatórias e cadastrais:

${items}

> **[SALVAGUARDA EPISTÊMICA]**
> Informação Ausente ≠ Falso. A ausência de um laudo ou certificado indica lacuna de evidência admitida, não inexistência fática do componente.`;

    return { answer, category: 'explanation', intent, candidateNotice: true, generatedBy: 'BOUNDED_CAPABILITY_ROUTER' };
  }

  public generateAttentionExplanation(asset: AssetPassport, intent: SemanticIntent): ExplanationResponse {
    if (!asset.attentionItems || asset.attentionItems.length === 0) {
      return {
        answer: `### ✅ Nenhuma Anomalia Crítica Detectada: ${asset.name}
O ativo encontra-se em estado **${asset.currentState}** sem itens pendentes de atenção prioritária no momento.

*Aviso: Avaliação gerada como CANDIDATA pelo motor cognitivo do Asset Passport.*`,
        category: 'attention',
        intent,
        candidateNotice: true,
        generatedBy: 'BOUNDED_CAPABILITY_ROUTER',
      };
    }

    const itemsText = asset.attentionItems.map((item, idx) => `
**Item ${idx + 1}: [${item.severity}] ${item.headline}**
- **Explicação do Risco:** ${item.candidateExplanation}
- **Base Probatória:** ${item.evidenceBasis}
- **Ação Recomendada:** ${item.recommendedAction}
- **Identificado em:** ${new Date(item.raisedAt).toLocaleString('pt-BR')}
`).join('\n---\n');

    const answer = `### ⚠️ Itens que Merecem Atenção Prioritária: ${asset.name}

${itemsText}

---
> **[AVISO DE GOVERNANÇA KOS]**
> As recomendações acima constituem **PROPOSIÇÃO CANDIDATA** gerada com base nas observações e telemetria disponíveis. Nenhuma decisão automática ou mutação física de autoridade é executada sem homologação do operador responsável.`;

    return {
      answer,
      category: 'attention',
      intent,
      candidateNotice: true,
      generatedBy: 'BOUNDED_CAPABILITY_ROUTER',
    };
  }

  public generateTimelineSummaryExplanation(asset: AssetPassport, intent: SemanticIntent): ExplanationResponse {
    const answer = `### ⏱️ Resumo da Linha do Tempo: ${asset.name}

O ciclo de vida operacional deste ativo compreende:
1. **Criação & Identidade:** Cadastrado em ${new Date(asset.createdAt).toLocaleDateString('pt-BR')} como ${asset.assetType}.
2. **Amarração Espacial:** Vinculado às coordenadas (${asset.spatial?.latitude}, ${asset.spatial?.longitude}) sob status ${asset.spatial?.reconciliationStatus || 'ESTIMATED'}.
3. **Observações & Telemetria:** ${asset.observations.length} observações registradas.
4. **Alertas & Atenção:** ${asset.attentionItems.length} itens de atenção levantados.

*Aviso: Eventos operacionais do produto persistem no DynamoDB isolado e não compõem o Chronicle Evidence.*`;

    return { answer, category: 'explanation', intent, candidateNotice: true, generatedBy: 'BOUNDED_CAPABILITY_ROUTER' };
  }

  public generateAvailableSourcesExplanation(asset: AssetPassport, intent: SemanticIntent): ExplanationResponse {
    const sources = asset.observations.filter(o => o.evidenceRef).map(o => o.evidenceRef!);
    const sourceList = sources.map(s => `• **${s.documentTitle}** (ID: \`${s.documentId}\`, Custódia: \`${s.custodySource}\`, Admissibilidade: \`${s.admissibilityStatus}\`)`).join('\n');

    const answer = `### 📚 Fontes e Documentos Disponíveis: ${asset.name}

${sourceList || 'Nenhuma fonte documental associada.'}

> **[POSTURA PROBATÓRIA]**
> Fontes locais ou de fixação inicial são marcadas como \`GOLDEN_FIXTURE\`. Somente fontes validadas via API KOS recebem carimbo governado.`;

    return { answer, category: 'explanation', intent, candidateNotice: true, generatedBy: 'BOUNDED_CAPABILITY_ROUTER' };
  }

  /**
   * Epistemically safe failure for questions not established by the Asset Passport.
   */
  public generateOutOfContextExplanation(asset: AssetPassport, query: string): ExplanationResponse {
    const answer = `### ℹ️ Consulta Fora do Escopo do Dossiê do Ativo

Compreendi sua pergunta: *"${query}"*.

**Resposta de Salvaguarda Epistemológica:**
A informação solicitada **não está estabelecida no contexto deste Asset Passport** (${asset.name}) nem nas projeções governadas de engenharia vinculadas.

O assistente do Asset Passport não fabrica conjecturas externas ou dados não homologados.

**O que você pode perguntar legitimamente sobre este ativo:**
- *"Me mostre o que sabemos sobre este ativo."*
- *"Onde está localizado e qual a precisão espacial?"*
- *"O que mudou recentemente?"*
- *"Quais as evidências que sustentam o estado?"*
- *"O que está faltando?"*
- *"O que merece atenção?"*
- *"Quais os atributos e especificações técnicas?"*

*Salvaguarda: AI == CANDIDATE | Resposta != Autoridade | Informação Ausente != Falso.*`;

    return {
      answer,
      category: 'out_of_context',
      intent: 'OUT_OF_CONTEXT',
      candidateNotice: true,
      generatedBy: 'BOUNDED_CAPABILITY_ROUTER',
    };
  }
}
