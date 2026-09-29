# KOS Asset Passport

**Product Projection Sprint: 2026-09-29**  
**Repository:** `https://github.com/acidhubpires/kos-asset-passport`  
**Authorship:** PIRESAAO / ACIDHUB KOS  
**KEM/KEK Compatible**  

---

## What is Asset Passport?

Asset Passport delivers an explainable, living digital dossier for real-world infrastructure assets. Instead of presenting raw database records or synthetic scores, Asset Passport answers everyday operational questions:

- **What is this asset?**
- **What do we know about it?**
- **Where is it?**
- **What has changed?**
- **What evidence supports its current state?**
- **What deserves attention?**

---

## Architectural Principles

1. **AI Remains Candidate:** Generative AI generates candidate-only explanations and attention recommendations. Decisional authority remains human and governed.
2. **Epistemic Spatial Separation:**
   - `SubjectIdentity != SpatialBinding`
   - `Document != Evidence`
   - `Location != Provenance`
3. **Operational Event Persistence:** Product events (`ASSET_CREATED`, `OBSERVATION_ADDED`, `LOCATION_BOUND`, `CHANGE_DETECTED`, `ATTENTION_RAISED`, `CHAT_QUERY_RECORDED`) are persisted in the product's DynamoDB single-table and are not part of Evidence Chronicle.
4. **Isolated AWS Stack:** Fully deployed in `sa-east-1` with zero mutation of sibling KOS platforms (Evidence, Foundry, Studio).

---

## Documentation

- [Architecture Specification](docs/ARCHITECTURE.md)
- [Golden Journey (Telecom Site AP-001)](docs/GOLDEN_JOURNEY.md)
- [Integration Boundaries](docs/INTEGRATION_BOUNDARIES.md)
- [Deployment Guide](docs/DEPLOYMENT.md)

---

## Quickstart

```bash
# Install dependencies
pnpm install

# Run unit and integration tests
pnpm test

# Build production bundle
pnpm run build

# Deploy to AWS sa-east-1
npx cdk deploy KosAssetPassport-dev --app "tsx infra/cdk/bin/app.ts" --profile kos-project-foundry-dev --region sa-east-1
```
