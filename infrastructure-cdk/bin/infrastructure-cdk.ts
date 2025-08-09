#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AiScribeStack } from '../lib/ai-scribe-stack';

const app = new cdk.App();

// Get configuration from context or environment variables
const stage = app.node.tryGetContext('stage') || process.env.STAGE || 'dev';
const alertEmail = app.node.tryGetContext('alertEmail') || process.env.ALERT_EMAIL || 'alerts@healthspaceai.com';
const domainName = app.node.tryGetContext('domainName') || process.env.DOMAIN_NAME;

new AiScribeStack(app, `ai-scribe-${stage}`, {
  stage,
  alertEmail,
  domainName,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  tags: {
    Environment: stage,
    Project: 'AI-Scribe',
    ManagedBy: 'CDK',
    HIPAA: 'true',
  },
});