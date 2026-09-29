import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  Stack,
  StackProps,
  CfnOutput,
  Duration,
  RemovalPolicy,
  aws_s3 as s3,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_cognito as cognito,
  aws_dynamodb as dynamodb,
  aws_lambda_nodejs as lambdaNodejs,
  aws_lambda as lambda,
  aws_apigatewayv2 as apigw2,
  aws_apigatewayv2_integrations as integrations,
  aws_apigatewayv2_authorizers as authorizers,
  aws_iam as iam,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AssetPassportStack extends Stack {
  public readonly webBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly stateTable: dynamodb.Table;
  public readonly apiHandler: lambdaNodejs.NodejsFunction;
  public readonly httpApi: apigw2.HttpApi;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 1. S3 Web Bucket for React SPA
    this.webBucket = new s3.Bucket(this, 'AssetPassportWebBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // 2. CloudFront Distribution for Web SPA
    this.distribution = new cloudfront.Distribution(this, 'AssetPassportWebDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.seconds(0),
        },
      ],
    });

    // 3. Cognito User Pool & Web Client
    this.userPool = new cognito.UserPool(this, 'AssetPassportUserPool', {
      userPoolName: 'KosAssetPassport-UserPool',
      selfSignUpEnabled: false,
      signInAliases: { email: true, username: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: false,
        requireUppercase: false,
        requireDigits: true,
        requireSymbols: false,
      },
      customAttributes: {
        tenant_id: new cognito.StringAttribute({ mutable: true }),
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.userPoolClient = new cognito.UserPoolClient(this, 'AssetPassportWebClient', {
      userPool: this.userPool,
      userPoolClientName: 'KosAssetPassport-WebClient',
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
    });

    // 4. DynamoDB Single Table for isolated product events & state
    this.stateTable = new dynamodb.Table(this, 'StateTable', {
      tableName: 'KosAssetPassport-dev-StateTable',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // 5. Lambda API Handler
    this.apiHandler = new lambdaNodejs.NodejsFunction(this, 'ApiHandler', {
      functionName: 'KosAssetPassport-dev-ApiHandler',
      entry: path.join(__dirname, '../../../src/api/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: Duration.seconds(60),
      memorySize: 1024,
      environment: {
        TABLE_NAME: this.stateTable.tableName,
        BEDROCK_MODEL_ID: 'anthropic.claude-3-haiku-20240307-v1:0',
        BEDROCK_REGION: 'sa-east-1',
        EVIDENCE_API_URL: 'https://brgkao1ln5.execute-api.sa-east-1.amazonaws.com',
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
        format: lambdaNodejs.OutputFormat.ESM,
        banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
      },
    });

    // Permissions for DynamoDB & Bedrock
    this.stateTable.grantReadWriteData(this.apiHandler);
    this.apiHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: ['*'],
      })
    );

    // 6. API Gateway HTTP API (v2)
    const authorizer = new authorizers.HttpUserPoolAuthorizer('AssetPassportAuthorizer', this.userPool, {
      userPoolClients: [this.userPoolClient],
    });

    const lambdaIntegration = new integrations.HttpLambdaIntegration('AssetPassportApiIntegration', this.apiHandler);

    this.httpApi = new apigw2.HttpApi(this, 'HttpApi', {
      apiName: 'KosAssetPassport-dev-HttpApi',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [
          apigw2.CorsHttpMethod.GET,
          apigw2.CorsHttpMethod.POST,
          apigw2.CorsHttpMethod.PUT,
          apigw2.CorsHttpMethod.DELETE,
          apigw2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Tenant-Id'],
        maxAge: Duration.days(1),
      },
    });

    // Default route with Cognito authorizer
    this.httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [
        apigw2.HttpMethod.GET,
        apigw2.HttpMethod.POST,
        apigw2.HttpMethod.PUT,
        apigw2.HttpMethod.DELETE,
      ],
      integration: lambdaIntegration,
      authorizer: authorizer,
    });

    // Unauthenticated health check route
    this.httpApi.addRoutes({
      path: '/health',
      methods: [apigw2.HttpMethod.GET],
      integration: lambdaIntegration,
    });

    // 7. Stack Outputs
    new CfnOutput(this, 'WebUrl', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'Public CloudFront HTTPS URL for Asset Passport SPA',
    });

    new CfnOutput(this, 'ApiUrl', {
      value: this.httpApi.url || '',
      description: 'API Gateway HTTP API URL',
    });

    new CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new CfnOutput(this, 'DynamoDbTable', {
      value: this.stateTable.tableName,
      description: 'DynamoDB Product Table Name',
    });

    new CfnOutput(this, 'WebBucketName', {
      value: this.webBucket.bucketName,
      description: 'S3 Web Bucket Name',
    });

    new CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID',
    });
  }
}
