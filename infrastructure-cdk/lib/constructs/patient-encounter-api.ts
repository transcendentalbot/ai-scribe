import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import * as path from 'path';

export interface PatientEncounterApiProps {
  api: apigateway.RestApi;
  userPool: cognito.UserPool;
  mainTable: dynamodb.Table;
  environment: string;
  audioBucket?: s3.Bucket;
}

export class PatientEncounterApi extends Construct {
  public readonly functions: { [key: string]: lambda.Function } = {};

  constructor(scope: Construct, id: string, props: PatientEncounterApiProps) {
    super(scope, id);

    const { api, userPool, mainTable, environment, audioBucket } = props;

    // Common environment variables
    const commonEnv = {
      TABLE_NAME: mainTable.tableName,
      ENVIRONMENT: environment,
    };

    // Lambda execution role
    const lambdaRole = new iam.Role(this, 'PatientEncounterLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Add Cognito permissions
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['cognito-idp:GetUser'],
      resources: [userPool.userPoolArn],
    }));

    // Create Cognito authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'PatientEncounterAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: 'PatientEncounterCognitoAuthorizer',
    });

    // Patient handlers
    const patientHandlers = [
      { name: 'create-patient', path: 'patients', method: 'POST' },
      { name: 'get-patient', path: 'patients/{patientId}', method: 'GET' },
      { name: 'search-patients', path: 'patients/search', method: 'GET' },
    ];

    // Encounter handlers
    const encounterHandlers = [
      { name: 'create-encounter', path: 'encounters', method: 'POST' },
      { name: 'get-encounter', path: 'encounters/{encounterId}', method: 'GET' },
      { name: 'update-encounter-status', path: 'encounters/{encounterId}/status', method: 'PUT' },
      { name: 'capture-consent', path: 'encounters/{encounterId}/consent', method: 'POST' },
      { name: 'get-daily-encounters', path: 'encounters/daily', method: 'GET' },
    ];

    // Create patient endpoints
    patientHandlers.forEach(handler => {
      const functionName = `ai-scribe-${environment}-patient-${handler.name}`;
      const lambdaFunction = new lambda.Function(this, `${handler.name}Function`, {
        functionName,
        code: lambda.Code.fromAsset(path.join(__dirname, '../../..', 'backend')),
        handler: `dist/handlers/patients/${handler.name}.handler`,
        runtime: lambda.Runtime.NODEJS_18_X,
        timeout: cdk.Duration.seconds(30),
        memorySize: 256,
        environment: commonEnv,
        role: lambdaRole,
      });

      // Grant DynamoDB permissions
      mainTable.grantReadWriteData(lambdaFunction);

      // Store function reference
      this.functions[handler.name] = lambdaFunction;

      // Add API Gateway integration
      const integration = new apigateway.LambdaIntegration(lambdaFunction);
      
      // Create resource path
      const pathParts = handler.path.split('/');
      let currentResource = api.root;
      
      for (const part of pathParts) {
        const existingResource = currentResource.getResource(part);
        currentResource = existingResource || currentResource.addResource(part);
      }

      // Add method with authorization
      currentResource.addMethod(handler.method, integration, {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer: authorizer,
      });
    });

    // Create encounter endpoints
    encounterHandlers.forEach(handler => {
      const functionName = `ai-scribe-${environment}-encounter-${handler.name}`;
      const lambdaFunction = new lambda.Function(this, `${handler.name}Function`, {
        functionName,
        code: lambda.Code.fromAsset(path.join(__dirname, '../../..', 'backend')),
        handler: `dist/handlers/encounters/${handler.name}.handler`,
        runtime: lambda.Runtime.NODEJS_18_X,
        timeout: cdk.Duration.seconds(30),
        memorySize: 256,
        environment: commonEnv,
        role: lambdaRole,
      });

      // Grant DynamoDB permissions
      mainTable.grantReadWriteData(lambdaFunction);

      // Store function reference
      this.functions[handler.name] = lambdaFunction;

      // Add API Gateway integration
      const integration = new apigateway.LambdaIntegration(lambdaFunction);
      
      // Create resource path
      const pathParts = handler.path.split('/');
      let currentResource = api.root;
      
      for (const part of pathParts) {
        const existingResource = currentResource.getResource(part);
        currentResource = existingResource || currentResource.addResource(part);
      }

      // Add method with authorization
      currentResource.addMethod(handler.method, integration, {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer: authorizer,
      });
    });

    // Recording handlers
    if (audioBucket) {
      const recordingHandlers = [
        { name: 'upload', path: 'recordings/upload', method: 'POST' },
        { name: 'get-recordings', path: 'encounters/{encounterId}/recordings', method: 'GET' },
      ];

      recordingHandlers.forEach(handler => {
        const functionName = `ai-scribe-${environment}-recording-${handler.name}`;
        const lambdaFunction = new lambda.Function(this, `recording-${handler.name}Function`, {
          functionName,
          code: lambda.Code.fromAsset(path.join(__dirname, '../../..', 'backend')),
          handler: `dist/handlers/recordings/${handler.name}.handler`,
          runtime: lambda.Runtime.NODEJS_18_X,
          timeout: cdk.Duration.seconds(30),
          memorySize: 256,
          environment: {
            ...commonEnv,
            RECORDINGS_BUCKET: audioBucket.bucketName,
            AUDIO_BUCKET_NAME: audioBucket.bucketName,
          },
          role: lambdaRole,
        });

        // Grant S3 permissions
        audioBucket.grantReadWrite(lambdaFunction);
        
        // Grant DynamoDB permissions
        mainTable.grantReadWriteData(lambdaFunction);

        // Store function reference
        this.functions[`recording-${handler.name}`] = lambdaFunction;

        // Add API Gateway integration
        const integration = new apigateway.LambdaIntegration(lambdaFunction);
        
        // Create resource path
        const pathParts = handler.path.split('/');
        let currentResource = api.root;
        
        for (const part of pathParts) {
          const existingResource = currentResource.getResource(part);
          currentResource = existingResource || currentResource.addResource(part);
        }

        // Add method with authorization
        currentResource.addMethod(handler.method, integration, {
          authorizationType: apigateway.AuthorizationType.COGNITO,
          authorizer: authorizer,
        });
      });
    }
  }
}