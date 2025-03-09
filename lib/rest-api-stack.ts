import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";

export class RestApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Table
    const moviesTable = new dynamodb.Table(this, "MoviesTable", {
      partitionKey: { name: "movieId", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Lambda Functions
    const getAllMoviesFn = new lambda.Function(this, "GetAllMoviesFn", {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset("lambdas"),
      handler: "getAllMovies.handler",
      environment: {
        TABLE_NAME: moviesTable.tableName,
        REGION: this.region,
      },
    });

    const getMovieByIdFn = new lambda.Function(this, "GetMovieByIdFn", {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset("lambdas"),
      handler: "getMovieById.handler",
      environment: {
        TABLE_NAME: moviesTable.tableName,
        REGION: this.region,
      },
    });

    const addMovieFn = new lambdanode.NodejsFunction(this, "AddMovieFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: `${__dirname}/../lambdas/addMovie.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: moviesTable.tableName,
        REGION: "eu-west-1",
      },
    });

    // Permissions
    moviesTable.grantReadData(getAllMoviesFn);
    moviesTable.grantReadData(getMovieByIdFn);
    moviesTable.grantReadWriteData(addMovieFn);

    // REST API
    const api = new apig.RestApi(this, "RestAPI", {
      description: "demo api",
      deployOptions: {
        stageName: "dev",
      },
      defaultCorsPreflightOptions: {
        allowHeaders: ["Content-Type", "X-Amz-Date"],
        allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
        allowCredentials: true,
        allowOrigins: ["*"],
      },
    });

    // Movies endpoint
    const moviesEndpoint = api.root.addResource("movies");
    moviesEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getAllMoviesFn, { proxy: true })
    );
    moviesEndpoint.addMethod(
      "POST",
      new apig.LambdaIntegration(addMovieFn, { proxy: true })
    );

    // Detail movie endpoint
    const specificMovieEndpoint = moviesEndpoint.addResource("{movieId}");
    specificMovieEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getMovieByIdFn, { proxy: true })
    );
  }
}