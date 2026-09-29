import { AssetPassport, ChatMessage } from '../types';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

export interface ExplanationResponse {
  answer: string;
  category: 'explanation' | 'attention' | 'general';
  candidateNotice: boolean;
  generatedBy: 'BEDROCK_AI' | 'DETERMINISTIC_CANDIDATE_SYNTHESIS';
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
   * Generates candidate-only natural language explanations for Asset Passport queries.
   */
  public async respondToQuery(asset: AssetPassport, query: string): Promise<ExplanationResponse> {
    const normalized = query.toLowerCase().trim();

    if (
      normalized.includes('o que sabemos') ||
      normalized.includes('me mostre o que sabemos') ||
      normalized.includes('o que sabemos sobre') ||
      normalized.includes('explique este ativo') ||
      normalized.includes('estado atual')
    ) {
      return this.generateKnownStateExplanation(asset);
    }

    if (
      normalized.includes('merece atenção') ||
      normalized.includes('o que merece atenção') ||
      normalized.includes('atenção') ||
      normalized.includes('risco') ||
      normalized.includes('problema') ||
      normalized.includes('alerta')
    ) {
      return this.generateAttentionExplanation(asset);
    }

    // Attempt Bedrock call if configured, otherwise provide contextual answer
    if (this.bedrockClient && process.env.AWS_EXECUTION_ENV) {
      try {
        const bedrockAnswer = await this.invokeBedrock(asset, query);
        if (bedrockAnswer) {
          return {
            answer: bedrockAnswer,
            category: 'general',
            candidateNotice: true,
            generatedBy: 'BEDROCK_AI',
          };
        }
      } catch (err: any) {
        console.warn(`[AssetReasoner] Bedrock invocation fallback: ${err.message}`);
      }
    }

    return this.generateGeneralDossierAnswer(asset, query);
  }

  /**
   * Explains current known state, missing information, recent changes, and evidence support
   */
  public generateKnownStateExplanation(asset: AssetPassport): ExplanationResponse {
    const loc = asset.spatial
      ? `${asset.spatial.address || 'Coordenadas'}, ${asset.spatial.municipality || ''} (${asset.spatial.latitude}, ${asset.spatial.longitude})`
      : 'Localização geográfica não vinculada';

    const recentObs = asset.observations.slice(-2);
    const changesSummary = recentObs.length > 0
      ? recentObs.map(o => `• [${new Date(o.observedAt).toLocaleDateString('pt-BR')}] ${o.summary}${o.deltaDescription ? ` -> ${o.deltaDescription}` : ''}`).join('\n')
      : 'Nenhuma alteração recente registrada.';

    const evidenceSummary = asset.observations
      .filter(o => o.evidenceRef)
      .map(o => `• ${o.evidenceRef?.documentTitle} (Status: ${o.evidenceRef?.admissibilityStatus}, Fonte: ${o.evidenceRef?.custodySource})`)
      .join('\n') || 'Nenhuma evidência governada formalmente associada.';

    const missingSummary = asset.missingInformation.length > 0
      ? asset.missingInformation.map(m => `• ${m}`).join('\n')
      : 'Nenhuma pendência cadastral conhecida.';

    const answer = `### 📋 Dossiê Vivo: ${asset.name} (${asset.assetId})

**1. O que é este ativo e estado atual:**
Este ativo é do tipo **${asset.assetType}**, operado por **${asset.ownerContext.operator}** (Equipe: ${asset.ownerContext.responsibleTeam}, Criticidade: ${asset.ownerContext.criticalityTier}).
O estado operacional observado no momento é **${asset.currentState}**.
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
      candidateNotice: true,
      generatedBy: 'DETERMINISTIC_CANDIDATE_SYNTHESIS',
    };
  }

  /**
   * Candidate-only explanation for "O que merece atenção?"
   */
  public generateAttentionExplanation(asset: AssetPassport): ExplanationResponse {
    if (!asset.attentionItems || asset.attentionItems.length === 0) {
      return {
        answer: `### ✅ Nenhuma anomalia crítica imediata detectada
O ativo **${asset.name}** encontra-se em estado **${asset.currentState}** sem itens pendentes de atenção prioritária no momento.

*Aviso: Avaliação gerada como CANDIDATA pelo motor cognitivo do Asset Passport.*`,
        category: 'attention',
        candidateNotice: true,
        generatedBy: 'DETERMINISTIC_CANDIDATE_SYNTHESIS',
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
      candidateNotice: true,
      generatedBy: 'DETERMINISTIC_CANDIDATE_SYNTHESIS',
    };
  }

  private generateGeneralDossierAnswer(asset: AssetPassport, query: string): ExplanationResponse {
    return {
      answer: `Compreendi sua pergunta sobre **${asset.name}**: "${query}".

No momento, temos registradas **${asset.observations.length} observações**, **${asset.attentionItems.length} alertas de atenção** e estado operacional **${asset.currentState}**.

Você pode perguntar diretamente:
- *"Me mostre o que sabemos sobre este ativo."*
- *"O que merece atenção?"*
- *"Onde está localizado e qual a precisão espacial?"*

*Aviso: Proposição candidata.*`,
      category: 'general',
      candidateNotice: true,
      generatedBy: 'DETERMINISTIC_CANDIDATE_SYNTHESIS',
    };
  }

  private async invokeBedrock(asset: AssetPassport, prompt: string): Promise<string | null> {
    if (!this.bedrockClient) return null;

    const systemPrompt = `Você é o assistente inteligente do KOS Asset Passport. 
Explique o ativo como um dossiê vivo e explicável para usuários não-técnicos. 
Lembre-se: AI permanece estritamente CANDIDATE (nunca afirme autoridade final). 
Dados do ativo: ${JSON.stringify(asset)}`;

    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    };

    const cmd = new InvokeModelCommand({
      modelId: this.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: Buffer.from(JSON.stringify(payload)),
    });

    const res = await this.bedrockClient.send(cmd);
    const resBody = JSON.parse(Buffer.from(res.body).toString('utf-8'));
    return resBody.content?.[0]?.text || null;
  }
}
