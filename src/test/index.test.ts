import {assert} from 'chai';
import Plugin from '../lib/index';
import _ from 'lodash';
import os from 'os';
import fs from 'fs';
import path from 'path';

const Serverless = require('serverless/lib/Serverless');
const funcWithIamTemplate = require('../../src/test/funcs-with-iam.json');

describe('plugin tests', function(this: any) {

  this.timeout(15000);

  let serverless: any;

  const tempdir = os.tmpdir();

  before(() => {
    const dir = path.join(tempdir, '.serverless');
    try {
      fs.mkdirSync(dir);
    } catch (error) {
      if (error.code !== 'EEXIST') {
        console.log('failed to create dir: %s, error: ', dir, error);
        throw error;
      }
    }
    const packageFile = path.join(dir, funcWithIamTemplate.package.artifact);
    fs.writeFileSync(packageFile, 'test123');
    console.log('### serverless version: %s ###', (new Serverless()).version);
  });

  beforeEach(async () => {
    serverless = new Serverless();
    serverless.cli = new serverless.classes.CLI();

    // Since serverless 2.24.0 processInput function doesn't exist
    if (serverless.cli.processInput) {
      serverless.processedInput = serverless.cli.processInput();
    }

    Object.assign(serverless.service, _.cloneDeep(funcWithIamTemplate));
    serverless.service.provider.compiledCloudFormationTemplate = {
      Resources: {},
      Outputs: {},
    };
    serverless.config.servicePath = tempdir;
    serverless.pluginManager.loadAllPlugins();
    let compileHooks: any[] = serverless.pluginManager.getHooks('package:setupProviderConfiguration');
    compileHooks = compileHooks.concat(
      serverless.pluginManager.getHooks('package:compileFunctions'),
      serverless.pluginManager.getHooks('package:compileEvents'));
    for (const ent of compileHooks) {
      try {
        await ent.hook();
      } catch (error) {
        console.log('failed running compileFunction hook: [%s] with error: ', ent, error);
        assert.fail();
      }
    }
  });

  /**
   * @param {string} name
   * @param {*} roleNameObj
   * @returns void
   */
  function assertFunctionRoleName(name: string, roleNameObj: any) {
    assert.isArray(roleNameObj['Fn::Join']);
    assert.isTrue(roleNameObj['Fn::Join'][1].toString().indexOf(name) >= 0, 'role name contains function name');
  }

  describe('defaultInherit not set', () => {
    let plugin: Plugin;

    beforeEach(async () => {
      plugin = new Plugin(serverless);
    });

    describe('#constructor()', () => {
      it('should initialize the plugin', () => {
        assert.instanceOf(plugin, Plugin);
      });

      it('should NOT initialize the plugin for non AWS providers', () => {
        assert.throws(() => new Plugin({ service: { provider: { name: 'not-aws' } } }));
      });

      it('defaultInherit should be false', () => {
        assert.isFalse(plugin.defaultInherit);
      });
    });

    const statements = [{
      Effect: 'Allow',
      Action: [
        'xray:PutTelemetryRecords',
        'xray:PutTraceSegments',
      ],
      Resource: '*',
    }];

    describe('#validateStatements', () => {
      it('should validate valid statement', () => {
        assert.doesNotThrow(() => {plugin.validateStatements(statements);});
      });

      it('should throw an error for invalid statement', () => {
        const badStatement = [{ // missing effect
          Action: [
            'xray:PutTelemetryRecords',
            'xray:PutTraceSegments',
          ],
          Resource: '*',
        }];
        assert.throws(() => {plugin.validateStatements(badStatement);});
      });

      it('should throw an error for non array type of statement', () => {
        const badStatement = { // missing effect
          Action: [
            'xray:PutTelemetryRecords',
            'xray:PutTraceSegments',
          ],
          Resource: '*',
        };
        assert.throws(() => {plugin.validateStatements(badStatement);});
      });
    });

    describe('#getRoleNameLength', () => {
      it('Should calculate the accurate role name length us-east-1', () => {
        serverless.service.provider.region = 'us-east-1';
        const functionName = 'a'.repeat(10);
        const nameParts = [
          serverless.service.service,         // test-service , length of 12
          serverless.service.provider.stage,  // dev, length of 3 : 15
          { Ref: 'AWS::Region' },             // us-east-1, length 9 : 24
          functionName,                      // 'a'.repeat(10), length 10 : 34
          'lambdaRole',                       // lambdaRole, length 10 : 44
        ];
        const roleNameLength = plugin.getRoleNameLength(nameParts);
        const expected = 44; // 12 + 3 + 9 + 10 + 10 == 44
        assert.equal(roleNameLength, expected + nameParts.length - 1);
      });

      it('Should calculate the accurate role name length ap-northeast-1', () => {
        serverless.service.provider.region = 'ap-northeast-1';
        const functionName = 'a'.repeat(10);
        const nameParts = [
          serverless.service.service,         // test-service , length of 12
          serverless.service.provider.stage,  // dev, length of 3
          { Ref: 'AWS::Region' },             // ap-northeast-1, length 14
          functionName,                      // 'a'.repeat(10), length 10
          'lambdaRole',                       // lambdaRole, length 10
        ];
        const roleNameLength = plugin.getRoleNameLength(nameParts);
        const expected = 49; // 12 + 3 + 14 + 10 + 10 == 49
        assert.equal(roleNameLength, expected + nameParts.length - 1);
      });

      it('Should calculate the actual length for a non AWS::Region ref to maintain backward compatibility', () => {
        serverless.service.provider.region = 'ap-northeast-1';
        const functionName = 'a'.repeat(10);
        const nameParts = [
          serverless.service.service,         // test-service , length of 12
          { Ref: 'bananas'},                  // bananas, length of 7
          { Ref: 'AWS::Region' },             // ap-northeast-1, length 14
          functionName,                      // 'a'.repeat(10), length 10
          'lambdaRole',                       // lambdaRole, length 10
        ];
        const roleNameLength = plugin.getRoleNameLength(nameParts);
        const expected = 53; // 12 + 7 + 14 + 10 + 10 == 53
        assert.equal(roleNameLength, expected + nameParts.length - 1);
      });
    });

    describe('#getFunctionRoleName', () => {
      it('should return a name with the function name', () => {
        const name = 'test-name';
        const roleName = plugin.getFunctionRoleName(name);
        assertFunctionRoleName(name, roleName);
        const nameParts = roleName['Fn::Join'][1];
        assert.equal(nameParts[nameParts.length - 1], 'lambdaRole');
      });

      it('should throw an error on long name', () => {
        const longName = 'long-long-long-long-long-long-long-long-long-long-long-long-long-name';
        assert.throws(() => {plugin.getFunctionRoleName(longName);});
        try {
          plugin.getFunctionRoleName(longName);
        } catch (error) {
          // some validation that the error we throw is what we expect
          const msg: string = error.message;
          assert.isString(msg);
          assert.isTrue(msg.startsWith('serverless-iam-roles-per-function: ERROR:'));
          assert.isTrue(msg.includes(longName));
          assert.isTrue(msg.endsWith('iamRoleStatementsName.'));
        }
      });

      it('should throw with invalid Fn:Join statement', () => {
        assert.throws(() => {
          const longName = 'test-name';
          const invalidRoleName = {
            'Fn::Join': [],
          };
          const slsMock = {
            service: {
              provider: {
                name: 'aws',
              },
            },
            providers: {
              aws: { naming: { getRoleName: () => invalidRoleName } },
            },
          };
          (new Plugin(slsMock)).getFunctionRoleName(longName);
        });
      });

      it('should return a name without "lambdaRole"', () => {
        let name = 'test-name';
        let roleName = plugin.getFunctionRoleName(name);
        const len = plugin.getRoleNameLength(roleName['Fn::Join'][1]);
        // create a name which causes role name to be longer than 64 chars by 1.
        // Will cause then lambdaRole to be removed
        name += 'a'.repeat(64 - len + 1);
        roleName = plugin.getFunctionRoleName(name);
        assertFunctionRoleName(name, roleName);
        const nameParts = roleName['Fn::Join'][1];
        assert.notEqual(nameParts[nameParts.length - 1], 'lambdaRole');
      });
    });

    describe('#createRolesPerFunction', () => {
      it('should create role per function', () => {
        plugin.createRolesPerFunction();
        const compiledResources = serverless.service.provider.compiledCloudFormationTemplate.Resources;
        const helloRole = compiledResources.HelloIamRoleLambdaExecution;
        assert.isNotEmpty(helloRole);
        assertFunctionRoleName('hello', helloRole.Properties.RoleName);
        assert.isEmpty(helloRole.Properties.ManagedPolicyArns, 'function resource role has no managed policy');
        // check depends and role is set properly
        const helloFunctionResource = compiledResources.HelloLambdaFunction;
        assert.isTrue(
          helloFunctionResource.DependsOn.indexOf('HelloIamRoleLambdaExecution') >= 0,
          'function resource depends on role',
        );
        assert.equal(
          helloFunctionResource.Properties.Role['Fn::GetAtt'][0],
          'HelloIamRoleLambdaExecution',
          'function resource role is set properly',
        );
        const helloInheritRole = compiledResources.HelloInheritIamRoleLambdaExecution;
        assertFunctionRoleName('helloInherit', helloInheritRole.Properties.RoleName);
        let policyStatements: any[] = helloInheritRole.Properties.Policies[0].PolicyDocument.Statement;
        assert.isObject(
          policyStatements.find((s) => s.Action[0] === 'xray:PutTelemetryRecords'),
          'global statements imported upon inherit',
        );
        assert.isObject(
          policyStatements.find((s) => s.Action[0] === 'dynamodb:GetItem'),
          'per function statements imported upon inherit',
        );
        const streamHandlerRole = compiledResources.StreamHandlerIamRoleLambdaExecution;
        assertFunctionRoleName('streamHandler', streamHandlerRole.Properties.RoleName);
        policyStatements = streamHandlerRole.Properties.Policies[0].PolicyDocument.Statement;
        assert.isObject(
          policyStatements.find((s) =>
            _.isEqual(s.Action, [
              'dynamodb:GetRecords',
              'dynamodb:GetShardIterator',
              'dynamodb:DescribeStream',
              'dynamodb:ListStreams']) &&
            _.isEqual(s.Resource, [
              'arn:aws:dynamodb:us-east-1:1234567890:table/test/stream/2017-10-09T19:39:15.151'])),
          'stream statements included',
        );
        assert.isObject(policyStatements.find((s) => s.Action[0] === 'sns:Publish'), 'sns dlq statements included');
        const streamMapping = compiledResources.StreamHandlerEventSourceMappingDynamodbTest;
        assert.equal(streamMapping.DependsOn, 'StreamHandlerIamRoleLambdaExecution');
        // verify sqsHandler should have SQS permissions
        const sqsHandlerRole = compiledResources.SqsHandlerIamRoleLambdaExecution;
        assertFunctionRoleName('sqsHandler', sqsHandlerRole.Properties.RoleName);
        policyStatements = sqsHandlerRole.Properties.Policies[0].PolicyDocument.Statement;
        JSON.stringify(policyStatements);
        assert.isObject(
          policyStatements.find((s) =>
            _.isEqual(s.Action, [
              'sqs:ReceiveMessage',
              'sqs:DeleteMessage',
              'sqs:GetQueueAttributes']) &&
            _.isEqual(s.Resource, [
              'arn:aws:sqs:us-east-1:1234567890:MyQueue',
              'arn:aws:sqs:us-east-1:1234567890:MyOtherQueue'])),
          'sqs statements included',
        );
        assert.isObject(policyStatements.find((s) => s.Action[0] === 'sns:Publish'), 'sns dlq statements included');
        const sqsMapping = compiledResources.SqsHandlerEventSourceMappingSQSMyQueue;
        assert.equal(sqsMapping.DependsOn, 'SqsHandlerIamRoleLambdaExecution');
        // verify helloNoPerFunction should have global role
        const helloNoPerFunctionResource = compiledResources.HelloNoPerFunctionLambdaFunction;
        // role is the default role generated by the framework
        assert.isFalse(
          helloNoPerFunctionResource.DependsOn.indexOf('IamRoleLambdaExecution') === 0,
          'function resource depends on global role',
        );
        assert.equal(
          helloNoPerFunctionResource.Properties.Role['Fn::GetAtt'][0],
          'IamRoleLambdaExecution',
          'function resource role is set to global role',
        );
        // verify helloEmptyIamStatements
        const helloEmptyIamStatementsRole = compiledResources.HelloEmptyIamStatementsIamRoleLambdaExecution;
        assertFunctionRoleName('helloEmptyIamStatements', helloEmptyIamStatementsRole.Properties.RoleName);
        // assert.equal(
        //   helloEmptyIamStatementsRole.Properties.ManagedPolicyArns[0],
        //   'arn:${AWS::Partition}:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole',
        // );
        const helloEmptyFunctionResource = compiledResources.HelloEmptyIamStatementsLambdaFunction;
        assert.isTrue(
          helloEmptyFunctionResource.DependsOn.indexOf('HelloEmptyIamStatementsIamRoleLambdaExecution') >= 0,
          'function resource depends on role',
        );
        assert.equal(
          helloEmptyFunctionResource.Properties.Role['Fn::GetAtt'][0],
          'HelloEmptyIamStatementsIamRoleLambdaExecution',
          'function resource role is set properly',
        );
      });

      it('should do nothing when no functions defined', () => {
        const compiledResources = serverless.service.provider.compiledCloudFormationTemplate.Resources;
        serverless.service.functions = {};
        serverless.service.resources = {};
        plugin.createRolesPerFunction();
        for (const key in compiledResources) {
          if (key !== 'IamRoleLambdaExecution' &&  Object.prototype.hasOwnProperty.call(compiledResources, key)) {
            const resource = compiledResources[key];
            if (resource.Type === 'AWS::IAM::Role') {
              assert.fail(resource, undefined, 'There shouldn\'t be extra roles beyond IamRoleLambdaExecution');
            }
          }
        }
      });

      it('should throw when external role is defined', () => {
        _.set(serverless.service, 'functions.hello.role', 'arn:${AWS::Partition}:iam::0123456789:role/Test');
        assert.throws(() => {
          plugin.createRolesPerFunction();
        });
      });

    });

    describe('#throwErorr', () => {
      it('should throw formatted error', () => {
        try {
          plugin.throwError('msg :%s', 'testing');
          assert.fail('expected error to be thrown');
        } catch (error) {
          const msg: string = error.message;
          assert.isString(msg);
          assert.isTrue(msg.startsWith('serverless-iam-roles-per-function: ERROR:'));
          assert.isTrue(msg.includes('testing'));
        }
      });
    });

  });

  describe('defaultInherit set', () => {
    let plugin: Plugin;

    beforeEach(() => {
      // set defaultInherit
      _.set(serverless.service, 'custom.serverless-iam-roles-per-function.defaultInherit', true);
      // change helloInherit to false for testing
      _.set(serverless.service, 'functions.helloInherit.iamRoleStatementsInherit', false);
      plugin = new Plugin(serverless);
    });

    describe('#constructor()', () => {
      it('defaultInherit should be true', () => {
        assert.isTrue(plugin.defaultInherit);
      });
    });

    describe('#createRolesPerFunction', () => {
      it('should create role per function', () => {
        const compiledResources = serverless.service.provider.compiledCloudFormationTemplate.Resources;
        plugin.createRolesPerFunction();
        const helloRole = compiledResources.HelloIamRoleLambdaExecution;
        assert.isNotEmpty(helloRole);
        assertFunctionRoleName('hello', helloRole.Properties.RoleName);
        // check depends and role is set properlly
        const helloFunctionResource = compiledResources.HelloLambdaFunction;
        assert.isTrue(
          helloFunctionResource.DependsOn.indexOf('HelloIamRoleLambdaExecution') >= 0,
          'function resource depends on role',
        );
        assert.equal(
          helloFunctionResource.Properties.Role['Fn::GetAtt'][0],
          'HelloIamRoleLambdaExecution',
          'function resource role is set properly',
        );
        let statements: any[] = helloRole.Properties.Policies[0].PolicyDocument.Statement;
        assert.isObject(
          statements.find((s) => s.Action[0] === 'xray:PutTelemetryRecords'),
          'global statements imported as defaultInherit is set',
        );
        assert.isObject(
          statements.find((s) => s.Action[0] === 'dynamodb:GetItem'),
          'per function statements imported upon inherit',
        );
        const helloInheritRole = compiledResources.HelloInheritIamRoleLambdaExecution;
        assertFunctionRoleName('helloInherit', helloInheritRole.Properties.RoleName);
        statements = helloInheritRole.Properties.Policies[0].PolicyDocument.Statement;
        assert.isObject(statements.find((s) => s.Action[0] === 'dynamodb:GetItem'), 'per function statements imported');
        assert.isTrue(statements.find((s) => s.Action[0] === 'xray:PutTelemetryRecords') === undefined,
          'global statements not imported as iamRoleStatementsInherit is false');
      });

      it('should add permission policy arn when there is iamPermissionsBoundary defined', () => {
        const compiledResources = serverless.service.provider.compiledCloudFormationTemplate.Resources;
        plugin.createRolesPerFunction();
        const helloPermissionsBoundaryIamRole = compiledResources.HelloPermissionsBoundaryIamRoleLambdaExecution;
        const policyName = helloPermissionsBoundaryIamRole.Properties.PermissionsBoundary['Fn::Sub'];
        assert.equal(policyName, 'arn:aws:iam::xxxxx:policy/your_permissions_boundary_policy');
      })

      it('should add permission policy arn when there is iamGlobalPermissionsBoundary defined', () => {
        const compiledResources = serverless.service.provider.compiledCloudFormationTemplate.Resources;
        serverless.service.custom['serverless-iam-roles-per-function'] = {
          iamGlobalPermissionsBoundary: {
            'Fn::Sub': 'arn:aws:iam::xxxxx:policy/permissions_boundary',
          },
        };
        plugin.createRolesPerFunction();
        const defaultIamRoleLambdaExecution = compiledResources.IamRoleLambdaExecution;
        const policyName = defaultIamRoleLambdaExecution.Properties.PermissionsBoundary['Fn::Sub'];
        assert.equal(policyName, 'arn:aws:iam::xxxxx:policy/permissions_boundary');
      })
    });
  });

  describe('support new provider.iam property', () => {
    const getLambdaTestStatements = (): any[] => {
      const plugin = new Plugin(serverless);

      const compiledResources = serverless.service.provider.compiledCloudFormationTemplate.Resources;
      plugin.createRolesPerFunction();
      const helloInherit = compiledResources.HelloInheritIamRoleLambdaExecution;
      assert.isNotEmpty(helloInherit);

      return helloInherit.Properties.Policies[0].PolicyDocument.Statement;
    }

    it('no global iam and iamRoleStatements properties', () => {
      _.set(serverless.service, 'provider.iam', undefined);
      _.set(serverless.service, 'provider.iamRoleStatements', undefined);

      const statements = getLambdaTestStatements();

      assert.isTrue(statements.find((s) => s.Action[0] === 'xray:PutTelemetryRecords') === undefined,
        'provider.iamRoleStatements values shouldn\'t exists');
      assert.isObject(
        statements.find((s) => s.Action[0] === 'dynamodb:GetItem'),
        'per function statements imported upon inherit',
      );
    });

    describe('new iam property takes precedence over old iamRoleStatements property', () => {
      it('empty iam object', () => {
        _.set(serverless.service, 'provider.iam', {});

        const statements = getLambdaTestStatements();

        assert.isTrue(statements.find((s) => s.Action[0] === 'xray:PutTelemetryRecords') === undefined,
          'provider.iamRoleStatements values shouldn\'t exists');
        assert.isObject(
          statements.find((s) => s.Action[0] === 'dynamodb:GetItem'),
          'per function statements imported upon inherit',
        );
      });

      it('no role property', () => {
        _.set(serverless.service, 'provider.iam', {
          deploymentRole: 'arn:aws:iam::123456789012:role/deploy-role',
        });

        const statements = getLambdaTestStatements();

        assert.isTrue(statements.find((s) => s.Action[0] === 'xray:PutTelemetryRecords') === undefined,
          'provider.iamRoleStatements values shouldn\'t exists');
        assert.isObject(
          statements.find((s) => s.Action[0] === 'dynamodb:GetItem'),
          'per function statements imported upon inherit',
        );
      });

      it('role property set to role ARN', () => {
        _.set(serverless.service, 'provider.iam', {
          role: 'arn:aws:iam::0123456789:role//my/default/path/roleInMyAccount',
        });

        const statements = getLambdaTestStatements();

        assert.isTrue(statements.find((s) => s.Action[0] === 'xray:PutTelemetryRecords') === undefined,
          'provider.iamRoleStatements values shouldn\'t exists');
        assert.isObject(
          statements.find((s) => s.Action[0] === 'dynamodb:GetItem'),
          'per function statements imported upon inherit',
        );
      });

      it('role is set without statements', () => {
        _.set(serverless.service, 'provider.iam', {
          role: {
            managedPolicies: ['arn:aws:iam::123456789012:user/*'],
          },
        });

        const statements = getLambdaTestStatements();

        assert.isTrue(statements.find((s) => s.Action[0] === 'xray:PutTelemetryRecords') === undefined,
          'provider.iamRoleStatements values shouldn\'t exists');
        assert.isObject(
          statements.find((s) => s.Action[0] === 'dynamodb:GetItem'),
          'per function statements imported upon inherit',
        );
      });

      it('empty statements', () => {
        _.set(serverless.service, 'provider.iam', {
          role: {
            statements: [],
          },
        });

        const statements = getLambdaTestStatements();

        assert.isTrue(statements.find((s) => s.Action[0] === 'xray:PutTelemetryRecords') === undefined,
          'provider.iamRoleStatements values shouldn\'t exists');
        assert.isObject(
          statements.find((s) => s.Action[0] === 'dynamodb:GetItem'),
          'per function statements imported upon inherit',
        );
      });
    });

    it('global iam role statements exists in lambda role statements', () => {
      _.set(serverless.service, 'provider.iam', {
        role: {
          statements: [{
            Effect: 'Allow',
            Action: [
              'ec2:CreateNetworkInterface',
            ],
            Resource: '*',
          }],
        },
      });

      const statements = getLambdaTestStatements();

      assert.isObject(
        statements.find((s) => s.Action[0] === 'ec2:CreateNetworkInterface'),
        'global iam role statements exists',
      );
      assert.isTrue(statements.find((s) => s.Action[0] === 'xray:PutTelemetryRecords') === undefined,
        'old provider.iamRoleStatements shouldn\'t exists');
      assert.isObject(
        statements.find((s) => s.Action[0] === 'dynamodb:GetItem'),
        'per function statements imported upon inherit',
      );
    });
  });
});
