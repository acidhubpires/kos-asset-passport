# Golden Journey: Telecom Site AP-001

**Authorship:** PIRESAAO / ACIDHUB KOS  
**Product:** KOS Asset Passport  
**Date:** 2026-09-29  

---

## Journey Overview

The Golden Journey demonstrates how a non-technical operator interacts with a real-world infrastructure asset (**Telecom Site AP-001**) through an explainable, living digital dossier.

---

## 13-Step Execution Sequence

### Step 1: Cognito Authentication
- User authenticates through Cognito User Pool (`KosAssetPassport-UserPool`) via JWT.
- Identity and tenant context (`tenant-default` / `tenant-golden-ap001`) are attached to API requests.

### Step 2: Open / Create Asset Passport
- Asset Passport is created or opened with identity:
  - **Asset ID:** `AP-001`
  - **Name:** `Telecom Site AP-001`
  - **Type:** `TELECOM_TOWER`
  - **Description:** Torre de telecomunicações de transmissão celular 4G/5G com baterias LFP e gerador auxiliar.

### Step 3: Asset Identity & Operator Context
- **Operator:** `AcidHub Telco Infrastructure`
- **Responsible Team:** `Field Operations Southeast / Critical Infrastructure`
- **Criticality Tier:** `TIER_1`
- **Known Attributes:** Tower height 45m, backup LFP 48V + diesel generator 30kVA, carriers: Claro, Vivo, TIM.
- **Missing Information:** Calibration certificate for primary rectifier; 2026 acoustic-environmental report.

### Step 4: Associate Source / Evidence-Backed Observation
- New observation recorded:
  - **Category:** `MAINTENANCE`
  - **Summary:** Alerta de degradação acelerada do banco de baterias de backup e falha no teste de partida do gerador.
  - **Delta:** Autonomia caiu de 8h para 42 minutos; temperatura da sala 48°C.
  - **Governed Source:** `doc-telemetry-2026-09-28` (`Log de Telemetria de Energia #TEL-0928`, SHA256: `9f83c605...`, Admissibility: `ADMISSIBLE`).

### Step 5: Chat-First Interaction (Query 1)
- User asks in natural language:  
  **"Me mostre o que sabemos sobre este ativo."**

### Step 6: Product Explains Living Dossier
- Product returns explainable natural language synthesis:
  1. Current known state & specifications (`MAINTENANCE_REQUIRED`, Tier 1)
  2. Spatial location & precision (`Av. Paulista, 1000`, Lat -23.55052, Lon -46.633308)
  3. Recent changes (battery drop to 42 min)
  4. Evidence support (admissible telemetry doc #TEL-0928)
  5. Missing information gaps
- Marked explicitly as **CANDIDATE**.

### Step 7: Spatial / Context Panel
- Displays geographical coordinates, elevation (760m), and estimated precision (±5m).
- Enforces governance banner:  
  `SubjectIdentity != SpatialBinding; Location != Provenance; Document != Evidence`.

### Step 8: Compact Timeline
- Displays chronological audit trail of operational events:
  - `ASSET_CREATED`
  - `LOCATION_BOUND`
  - `SOURCE_ASSOCIATED`
  - `OBSERVATION_ADDED`
  - `ATTENTION_RAISED`
  - `CHAT_QUERY_RECORDED`

### Step 9: Simple Charts
- **Evidence Freshness:** Fresh (<7 days) vs Historical (>30 days).
- **Observations Over Time:** Monthly distribution.
- **Source Coverage:** Governed Evidence Platform docs vs Operator logs.

### Step 10: User Asks for Attention (Query 2)
- User asks:  
  **"O que merece atenção?"**

### Step 11: Candidate-Only Explanation
- Product returns prioritized candidate explanation:
  - **Severity:** `CRITICAL`
  - **Headline:** Risco iminente de perda de contingência energética (SLA Tier 1 em risco).
  - **Explanation:** Banco de baterias com 42min de autonomia e aquecimento anormal somado à falha do gerador.
  - **Recommended Action:** Despacho emergencial para substituição de células e manutenção mecânica.
  - **No synthetic universal score fabricated.**

### Step 12: Event Persistence in DynamoDB
- All operational events persisted in `KosAssetPassport-dev-StateTable` under partition key `TENANT#<tenantId>`.

### Step 13: Completed Authenticated AWS Golden Journey
- Complete end-to-end verified across API Gateway, Lambda, DynamoDB, Cognito, and CloudFront.
