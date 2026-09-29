# Integration Boundaries & Authority Separation

**Authorship:** PIRESAAO / ACIDHUB KOS
**Product:** KOS Asset Passport
**Date:** 2026-09-29

---

## Authoritative Policy

1. **Inventory != Deployment Authority:**
   The resources observed in `aws-inventory` reflect discovered baseline infrastructure, not ownership by Asset Passport.
2. **No Mutation of Existing KOS Resources:**
   Asset Passport does not modify or write to:
   - `KosEvidencePlatform-dev` (Tables, Lambdas, Buckets, Queues, Routes)
   - `KosProjectFoundry-dev` / `KosProjectFoundryRoutes-dev`
   - `KosStudio-dev`
   - `KosAximiaSyla-dev`
   - `kos-guarantee-passport`
   - `kos-assurance-monitor`
3. **No Direct Physical Coupling:**
   Asset Passport connects to KOS Evidence strictly via documented API contracts (`https://brgkao1ln5.execute-api.sa-east-1.amazonaws.com`), never directly to Evidence DynamoDB tables or S3 buckets.

---

## Actual Integration vs. Reused Pattern

| System | Actual Integration (Read-Only) | Reused Pattern (Isolated) |
|---|---|---|
| **KOS Evidence Platform** | Reads governed subject projections and artifact admissibility metadata via HTTP API (`brgkao1ln5`). | Employs single-table DynamoDB and API Gateway HTTP API v2 patterns. |
| **KOS Foundry** | *None directly coupled.* | Reused tenant-isolation and capability projection patterns. |
| **KOS Studio** | *None directly coupled.* | Reused candidate AI synthesis pattern. |
| **Local Adapter** | High-fidelity deterministic fallback for offline, testing, and decoupled operation. | N/A |

---

## Epistemological & Architectural Axioms

```
+-------------------------------------------------------------------------+
|                          KOS GOVERNANCE AXIOMS                          |
|  KOS                 !=  Runtime != Deployment != Product != DomainApp  |
|  SharedIdentity      !=  SharedAuthorization != SharedState             |
|  CapabilityIdentity  !=  DeploymentLocation                             |
|  SubjectIdentity     !=  SpatialBinding                                 |
|  Document            !=  Evidence                                       |
|  Location            !=  Provenance                                     |
|  ObservedDrift       !=  ImmediateGlobalRefactor                        |
|  BranchExistence     !=  CanonicalPromotion                             |
|  SelfReorganization  !=  SelfAuthorization                              |
|  ReusablePattern     !=  SharedAuthority                                |
|  AI Inference        ==  CANDIDATE ONLY (Never Authority)               |
|  Product Events      !=  Evidence Chronicle                             |
+-------------------------------------------------------------------------+
```

See [KOS End-of-Day Architectural Handoff](KOS_ARCHITECTURAL_HANDOFF_2026_09_29.md) for full taxonomy and consolidation.
