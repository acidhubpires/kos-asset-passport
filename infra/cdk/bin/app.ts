#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { AssetPassportStack } from '../lib/asset-passport-stack';

const app = new App();

new AssetPassportStack(app, 'KosAssetPassport-dev', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT || '155288859127',
    region: process.env.CDK_DEFAULT_REGION || 'sa-east-1',
  },
  description: 'KOS Asset Passport isolated product projection stack (sa-east-1)',
});

app.synth();
