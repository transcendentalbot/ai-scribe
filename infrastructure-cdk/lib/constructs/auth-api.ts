import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
// import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';

export interface AuthApiProps {
  api: apigateway.RestApi;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  mainTable: dynamodb.Table;
  environment: string;
}

export class AuthApi extends Construct {
  public readonly authFunctions: { [key: string]: lambda.Function } = {};

  constructor(scope: Construct, id: string, props: AuthApiProps) {
    super(scope, id);

    const { api, userPool, userPoolClient, mainTable, environment } = props;

    // Common environment variables for all auth functions
    const commonEnv = {
      USER_POOL_ID: userPool.userPoolId,
      USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      TABLE_NAME: mainTable.tableName,
      ENVIRONMENT: environment,
    };

    // Lambda execution role
    const lambdaRole = new iam.Role(this, 'AuthLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Add Cognito permissions
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminSetUserPassword',
        'cognito-idp:AdminInitiateAuth',
        'cognito-idp:AdminRespondToAuthChallenge',
        'cognito-idp:AdminGetUser',
        'cognito-idp:AdminUpdateUserAttributes',
        'cognito-idp:GetUser',
        'cognito-idp:GlobalSignOut',
        'cognito-idp:InitiateAuth',
        'cognito-idp:RespondToAuthChallenge',
        'cognito-idp:ForgotPassword',
        'cognito-idp:ConfirmForgotPassword',
      ],
      resources: [userPool.userPoolArn],
    }));

    // Create Lambda functions
    const authHandlers = [
      { name: 'register', path: 'register', method: 'POST', public: true },
      { name: 'login', path: 'login', method: 'POST', public: true },
      { name: 'refresh', path: 'refresh', method: 'POST', public: true },
      { name: 'logout', path: 'logout', method: 'POST', public: false },
      { name: 'me', path: 'me', method: 'GET', public: false },
      { name: 'forgot-password', path: 'forgot-password', method: 'POST', public: true },
      { name: 'confirm-forgot-password', path: 'confirm-forgot-password', method: 'POST', public: true },
    ];

    // Create auth resource
    const authResource = api.root.addResource('auth');

    // Create Cognito authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'AuthApiAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: 'AuthCognitoAuthorizer',
    });

    authHandlers.forEach(handler => {
      // Create Lambda function
      const lambdaFunction = new lambda.Function(this, `${handler.name}Function`, {
        functionName: `ai-scribe-${environment}-auth-${handler.name}`,
        code: lambda.Code.fromAsset(path.join(__dirname, '../../..', 'backend/dist')),
        handler: `handlers/auth/${handler.name}.handler`,
        runtime: lambda.Runtime.NODEJS_18_X,
        timeout: cdk.Duration.seconds(30),
        memorySize: 256,
        environment: commonEnv,
        role: lambdaRole,
      });

      // Grant DynamoDB permissions
      mainTable.grantReadWriteData(lambdaFunction);

      // Store function reference
      this.authFunctions[handler.name] = lambdaFunction;

      // Add API Gateway integration
      const integration = new apigateway.LambdaIntegration(lambdaFunction);
      
      // Create resource and method
      const resource = authResource.addResource(handler.path);
      
      const methodOptions: apigateway.MethodOptions = {
        authorizationType: handler.public ? apigateway.AuthorizationType.NONE : apigateway.AuthorizationType.COGNITO,
        authorizer: handler.public ? undefined : authorizer,
      };

      resource.addMethod(handler.method, integration, methodOptions);
    });
  }
}