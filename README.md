# Serverless IAM Roles Per Function Plugin

[![serverless][sls-image]][sls-url] 
[![npm package][npm-image]][npm-url] 
[![Build Status][travis-image]][travis-url] 
[![Coverage Status][coveralls-image]][coveralls-url] 
[![Dependencies Status][david-image]][david-url]
[![Downloads][downloads-image]][npm-url] 

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
  serverless-iam-roles-per-function:
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

[npm-image]:https://img.shields.io/npm/v/serverless-iam-roles-per-function.svg
[npm-url]:http://npmjs.org/package/serverless-iam-roles-per-function
[sls-image]:http://public.serverless.com/badges/v3.svg
[sls-url]:http://www.serverless.com
[travis-image]:https://travis-ci.org/functionalone/serverless-iam-roles-per-function.svg?branch=master
[travis-url]:https://travis-ci.org/functionalone/serverless-iam-roles-per-function
[david-image]:https://david-dm.org/functionalone/serverless-iam-roles-per-function/status.svg
[david-url]:https://david-dm.org/functionalone/serverless-iam-roles-per-function
[coveralls-image]:https://coveralls.io/repos/github/functionalone/serverless-iam-roles-per-function/badge.svg?branch=master
[coveralls-url]:https://coveralls.io/github/functionalone/serverless-iam-roles-per-function?branch=master
[downloads-image]:https://img.shields.io/npm/dm/serverless-iam-roles-per-function.svg

