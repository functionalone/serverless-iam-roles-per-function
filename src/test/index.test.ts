// tslint:disable:no-var-requires
import {assert} from 'chai';
import Plugin from '../lib/index';
const Serverless = require('serverless/lib/Serverless');
const sls_config = require('serverless/lib/utils/config');
const funcWithIamTemplate = require('../../src/test/funcs-with-iam.json');
const writeFileAtomic = require('write-file-atomic');
import _ from 'lodash';
import os from 'os';
import fs from 'fs';
import path from 'path';

describe('plugin tests', function(this: any) {

  this.timeout(15000);

  let serverless: any;

  const tempdir = os.tmpdir();

  before(() => {
    const dir = path.join(tempdir, '.serverless');
    try {
      fs.mkdirSync(dir);  
    } catch (error) {
      if(error.code !== 'EEXIST') {
        console.log('failed to create dir: %s, error: ', dir, error);
        throw error;
      }
    }
    const rc = sls_config.CONFIG_FILE_PATH;
    writeFileAtomic.sync(rc, JSON.stringify({
      userId: null,
      frameworkId: "test",
      trackingDisabled: true,
      enterpriseDisabled: true,
      meta: {
        created_at: 1567187050,
        updated_at: null,
      },
    }, null, 2));
    const packageFile = path.join(dir, funcWithIamTemplate.package.artifact);
    fs.writeFileSync(packageFile, "test123");    
    console.log('### serverless version: %s ###', (new Serverless()).version);    
  });

  beforeEach(async () => {
    serverless = new Serverless();
    serverless.cli = new serverless.classes.CLI();
    serverless.processedInput = serverless.cli.processInput();
    Object.assign(serverless.service, _.cloneDeep(funcWithIamTemplate));
    serverless.service.provider.compiledCloudFormationTemplate = {
      Resources: {},
      Outputs: {},
    };
    serverless.config.servicePath = tempdir;
    serverless.pluginManager.loadAllPlugins();
    let compile_hooks: any[] = serverless.pluginManager.getHooks('package:setupProviderConfiguration');
    compile_hooks = compile_hooks.concat(
      serverless.pluginManager.getHooks('package:compileFunctions'), 
      serverless.pluginManager.getHooks('package:compileEvents'));      
    for (const ent of compile_hooks) {
      try {
        await ent.hook();  
      } catch (error) {
        console.log("failed running compileFunction hook: [%s] with error: ", ent, error);
        assert.fail();
      }        
    }    
  });

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

      it('defaultInherit shuuld be false', () => {
        assert.isFalse(plugin.defaultInherit);
      });
    });

    const statements = [{
      Effect: "Allow",
      Action: [
        'xray:PutTelemetryRecords',
        'xray:PutTraceSegments',
      ],        
      Resource: "*",
    }];

    describe('#validateStatements', () => {
      it('should validate valid statement', () => {              
        assert.doesNotThrow(() => {plugin.validateStatements(statements);});
      });

      it('should throw an error for invalid statement', () => {
        const bad_statement = [{ //missing effect        
          Action: [
            'xray:PutTelemetryRecords',
            'xray:PutTraceSegments',
          ],        
          Resource: "*",
        }]; 
        assert.throws(() => {plugin.validateStatements(bad_statement);});
      });

      it('should throw error if no awsPackage plugin', () => {
        const indx = serverless.pluginManager.plugins.findIndex((p: any) => p.constructor.name === "AwsPackage");
        assert.isAtLeast(indx, 0);
        serverless.pluginManager.plugins.splice(indx, 1);
        assert.throws(() => {
          plugin.validateStatements(statements);
        });
      });
    });
    
    describe('#getFunctionRoleName', () => {
      it('should return a name with the function name', () => {
        const name = 'test-name';
        const roleName = plugin.getFunctionRoleName(name);
        assertFunctionRoleName(name, roleName);
        const name_parts = roleName['Fn::Join'][1];
        assert.equal(name_parts[name_parts.length - 1], 'lambdaRole');        
      });

      it('should throw an error on long name', () => {
        const long_name = 'long-long-long-long-long-long-long-long-long-long-long-long-long-name';
        assert.throws(() => {plugin.getFunctionRoleName(long_name);});
        try {
          plugin.getFunctionRoleName(long_name);
        } catch (error) {
          //some validation that the error we throw is what we expect
          const msg: string = error.message;
          assert.isString(msg);          
          assert.isTrue(msg.startsWith('serverless-iam-roles-per-function: ERROR:'));
          assert.isTrue(msg.includes(long_name));
          assert.isTrue(msg.endsWith('iamRoleStatementsName.'));
        }
      });

      it('should return a name without "lambdaRole"', () => {
        let name = 'test-name';        
        let roleName = plugin.getFunctionRoleName(name);
        const len = plugin.getRoleNameLength(roleName['Fn::Join'][1]);
        //create a name which causes role name to be longer than 64 chars by 1. Will cause then lambdaRole to be removed
        name += 'a'.repeat(64 - len + 1);
        roleName = plugin.getFunctionRoleName(name);
        assertFunctionRoleName(name, roleName);
        const name_parts = roleName['Fn::Join'][1];
        assert.notEqual(name_parts[name_parts.length - 1], 'lambdaRole');        
      });
    });

    describe('#createRolesPerFunction', () => {
      it('should create role per function', () => {
        plugin.createRolesPerFunction();
        const helloRole = serverless.service.provider.compiledCloudFormationTemplate.Resources.HelloIamRoleLambdaExecution;
        assert.isNotEmpty(helloRole);
        assertFunctionRoleName('hello', helloRole.Properties.RoleName);
        assert.isEmpty(helloRole.Properties.ManagedPolicyArns, 'function resource role has no managed policy');
        //check depends and role is set properlly
        const helloFunctionResource = serverless.service.provider.compiledCloudFormationTemplate.Resources.HelloLambdaFunction;
        assert.isTrue(helloFunctionResource.DependsOn.indexOf('HelloIamRoleLambdaExecution') >= 0, 'function resource depends on role');
        assert.equal(helloFunctionResource.Properties.Role["Fn::GetAtt"][0], 'HelloIamRoleLambdaExecution', "function resource role is set properly"); 
        const helloInheritRole = serverless.service.provider.compiledCloudFormationTemplate.Resources.HelloInheritIamRoleLambdaExecution;
        assertFunctionRoleName('helloInherit', helloInheritRole.Properties.RoleName);
        let policy_statements: any[] = helloInheritRole.Properties.Policies[0].PolicyDocument.Statement;
        assert.isObject(policy_statements.find((s) => s.Action[0] === "xray:PutTelemetryRecords"), 'global statements imported upon inherit');
        assert.isObject(policy_statements.find((s) => s.Action[0] === "dynamodb:GetItem"), 'per function statements imported upon inherit');
        const streamHandlerRole = serverless.service.provider.compiledCloudFormationTemplate.Resources.StreamHandlerIamRoleLambdaExecution;
        assertFunctionRoleName('streamHandler', streamHandlerRole.Properties.RoleName);
        policy_statements = streamHandlerRole.Properties.Policies[0].PolicyDocument.Statement;
        assert.isObject(
          policy_statements.find((s) => 
            _.isEqual(s.Action, [
              "dynamodb:GetRecords", 
              "dynamodb:GetShardIterator", 
              "dynamodb:DescribeStream", 
              "dynamodb:ListStreams"]) &&
            _.isEqual(s.Resource, [
              "arn:aws:dynamodb:us-east-1:1234567890:table/test/stream/2017-10-09T19:39:15.151"])),
          'stream statements included'
        );
        assert.isObject(policy_statements.find((s) => s.Action[0] === "sns:Publish"), 'sns dlq statements included');
        const streamMapping = serverless.service.provider.compiledCloudFormationTemplate.Resources.StreamHandlerEventSourceMappingDynamodbTest;
        assert.equal(streamMapping.DependsOn, "StreamHandlerIamRoleLambdaExecution");
        //verify sqsHandler should have SQS permissions
        const sqsHandlerRole = serverless.service.provider.compiledCloudFormationTemplate.Resources.SqsHandlerIamRoleLambdaExecution;
        assertFunctionRoleName('sqsHandler', sqsHandlerRole.Properties.RoleName);
        policy_statements = sqsHandlerRole.Properties.Policies[0].PolicyDocument.Statement;
        JSON.stringify(policy_statements);
        assert.isObject(
          policy_statements.find((s) => 
            _.isEqual(s.Action, [
              "sqs:ReceiveMessage", 
              "sqs:DeleteMessage", 
              "sqs:GetQueueAttributes"]) &&
            _.isEqual(s.Resource, [
              "arn:aws:sqs:us-east-1:1234567890:MyQueue", 
              "arn:aws:sqs:us-east-1:1234567890:MyOtherQueue"])),
          'sqs statements included'
        );
        assert.isObject(policy_statements.find((s) => s.Action[0] === "sns:Publish"), 'sns dlq statements included');
        const sqsMapping = serverless.service.provider.compiledCloudFormationTemplate.Resources.SqsHandlerEventSourceMappingSQSMyQueue;
        assert.equal(sqsMapping.DependsOn, "SqsHandlerIamRoleLambdaExecution");
        //verify helloNoPerFunction should have global role
        const helloNoPerFunctionResource = serverless.service.provider.compiledCloudFormationTemplate.Resources.HelloNoPerFunctionLambdaFunction;
        assert.isTrue(helloNoPerFunctionResource.DependsOn.indexOf('IamRoleLambdaExecution') >= 0, 'function resource depends on global role');
        assert.equal(helloNoPerFunctionResource.Properties.Role["Fn::GetAtt"][0], 'IamRoleLambdaExecution', "function resource role is set to global role"); 
        //verify helloEmptyIamStatements
        const helloEmptyIamStatementsRole = serverless.service.provider.compiledCloudFormationTemplate.Resources.HelloEmptyIamStatementsIamRoleLambdaExecution;
        assertFunctionRoleName('helloEmptyIamStatements', helloEmptyIamStatementsRole.Properties.RoleName);
        // tslint:disable-next-line:max-line-length
        // assert.equal(helloEmptyIamStatementsRole.Properties.ManagedPolicyArns[0], 'arn:${AWS::Partition}:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole');
        const helloEmptyFunctionResource = serverless.service.provider.compiledCloudFormationTemplate.Resources.HelloEmptyIamStatementsLambdaFunction;
        assert.isTrue(helloEmptyFunctionResource.DependsOn.indexOf('HelloEmptyIamStatementsIamRoleLambdaExecution') >= 0, 'function resource depends on role');
        assert.equal(helloEmptyFunctionResource.Properties.Role["Fn::GetAtt"][0], 'HelloEmptyIamStatementsIamRoleLambdaExecution', 
          "function resource role is set properly"); 
      });

      it('should do nothing when no functions defined', () => {
        serverless.service.functions = {};
        serverless.service.resources = {};
        plugin.createRolesPerFunction();
        for (const key in serverless.service.provider.compiledCloudFormationTemplate.Resources) {
          if (key !== 'IamRoleLambdaExecution' && serverless.service.provider.compiledCloudFormationTemplate.Resources.hasOwnProperty(key)) {
            const resource = serverless.service.provider.compiledCloudFormationTemplate.Resources[key];
            if(resource.Type === "AWS::IAM::Role") {
              assert.fail(resource, undefined, "There shouldn't be extra roles beyond IamRoleLambdaExecution");
            }
          }
        }
      });

      it('should throw when external role is defined', () => {
        _.set(serverless.service, "functions.hello.role", "arn:${AWS::Partition}:iam::0123456789:role/Test");
        assert.throws(() => {
          plugin.createRolesPerFunction();
        });
      });

    });

    describe('#throwErorr', () => {
      it('should throw formated error', () => {
        try {
          plugin.throwError('msg :%s', 'testing');
          assert.fail('expected error to be thrown');
        } catch (error) {
          const msg: string = error.message;
          assert.isString(msg);
          assert.isTrue(msg.startsWith('serverless-iam-roles-per-function: ERROR:'));
          assert.isTrue(msg.endsWith('testing'));
        }
      });
    });

  });

  describe('defaultInherit set', () => {    
    let plugin: Plugin;

    beforeEach(() => {      
      //set defaultInherit
      _.set(serverless.service, "custom.serverless-iam-roles-per-function.defaultInherit", true);
      //change helloInherit to false for testing
      _.set(serverless.service, "functions.helloInherit.iamRoleStatementsInherit", false);
      plugin = new Plugin(serverless);
    });

    describe('#constructor()', () => {      
      it('defaultInherit shuuld be true', () => {
        assert.isTrue(plugin.defaultInherit);
      });
    });

    describe('#createRolesPerFunction', () => {
      it('should create role per function', () => {
        plugin.createRolesPerFunction();
        const helloRole = serverless.service.provider.compiledCloudFormationTemplate.Resources.HelloIamRoleLambdaExecution;
        assert.isNotEmpty(helloRole);
        assertFunctionRoleName('hello', helloRole.Properties.RoleName);
        //check depends and role is set properlly
        const helloFunctionResource = serverless.service.provider.compiledCloudFormationTemplate.Resources.HelloLambdaFunction;
        assert.isTrue(helloFunctionResource.DependsOn.indexOf('HelloIamRoleLambdaExecution') >= 0, 'function resource depends on role');
        assert.equal(helloFunctionResource.Properties.Role["Fn::GetAtt"][0], 'HelloIamRoleLambdaExecution', "function resource role is set properly"); 
        let statements: any[] = helloRole.Properties.Policies[0].PolicyDocument.Statement;
        assert.isObject(statements.find((s) => s.Action[0] === "xray:PutTelemetryRecords"), 'global statements imported as defaultInherit is set');
        assert.isObject(statements.find((s) => s.Action[0] === "dynamodb:GetItem"), 'per function statements imported upon inherit');
        const helloInheritRole = serverless.service.provider.compiledCloudFormationTemplate.Resources.HelloInheritIamRoleLambdaExecution;
        assertFunctionRoleName('helloInherit', helloInheritRole.Properties.RoleName);
        statements = helloInheritRole.Properties.Policies[0].PolicyDocument.Statement;
        assert.isObject(statements.find((s) => s.Action[0] === "dynamodb:GetItem"), 'per function statements imported');
        assert.isTrue(statements.find((s) => s.Action[0] === "xray:PutTelemetryRecords") === undefined, 
          'global statements not imported as iamRoleStatementsInherit is false');
      });
    });    
  });

});
