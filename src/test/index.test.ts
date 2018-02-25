// tslint:disable:no-var-requires
import {assert} from 'chai';
import Plugin from '../lib/index';
const Serverless = require('serverless/lib/Serverless');
const funcWithIamTemplate = require('../../src/test/funcs-with-iam.json');
import _ from 'lodash';

describe('plugin tests', function(this: any) {

  this.timeout(15000);

  function assertFunctionRoleName(name: string, roleNameObj: any) {
    assert.isArray(roleNameObj['Fn::Join']);
    assert.isTrue(roleNameObj['Fn::Join'][1].indexOf(name) >= 0, 'role name contains function name');
  }

  describe('defaultInherit not set', () => {
    let serverless: any;
    let plugin: any;

    beforeEach(() => {
      serverless = new Serverless();    
      Object.assign(serverless.service, funcWithIamTemplate);    
      serverless.pluginManager.loadAllPlugins();
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

    describe('#validateStatements', () => {
      it('should validate valid statement', () => {
        const statements = [{
          Effect: "Allow",
          Action: [
            'xray:PutTelemetryRecords',
            'xray:PutTraceSegments',
          ],        
          Resource: "*",
        }];      
        assert.doesNotThrow(() => {plugin.validateStatements(statements);});
      });

      it('should throw an error for invalid statement', () => {
        const statements = [{ //missing effect        
          Action: [
            'xray:PutTelemetryRecords',
            'xray:PutTraceSegments',
          ],        
          Resource: "*",
        }]; 
        assert.throws(() => {plugin.validateStatements(statements);});
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
        let statements: any[] = helloInheritRole.Properties.Policies[0].PolicyDocument.Statement;
        assert.isObject(statements.find((s) => s.Action[0] === "xray:PutTelemetryRecords"), 'global statements imported upon inherit');
        assert.isObject(statements.find((s) => s.Action[0] === "dynamodb:GetItem"), 'per function statements imported upon inherit');
        const streamHandlerRole = serverless.service.provider.compiledCloudFormationTemplate.Resources.StreamHandlerIamRoleLambdaExecution;
        assertFunctionRoleName('streamHandler', streamHandlerRole.Properties.RoleName);
        statements = streamHandlerRole.Properties.Policies[0].PolicyDocument.Statement;
        assert.isObject(statements.find((s) => s.Action[0] === "dynamodb:GetRecords"), 'stream statements included');
        assert.isObject(statements.find((s) => s.Action[0] === "sns:Publish"), 'sns dlq statements included');   
        const streamMapping = serverless.service.provider.compiledCloudFormationTemplate.Resources.StreamHandlerEventSourceMappingDynamodbTest;
        assert.equal(streamMapping.DependsOn, "StreamHandlerIamRoleLambdaExecution");
      });
    });
  });

  describe('defaultInherit set', () => {
    let serverless: any;
    let plugin: any;

    beforeEach(() => {
      serverless = new Serverless();    
      const funcWithIamTemplateMod = _.set(_.cloneDeep(funcWithIamTemplate), "custom.serverless-iam-roles-per-function.defaultInherit", true);
      //change helloInherit to false for testing
      funcWithIamTemplateMod.functions.helloInherit.iamRoleStatementsInherit = false;
      Object.assign(serverless.service, funcWithIamTemplateMod);    
      serverless.pluginManager.loadAllPlugins();
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
