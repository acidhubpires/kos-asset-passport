# Deployment Guide: KOS Asset Passport

**Authorship:** PIRESAAO / ACIDHUB KOS  
**Product:** KOS Asset Passport  
**Date:** 2026-09-29  
**Region:** `sa-east-1`  

---

## Infrastructure Topology

The stack `KosAssetPassport-dev` is deployed entirely within `sa-east-1` in account `155288859127`:

1. **Edge:** CloudFront distribution connected via Origin Access Control (OAC) to an isolated S3 Web Bucket.
2. **API:** API Gateway HTTP API v2 with JWT authorizer linked to Cognito User Pool.
3. **Compute:** AWS Lambda function (`NodejsFunction`, Node.js 20 ESM).
4. **Data:** DynamoDB Single-Table (`KosAssetPassport-dev-StateTable`).
5. **Auth:** Cognito User Pool (`KosAssetPassport-UserPool`) and Web Client (`KosAssetPassport-WebClient`).

---

## Deployment Commands

### Prerequisites
- Node.js >= 20.x
- pnpm >= 10.x
- AWS CLI configured with profile `kos-project-foundry-dev`

### Synthesize
```bash
npx cdk synth --app "tsx infra/cdk/bin/app.ts" --profile kos-project-foundry-dev --region sa-east-1
```

### Deploy Stack
```bash
npx cdk deploy KosAssetPassport-dev --app "tsx infra/cdk/bin/app.ts" --profile kos-project-foundry-dev --region sa-east-1 --require-approval never
```

### Build & Deploy Web SPA
```bash
pnpm run build
aws s3 sync dist/ s3://<WebBucketName>/ --delete --profile kos-project-foundry-dev --region sa-east-1
aws cloudfront create-invalidation --distribution-id <DistributionId> --paths "/*" --profile kos-project-foundry-dev
```
