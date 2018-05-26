// tslint:disable:no-var-requires
import {assert} from 'chai';
import Plugin from '../lib/index';
const Serverless = require('serverless/lib/Serverless');
const funcWithIamTemplate = require('../../src/test/funcs-with-iam.json');
import _ from 'lodash';
import os from 'os';
import fs from 'fs';
import path from 'path';

describe('plugin tests', function(this: any) {

  this.timeout(15000);

  let serverless: any;

  before(() => {      
    const dir = path.join(os.tmpdir(), '.serverless');
    try {
      fs.mkdirSync(dir);  
    } catch (error) {
      if(error.code !== 'EEXIST') {
        console.log('failed to create dir: %s, error: ', dir, error);
        throw error;
      }
    }      
    const packageFile = path.join(dir, funcWithIamTemplate.package.artifact);
    fs.writeFileSync(packageFile, "test123");    
    console.log('### serverless version: %s ###', (new Serverless()).version);    
  });

  beforeEach(async () => {
    serverless = new Serverless();
    serverless.cli = new serverless.classes.CLI();
    Object.assign(serverless.service, _.cloneDeep(funcWithIamTemplate));
    serverless.service.provider.compiledCloudFormationTemplate = {
      Resources: {},
      Outputs: {},
    };
    serverless.config.servicePath = os.tmpdir();
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
    assert.isTrue(roleNameObj['Fn::Join'][1].indexOf(name) >= 0, 'role name contains function name');
  }
  
  describe('defaultInherit not set', () => {    
    let plugin: any;
    
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
      });

      it('should throw an error on long name', () => {
        assert.throws(() => {plugin.getFunctionRoleName('long-long-long-long-long-long-long-long-long-long-long-name');});
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
        const helloInheritRole = serverless.service.provider.compiledCloudFormationTemplate.Resources.HelloInheritIamRoleLambdaExecution;
        assertFunctionRoleName('helloInherit', helloInheritRole.Properties.RoleName);
        let policy_statements: any[] = helloInheritRole.Properties.Policies[0].PolicyDocument.Statement;
        assert.isObject(policy_statements.find((s) => s.Action[0] === "xray:PutTelemetryRecords"), 'global statements imported upon inherit');
        assert.isObject(policy_statements.find((s) => s.Action[0] === "dynamodb:GetItem"), 'per function statements imported upon inherit');
        const streamHandlerRole = serverless.service.provider.compiledCloudFormationTemplate.Resources.StreamHandlerIamRoleLambdaExecution;
        assertFunctionRoleName('streamHandler', streamHandlerRole.Properties.RoleName);
        policy_statements = streamHandlerRole.Properties.Policies[0].PolicyDocument.Statement;
        assert.isObject(policy_statements.find((s) => s.Action[0] === "dynamodb:GetRecords"), 'stream statements included');
        assert.isObject(policy_statements.find((s) => s.Action[0] === "sns:Publish"), 'sns dlq statements included');   
        const streamMapping = serverless.service.provider.compiledCloudFormationTemplate.Resources.StreamHandlerEventSourceMappingDynamodbTest;
        assert.equal(streamMapping.DependsOn, "StreamHandlerIamRoleLambdaExecution");
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
        _.set(serverless.service, "functions.hello.role", "arn:aws:iam::0123456789:role/Test");
        assert.throws(() => {
          plugin.createRolesPerFunction();
        });
      });

    });

  });

  describe('defaultInherit set', () => {    
    let plugin: any;

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
