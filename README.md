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

Or if you want to try out the `next` upcoming version:
```
npm install --save-dev serverless-iam-roles-per-function@next
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

**serverless >= v2.24.0**
```yaml
provider:
  name: aws
  iam:
    role:
      statements:
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

**serverless < v2.24.0**
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

## PermissionsBoundary

Define iamPermissionsBoundary definitions at the function level:

```yaml
functions:
  func1:
    handler: handler.get
    iamPermissionsBoundary: !Sub arn:aws:iam::xxxxx:policy/your_permissions_boundary_policy
    iamRoleStatementsName: my-custom-role-name 
    iamRoleStatements:
      - Effect: "Allow"        
        Action:
          - sqs:*        
        Resource: "*"
    ...
```

You can set permissionsBoundary for all roles with iamGlobalPermissionsBoundary in custom:

```yaml
custom:
  serverless-iam-roles-per-function:
    iamGlobalPermissionsBoundary: !Sub arn:aws:iam::xxxx:policy/permissions-boundary-policy
```

For more information, see [Permissions Boundaries](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_boundaries.html).


## Contributing
Contributions are welcome and appreciated. 

* Before opening a PR it is best to first open an [issue](https://github.com/functionalone/serverless-iam-roles-per-function/issues/new). Describe in the issue what you want you plan to implement/fix. Based on the feedback in the issue, you should be able to plan how to implement your PR. 
* Once ready, open a [PR](https://github.com/functionalone/serverless-iam-roles-per-function/compare) to contribute your code.
* To help updating the [CHANGELOG.md](CHANGELOG.md) file, we use [standard-version](https://github.com/conventional-changelog/standard-version). Make sure to use conventional commit messages as specified at: https://www.conventionalcommits.org/en/v1.0.0/.
* Update the release notes at [CHANGELOG.md](CHANGELOG.md) and bump the version by running:
  ```
  npm run release 
  ```
* Examine the [CHANGELOG.md](CHANGELOG.md) and update if still required.
* Don't forget to commit the files modified by `npm run release` (we have the auto-commit option disabled by default).
* Once the PR is approved and merged into master, travis-ci will automatically tag the version you created and deploy to npmjs under the `next` tag. You will see your version deployed at: https://www.npmjs.com/package/serverless-iam-roles-per-function?activeTab=versions.
* Test your deployed version by installing with the `next` tag. For example:
  ```
  npm install --save-dev serverless-iam-roles-per-function@next
  ``` 

## Publishing a Production Release (Maintainers)
Once a contributed PR (or multiple PRs) have been merged into `master`, there is need to publish a production release, after we are sure that the release is stable. Maintainers with commit access to the repository can publish a release by merging into the `release` branch. Steps to follow:
* Verify that the current deployed pre-release version under the `next` tag in npmjs is working properly. Usually, it is best to allow the `next` version to gain traction a week or two before releasing. Also, if the version solves a specific reported issue, ask the community on the issue to test out the `next` version.
* Make sure the version being used in master hasn't been released. This can happen if a PR was merged without bumping the version by running `npm run release`. If the version needs to be advanced, open a PR to advance the version as specified [here](#contributing).
* Open a PR to merge into the `release` branch. Use as a base the `release` branch and compare the `tag` version to `release`. For example:
![Example PR](https://user-images.githubusercontent.com/1395797/101236848-1866e180-36dd-11eb-9281-6c726d15e4f1.png)

* Once approved by another maintainer, merge the PR.
* Make sure to check after the Travis CI build completes that the release has been published to the `latest` tag on [nmpjs](https://www.npmjs.com/package/serverless-iam-roles-per-function?activeTab=versions). 

## More Info

**Introduction post**:
[Serverless Framework: Defining Per-Function IAM Roles](https://medium.com/@glicht/serverless-framework-defining-per-function-iam-roles-c678fa09f46d)


**Note**: Serverless Framework provides support for defining custom IAM roles on a per function level through the use of the `role` property and creating CloudFormation resources, as documented [here](https://serverless.com/framework/docs/providers/aws/guide/iam#custom-iam-roles). This plugin doesn't support defining both the `role` property and `iamRoleStatements` at the function level.

[npm-image]:https://img.shields.io/npm/v/serverless-iam-roles-per-function.svg
[npm-url]:http://npmjs.org/package/serverless-iam-roles-per-function
[sls-image]:http://public.serverless.com/badges/v3.svg
[sls-url]:http://www.serverless.com
[travis-image]:https://travis-ci.com/functionalone/serverless-iam-roles-per-function.svg?branch=master
[travis-url]:https://travis-ci.com/functionalone/serverless-iam-roles-per-function
[david-image]:https://david-dm.org/functionalone/serverless-iam-roles-per-function/status.svg
[david-url]:https://david-dm.org/functionalone/serverless-iam-roles-per-function
[coveralls-image]:https://coveralls.io/repos/github/functionalone/serverless-iam-roles-per-function/badge.svg?branch=master
[coveralls-url]:https://coveralls.io/github/functionalone/serverless-iam-roles-per-function?branch=master
[downloads-image]:https://img.shields.io/npm/dm/serverless-iam-roles-per-function.svg

