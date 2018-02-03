# Serverless IAM Roles Per Function Plugin
[![serverless][sls-image]][sls-url] [![npm package][npm-image]][npm-url]

A Serverless plugin to easily define IAM roles per function via the use of `iamRoleStatements` at the function definition block. 

## Installation
```
npm install --save-dev serverless-iam-roles-per-function
```

Add the plugin to serverless.yml:

```yaml
plugins:
  - serverless-iam-roles-per-function
```

**Note**: Node 6.10 or higher runtime required.

## Usage

Define `iamRoleStatements` definitions at the function level:

```yaml
functions:
  func1:
    handler: handler.get
    iamRoleStatements:
      - Effect: "Allow"        
        Action:
          - dynamodb:GetItem        
        Resource: "arn:aws:dynamodb:${self:provider.region}:*:table/mytable"
    ...
  func2:
    handler: handler.put
    iamRoleStatements:
      - Effect: "Allow"        
        Action:
          - dynamodb:PutItem        
        Resource: "arn:aws:dynamodb:${self:provider.region}:*:table/mytable"
    ...
```

The plugin will create a dedicated role for each function that has an `iamRoleStatements` definition. It will include the permissions for create and write to CloudWatch logs and if VPC is defined: `AWSLambdaVPCAccessExecutionRole` will be included (as is done when using `iamRoleStatements` at the provider level).

By deafault, function level `iamRoleStatements` override the provider level definition. It is also possible to inherit the provider level definition by specifying the option `iamRoleStatementsInherit`:

```yaml
provider:
  name: aws
  iamRoleStatements:
    - Effect: "Allow"
      Action:
        - xray:PutTelemetryRecords
        - xray:PutTraceSegments
      Resource: "*"
  ...
functions:
  func1:
    handler: handler.get
    iamRoleStatementsInherit: true
    iamRoleStatements:
      - Effect: "Allow"        
        Action:
          - dynamodb:GetItem        
        Resource: "arn:aws:dynamodb:${self:provider.region}:*:table/mytable"
```
The generated role for `func1` will contain both the statements defined at the provider level and the ones defined at the function level.


**Note**: Servless Framework provides support for defining custom IAM roles on a per function level through the use of the `role` property and creating CloudFormation resources, as documented [here](https://serverless.com/framework/docs/providers/aws/guide/iam#custom-iam-roles). This plugin doesn't support defining both the `role` property and `iamRoleStatements` at the function level.

[npm-image]:https://badge.fury.io/js/serverless-iam-roles-per-function.svg
[npm-url]:http://npmjs.org/package/serverless-iam-roles-per-function
[sls-image]:http://public.serverless.com/badges/v3.svg
[sls-url]:http://www.serverless.com