// tslint:disable:no-var-requires
import {assert} from 'chai';
const Plugin = require('../lib/index');
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const funcWithIamTemplate = require('../../src/test/funcs-with-iam.json');

describe('plugin tests', () => {

  let serverless: any;
  let plugin: any;

  beforeEach(() => {
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    serverless = new Serverless();
    serverless.setProvider('aws', new AwsProvider(serverless, options));
    Object.assign(serverless.service, funcWithIamTemplate);    
    plugin = new Plugin(serverless);
  });

  describe('#constructor()', () => {
    it('should initialize the plugin', () => {
      assert.instanceOf(plugin, Plugin);
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

  function assertFunctionRoleName(name: string, roleNameObj: any) {
    assert.isArray(roleNameObj['Fn::Join']);
    assert.isTrue(roleNameObj['Fn::Join'][1].indexOf(name) >= 0, 'role name contains function name');
  }

  describe('#getFunctionRoleName', () => {
    it('should return a name with the function name', () => {
      const name = 'test-name';
      const roleName = plugin.getFunctionRoleName(name);
      assertFunctionRoleName(name, roleName);
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
      const statements: any[] = helloInheritRole.Properties.Policies[0].PolicyDocument.Statement;
      assert.isObject(statements.find((s) => s.Action[0] === "xray:PutTelemetryRecords"), 'global statements imported upon inherit');
      assert.isObject(statements.find((s) => s.Action[0] === "dynamodb:GetItem"), 'per function statements imported upon inherit');
    });
  });

});
