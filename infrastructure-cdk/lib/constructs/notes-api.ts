import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import * as path from 'path';

export interface NotesApiProps {
  api: apigateway.RestApi;
  userPool: cognito.UserPool;
  mainTable: dynamodb.Table;
  environment: string;
  audioBucket: s3.Bucket;
  openaiSecret: secretsmanager.Secret;
  eventBusName: string;
}

export class NotesApi extends Construct {
  public readonly functions: { [key: string]: lambda.Function } = {};

  constructor(scope: Construct, id: string, props: NotesApiProps) {
    super(scope, id);

    const { api, userPool, mainTable, environment, audioBucket, openaiSecret, eventBusName } = props;

    // Common environment variables
    const commonEnv = {
      TABLE_NAME: mainTable.tableName,
      ENVIRONMENT: environment,
      AUDIO_BUCKET_NAME: audioBucket.bucketName,
      OPENAI_SECRET_NAME: openaiSecret.secretName,
      EVENT_BUS_NAME: eventBusName,
    };

    // Lambda execution role for notes functions
    const notesLambdaRole = new iam.Role(this, 'NotesLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Add Cognito permissions
    notesLambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['cognito-idp:GetUser'],
      resources: [userPool.userPoolArn],
    }));

    // Add EventBridge permissions
    notesLambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['events:PutEvents'],
      resources: [`arn:aws:events:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:event-bus/${eventBusName}`],
    }));

    // Grant DynamoDB and S3 permissions
    mainTable.grantReadWriteData(notesLambdaRole);
    audioBucket.grantRead(notesLambdaRole);
    openaiSecret.grantRead(notesLambdaRole);

    // Create Cognito authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'NotesAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: 'NotesCognitoAuthorizer',
    });

    // Create Lambda functions
    this.functions.getNoteFunction = new lambda.Function(this, 'GetNoteFunction', {
      functionName: `ai-scribe-${environment}-get-note`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handlers/notes/get-note.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/dist')),
      environment: commonEnv,
      role: notesLambdaRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    this.functions.updateNoteFunction = new lambda.Function(this, 'UpdateNoteFunction', {
      functionName: `ai-scribe-${environment}-update-note`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handlers/notes/update-note.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/dist')),
      environment: commonEnv,
      role: notesLambdaRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    this.functions.signNoteFunction = new lambda.Function(this, 'SignNoteFunction', {
      functionName: `ai-scribe-${environment}-sign-note`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handlers/notes/sign-note.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/dist')),
      environment: commonEnv,
      role: notesLambdaRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    this.functions.getEncounterNotesFunction = new lambda.Function(this, 'GetEncounterNotesFunction', {
      functionName: `ai-scribe-${environment}-get-encounter-notes`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handlers/notes/get-encounter-notes.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/dist')),
      environment: commonEnv,
      role: notesLambdaRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    this.functions.getNoteHistoryFunction = new lambda.Function(this, 'GetNoteHistoryFunction', {
      functionName: `ai-scribe-${environment}-get-note-history`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handlers/notes/get-note-history.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/dist')),
      environment: commonEnv,
      role: notesLambdaRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    this.functions.updateICD10CodesFunction = new lambda.Function(this, 'UpdateICD10CodesFunction', {
      functionName: `ai-scribe-${environment}-update-icd10-codes`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handlers/notes/update-icd10-codes.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/dist')),
      environment: commonEnv,
      role: notesLambdaRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    this.functions.updateCPTCodesFunction = new lambda.Function(this, 'UpdateCPTCodesFunction', {
      functionName: `ai-scribe-${environment}-update-cpt-codes`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handlers/notes/update-cpt-codes.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/dist')),
      environment: commonEnv,
      role: notesLambdaRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    this.functions.manualGenerateNoteFunction = new lambda.Function(this, 'ManualGenerateNoteFunction', {
      functionName: `ai-scribe-${environment}-manual-generate-note`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handlers/notes/manual-generate-note.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/dist')),
      environment: commonEnv,
      role: notesLambdaRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    // Create API Gateway resources and methods

    // /notes resource
    const notesResource = api.root.addResource('notes');

    // /notes/{noteId} resource
    const noteResource = notesResource.addResource('{noteId}');

    // GET /notes/{noteId}
    noteResource.addMethod('GET', new apigateway.LambdaIntegration(this.functions.getNoteFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // PATCH /notes/{noteId}
    noteResource.addMethod('PATCH', new apigateway.LambdaIntegration(this.functions.updateNoteFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // POST /notes/{noteId}/sign
    const signResource = noteResource.addResource('sign');
    signResource.addMethod('POST', new apigateway.LambdaIntegration(this.functions.signNoteFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // GET /notes/{noteId}/history
    const historyResource = noteResource.addResource('history');
    historyResource.addMethod('GET', new apigateway.LambdaIntegration(this.functions.getNoteHistoryFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // PATCH /notes/{noteId}/codes/icd10
    const codesResource = noteResource.addResource('codes');
    const icd10Resource = codesResource.addResource('icd10');
    icd10Resource.addMethod('PATCH', new apigateway.LambdaIntegration(this.functions.updateICD10CodesFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // PATCH /notes/{noteId}/codes/cpt
    const cptResource = codesResource.addResource('cpt');
    cptResource.addMethod('PATCH', new apigateway.LambdaIntegration(this.functions.updateCPTCodesFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /encounters/{encounterId}/notes resource
    const encountersResource = api.root.getResource('encounters') || api.root.addResource('encounters');
    const encounterResource = encountersResource.getResource('{encounterId}') || encountersResource.addResource('{encounterId}');
    const encounterNotesResource = encounterResource.addResource('notes');

    // GET /encounters/{encounterId}/notes
    encounterNotesResource.addMethod('GET', new apigateway.LambdaIntegration(this.functions.getEncounterNotesFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // POST /encounters/{encounterId}/generate-note
    const generateNoteResource = encounterResource.addResource('generate-note');
    generateNoteResource.addMethod('POST', new apigateway.LambdaIntegration(this.functions.manualGenerateNoteFunction), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Add CORS to all resources
    this.addCorsOptions(notesResource);
    this.addCorsOptions(noteResource);
    this.addCorsOptions(signResource);
    this.addCorsOptions(historyResource);
    this.addCorsOptions(codesResource);
    this.addCorsOptions(icd10Resource);
    this.addCorsOptions(cptResource);
    this.addCorsOptions(encounterNotesResource);
    this.addCorsOptions(generateNoteResource);
  }

  private addCorsOptions(resource: apigateway.Resource) {
    resource.addMethod('OPTIONS', new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
          'method.response.header.Access-Control-Allow-Origin': "'*'",
          'method.response.header.Access-Control-Allow-Credentials': "'false'",
          'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,GET,PUT,POST,DELETE,PATCH,HEAD'",
        },
      }],
      passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_MATCH,
      requestTemplates: {
        'application/json': '{"statusCode": 200}',
      },
    }), {
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': true,
          'method.response.header.Access-Control-Allow-Methods': true,
          'method.response.header.Access-Control-Allow-Credentials': true,
          'method.response.header.Access-Control-Allow-Origin': true,
        },
      }],
    });
  }
}