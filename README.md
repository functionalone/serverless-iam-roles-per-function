# serverless-granular-iam [*Serverless IAM Roles Per Function Plugin* **Fork**]

[![serverless][sls-image]][sls-url]
[![npm package][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]
[![Coverage Status][coveralls-image]][coveralls-url]
[![Dependencies Status][david-image]][david-url]
[![Downloads][downloads-image]][npm-url]

A Serverless plugin to easily define IAM roles per function via the use of `iamRoleStatements` at the function definition block.

:rotating_light: This is a fork from [functionalone/serverless-granular-iam](https://github.com/functionalone/serverless-granular-iam)
This is meant to be temporary until _iamManagedPolicies_ are supported with [#19](https://github.com/functionalone/serverless-granular-iam/pull/19) landing.

## Installation
```
npm install --save-dev serverless-granular-iam
```

Add the plugin to serverless.yml:

```yaml
plugins:
  - serverless-granular-iam
```

**Note**: Node 6.10 or higher runtime required.

## Usage

Define `iamRoleStatements` definitions at the function level:

```yaml
functions:
  func1:
    handler: handler.get
    iamRoleStatementsName: my-custom-role-name #optional custom role name setting instead of the default generated one
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

The plugin will create a dedicated role for each function that has an `iamRoleStatements` definition. It will include the permissions for create and write to CloudWatch logs, stream events and if VPC is defined: `AWSLambdaVPCAccessExecutionRole` will be included (as is done when using `iamRoleStatements` at the provider level).

if `iamRoleStatements` are not defined at the function level default behavior is maintained and the function will receive the global iam role. It is possible to define an empty `iamRoleStatements` for a function and then the function will receive a dedicated role with only the permissions needed for CloudWatch and (if needed) stream events and VPC. Example of defining a function with empty `iamRoleStatements` and configured VPC. The function will receive a custom role with CloudWatch logs permissions and the policy `AWSLambdaVPCAccessExecutionRole`:

```yaml
functions:
  func1:
    handler: handler.get
    iamRoleStatements: []
    vpc:
      securityGroupIds:
        - sg-xxxxxx
      subnetIds:
        - subnet-xxxx
        - subnet-xxxxx
```

By default, function level `iamRoleStatements` override the provider level definition. It is also possible to inherit the provider level definition by specifying the option `iamRoleStatementsInherit: true`:

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

If you wish to change the default behavior to `inherit` instead of `override` it is possible to specify the following custom configuration:

```yaml
custom:
  serverless-granular-iam:
    defaultInherit: true
```
## Role Names
The plugin uses a naming convention for function roles which is similar to the naming convention used by the Serverless Framework. Function roles are named with the following convention:
```
<service-name>-<stage>-<function-name>-<region>-lambdaRole
```
AWS has a 64 character limit on role names. If the default naming exceeds 64 chars the plugin will remove the suffix: `-lambdaRole` to shorten the name. If it still exceeds 64 chars an error will be thrown containing a message of the form:
```
auto generated role name for function: ${functionName} is too long (over 64 chars).
Try setting a custom role name using the property: iamRoleStatementsName.
```
In this case you should set the role name using the property `iamRoleStatementsName`. For example:
```yaml
functions:
  func1:
    handler: handler.get
    iamRoleStatementsName: my-custom-role-name
    iamRoleStatements:
      - Effect: "Allow"
        Action:
          - dynamodb:GetItem
        Resource: "arn:aws:dynamodb:${self:provider.region}:*:table/mytable"
    ...
```

## More Info

**Introduction post**:
[Serverless Framework: Defining Per-Function IAM Roles](https://medium.com/@glicht/serverless-framework-defining-per-function-iam-roles-c678fa09f46d)


**Note**: Serverless Framework provides support for defining custom IAM roles on a per function level through the use of the `role` property and creating CloudFormation resources, as documented [here](https://serverless.com/framework/docs/providers/aws/guide/iam#custom-iam-roles). This plugin doesn't support defining both the `role` property and `iamRoleStatements` at the function level.

[npm-image]:https://img.shields.io/npm/v/serverless-granular-iam.svg
[npm-url]:http://npmjs.org/package/serverless-granular-iam
[sls-image]:http://public.serverless.com/badges/v3.svg
[sls-url]:http://www.serverless.com
[travis-image]:https://travis-ci.org/CoorpAcademy/serverless-granular-iam.svg?branch=master
[travis-url]:https://travis-ci.org/CoorpAcademy/serverless-granular-iam
[david-image]:https://david-dm.org/CoorpAcademy/serverless-granular-iam/status.svg
[david-url]:https://david-dm.org/CoorpAcademy/serverless-granular-iam
[coveralls-image]:https://coveralls.io/repos/github/CoorpAcademy/serverless-granular-iam/badge.svg?branch=master
[coveralls-url]:https://coveralls.io/github/CoorpAcademy/serverless-granular-iam?branch=master
[downloads-image]:https://img.shields.io/npm/dm/serverless-granular-iam.svg

