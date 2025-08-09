import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as events from 'aws-cdk-lib/aws-events';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';
import { AuthApi } from './constructs/auth-api';
import { PatientEncounterApi } from './constructs/patient-encounter-api';

export interface AiScribeStackProps extends cdk.StackProps {
  stage: string;
  alertEmail: string;
  domainName?: string;
}

export class AiScribeStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly websocketApi: apigatewayv2.WebSocketApi;
  public readonly userPool: cognito.UserPool;
  public readonly mainTable: dynamodb.Table;
  public readonly audioBucket: s3.Bucket;
  public readonly kmsKey: kms.Key;

  constructor(scope: Construct, id: string, props: AiScribeStackProps) {
    super(scope, id, props);

    const { stage, alertEmail, domainName } = props;

    // KMS Key for PHI Encryption
    this.kmsKey = new kms.Key(this, 'PHIEncryptionKey', {
      description: 'Master key for encrypting PHI data',
      alias: `ai-scribe-${stage}-phi`,
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // SNS Topic for alerts
    const alertTopic = new sns.Topic(this, 'AlertTopic', {
      topicName: `ai-scribe-${stage}-alerts`,
      masterKey: kms.Alias.fromAliasName(this, 'SnsKmsAlias', 'alias/aws/sns'),
    });

    alertTopic.addSubscription(new snsSubscriptions.EmailSubscription(alertEmail));

    // DynamoDB Tables
    this.mainTable = new dynamodb.Table(this, 'MainTable', {
      tableName: `ai-scribe-main-${stage}`,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.kmsKey,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      timeToLiveAttribute: 'ttl',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Add GSIs
    this.mainTable.addGlobalSecondaryIndex({
      indexName: 'gsi1',
      partitionKey: { name: 'gsi1pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gsi1sk', type: dynamodb.AttributeType.STRING },
    });

    this.mainTable.addGlobalSecondaryIndex({
      indexName: 'gsi2',
      partitionKey: { name: 'gsi2pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gsi2sk', type: dynamodb.AttributeType.STRING },
    });

    this.mainTable.addGlobalSecondaryIndex({
      indexName: 'entityTypeIndex',
      partitionKey: { name: 'entityType', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
    });

    // Connections Table
    const connectionsTable = new dynamodb.Table(this, 'ConnectionsTable', {
      tableName: `ai-scribe-ws-connections-${stage}`,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.kmsKey,
      timeToLiveAttribute: 'ttl',
      partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
    });

    connectionsTable.addGlobalSecondaryIndex({
      indexName: 'userIdIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
    });

    // Audit Table
    const auditTable = new dynamodb.Table(this, 'AuditTable', {
      tableName: `ai-scribe-audit-logs-${stage}`,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.kmsKey,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      timeToLiveAttribute: 'ttl',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
    });

    auditTable.addGlobalSecondaryIndex({
      indexName: 'userActionIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
    });

    // S3 Buckets
    this.audioBucket = new s3.Bucket(this, 'AudioBucket', {
      bucketName: `ai-scribe-audio-${stage}-${this.account}-v2`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.kmsKey,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          id: 'MoveToIA',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
          expiration: cdk.Duration.days(2555), // 7 years
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST, s3.HttpMethods.HEAD],
          allowedOrigins: ['*'], // Update with specific domains in production
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag', 'x-amz-server-side-encryption', 'x-amz-request-id', 'x-amz-id-2'],
          maxAge: 3600,
        },
      ],
    });

    const auditBucket = new s3.Bucket(this, 'AuditBucket', {
      bucketName: `ai-scribe-audit-logs-${stage}-${this.account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.kmsKey,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectLockEnabled: true,
      lifecycleRules: [
        {
          id: 'ArchiveAuditLogs',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER_INSTANT_RETRIEVAL,
              transitionAfter: cdk.Duration.days(90),
            },
            {
              storageClass: s3.StorageClass.DEEP_ARCHIVE,
              transitionAfter: cdk.Duration.days(365),
            },
          ],
        },
      ],
    });

    // Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `ai-scribe-${stage}`,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(1),
      },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: true,
        otp: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      // advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED, // Requires Plus plan
      customAttributes: {
        provider_id: new cognito.StringAttribute({ mutable: true }),
        license_number: new cognito.StringAttribute({ mutable: true }),
        specialty: new cognito.StringAttribute({ mutable: true }),
        organization: new cognito.StringAttribute({ mutable: true }),
      },
      lambdaTriggers: {
        preSignUp: this.createCognitoTrigger('PreSignUp', stage),
        postAuthentication: this.createCognitoTrigger('PostAuth', stage, {
          AUDIT_TABLE: auditTable.tableName,
        }),
        preAuthentication: this.createCognitoTrigger('PreAuth', stage),
        postConfirmation: this.createCognitoTrigger('PostConfirmation', stage, {
          MAIN_TABLE: this.mainTable.tableName,
        }),
        customMessage: this.createCognitoTrigger('CustomMessage', stage),
      },
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: `ai-scribe-${stage}-client`,
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true,
        custom: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
        callbackUrls: ['http://localhost:3000/callback', 'https://app.aiscribe.health/callback'],
        logoutUrls: ['http://localhost:3000/logout', 'https://app.aiscribe.health/logout'],
      },
      preventUserExistenceErrors: true,
      refreshTokenValidity: cdk.Duration.days(1),
      accessTokenValidity: cdk.Duration.minutes(15),
      idTokenValidity: cdk.Duration.minutes(15),
    });

    // API Gateway
    this.api = new apigateway.RestApi(this, 'RestApi', {
      restApiName: `ai-scribe-${stage}`,
      description: 'AI Scribe REST API',
      binaryMediaTypes: ['audio/*', 'multipart/form-data'],
      endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL],
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
        allowCredentials: true,
      },
    });

    // API Authorizer - create after RestApi
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'ApiAuthorizer', {
      cognitoUserPools: [this.userPool],
      authorizerName: 'CognitoAuthorizer',
    });
    
    // Authentication API
    new AuthApi(this, 'AuthApi', {
      api: this.api,
      userPool: this.userPool,
      userPoolClient: userPoolClient,
      mainTable: this.mainTable,
      environment: stage,
    });

    // Patient & Encounter Management API
    new PatientEncounterApi(this, 'PatientEncounterApi', {
      api: this.api,
      userPool: this.userPool,
      mainTable: this.mainTable,
      environment: stage,
    });
    
    // Attach the authorizer to the API
    (authorizer as any)._attachToApi(this.api);

    // Health check endpoint
    const healthResource = this.api.root.addResource('health');
    healthResource.addMethod('GET', new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: '200',
        responseTemplates: {
          'application/json': JSON.stringify({ status: 'healthy', timestamp: '$context.requestTime' }),
        },
      }],
      requestTemplates: {
        'application/json': JSON.stringify({ statusCode: 200 }),
      },
    }), {
      methodResponses: [{ statusCode: '200' }],
      authorizationType: apigateway.AuthorizationType.NONE,
    });

    // WebSocket API
    this.websocketApi = new apigatewayv2.WebSocketApi(this, 'WebSocketApi', {
      apiName: `ai-scribe-ws-${stage}`,
      routeSelectionExpression: '$request.body.action',
    });

    // WebSocket placeholder handler
    const websocketHandler = new lambda.Function(this, 'WebSocketHandler', {
      functionName: `ai-scribe-${stage}-websocket`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('WebSocket event:', JSON.stringify(event, null, 2));
          return { statusCode: 200, body: 'Connected' };
        };
      `),
      environment: {
        CONNECTIONS_TABLE: connectionsTable.tableName,
      },
    });

    // WebSocket routes
    new apigatewayv2.WebSocketRoute(this, 'ConnectRoute', {
      webSocketApi: this.websocketApi,
      routeKey: '$connect',
      integration: new apigatewayv2Integrations.WebSocketLambdaIntegration('ConnectIntegration', websocketHandler),
    });

    new apigatewayv2.WebSocketRoute(this, 'DisconnectRoute', {
      webSocketApi: this.websocketApi,
      routeKey: '$disconnect',
      integration: new apigatewayv2Integrations.WebSocketLambdaIntegration('DisconnectIntegration', websocketHandler),
    });

    new apigatewayv2.WebSocketRoute(this, 'DefaultRoute', {
      webSocketApi: this.websocketApi,
      routeKey: '$default',
      integration: new apigatewayv2Integrations.WebSocketLambdaIntegration('DefaultIntegration', websocketHandler),
    });

    const webSocketStage = new apigatewayv2.WebSocketStage(this, 'WebSocketStage', {
      webSocketApi: this.websocketApi,
      stageName: stage,
      autoDeploy: true,
    });

    // EventBridge
    const eventBus = new events.EventBus(this, 'EventBus', {
      eventBusName: `ai-scribe-${stage}-event-bus`,
    });

    // CloudTrail
    const trail = new cloudtrail.Trail(this, 'AuditTrail', {
      trailName: `ai-scribe-${stage}-audit`,
      bucket: auditBucket,
      includeGlobalServiceEvents: true,
      isMultiRegionTrail: true,
      enableFileValidation: true,
    });

    // Add data events for S3
    trail.addEventSelector(cloudtrail.DataResourceType.S3_OBJECT, [`${this.audioBucket.bucketArn}/*`]);

    // WAF
    const webAcl = new wafv2.CfnWebACL(this, 'WebACL', {
      name: `ai-scribe-${stage}-waf`,
      description: 'WAF rules for AI Scribe API protection',
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: `ai-scribe-${stage}-waf`,
      },
      rules: [
        {
          name: 'RateLimitRule',
          priority: 1,
          statement: {
            rateBasedStatement: {
              limit: 2000,
              aggregateKeyType: 'IP',
            },
          },
          action: {
            block: {
              customResponse: {
                responseCode: 429,
                customResponseBodyKey: 'RateLimitResponse',
              },
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitRule',
          },
        },
      ],
      customResponseBodies: {
        RateLimitResponse: {
          contentType: 'APPLICATION_JSON',
          content: '{"error": "Too many requests. Please try again later."}',
        },
      },
    });

    // Associate WAF with API Gateway Stage
    const apiStage = this.api.deploymentStage;
    new wafv2.CfnWebACLAssociation(this, 'WebACLAssociation', {
      webAclArn: webAcl.attrArn,
      resourceArn: `arn:aws:apigateway:${this.region}::/restapis/${this.api.restApiId}/stages/${apiStage.stageName}`,
    });

    // SES Email Identity - commented out until domain is verified
    // new ses.EmailIdentity(this, 'EmailIdentity', {
    //   identity: ses.Identity.email(alertEmail),
    //   dkimSigning: true,
    // });

    // Create secrets in Secrets Manager
    const jwtSecret = new secretsmanager.Secret(this, 'JWTSecret', {
      secretName: `${this.stackName}-jwt-secret`,
      description: 'JWT signing secret',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({}),
        generateStringKey: 'secret',
        passwordLength: 32,
      },
    });

    const deepgramSecret = new secretsmanager.Secret(this, 'DeepgramSecret', {
      secretName: `${this.stackName}-deepgram`,
      description: 'Deepgram API key',
    });

    new ssm.StringParameter(this, 'BedrockModelIdParameter', {
      parameterName: `/${this.stackName}/bedrock-model-id`,
      stringValue: 'anthropic.claude-3-sonnet-20240229-v1:0',
    });

    // CloudWatch Dashboard
    const dashboard = new cloudwatch.Dashboard(this, 'MonitoringDashboard', {
      dashboardName: `ai-scribe-${stage}`,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'WebSocketUrl', {
      value: webSocketStage.url,
      description: 'WebSocket API URL',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'MainTableName', {
      value: this.mainTable.tableName,
      description: 'Main DynamoDB table name',
    });

    new cdk.CfnOutput(this, 'AudioBucketName', {
      value: this.audioBucket.bucketName,
      description: 'S3 bucket for audio files',
    });
  }

  private createCognitoTrigger(name: string, stage: string, environment?: { [key: string]: string }): lambda.Function {
    return new lambda.Function(this, `${name}Function`, {
      functionName: `ai-scribe-${stage}-${name.toLowerCase()}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'cognito', name.toLowerCase())),
      environment: environment,
    });
  }
}