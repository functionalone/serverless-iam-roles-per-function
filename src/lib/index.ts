import * as _ from 'lodash';
import {validateStatements} from 'serverless/lib/plugins/aws/package/lib/mergeIamTemplates';

class ServerlessIamPerFunctionPlugin {

  provider: string;
  hooks: {[i: string]: () => void};
  serverless: any;
  validateStatements: (statements: any) => void = validateStatements;

  /**
   * 
   * @param serverless - serverless host object
   * @param options 
   */
  constructor(serverless: any) {
    this.provider = 'aws';
    this.serverless = serverless;
    this.hooks = {
      'after:package:compileFunctions': this.createRolesPerFunction.bind(this),
    };    
  }

  getFunctionRoleName(functionName: string) {
    const roleName = this.serverless.providers.aws.naming.getRoleName();
    const fnJoin = roleName['Fn::Join'];
    if(!_.isArray(fnJoin) || fnJoin.length !== 2 || !_.isArray(fnJoin[1]) || fnJoin[1].length < 2) {
      throw new this.serverless.classes.Error("Global Role Name is not in exepcted format. Got name: " + JSON.stringify(roleName));
    }
    fnJoin[1].splice(2, 0, functionName);
    return roleName;
  }

  updateFunctionResourceRole(functionName: string, roleName: string, globalRoleName: string) {
    const functionResourceName = this.serverless.providers.aws.naming.getLambdaLogicalId(functionName);
    const functionResource = this.serverless.service.provider.compiledCloudFormationTemplate.Resources[functionResourceName];
    if(_.isEmpty(functionResource) || _.isEmpty(functionResource.Properties) || _.isEmpty(functionResource.Properties.Role) ||
      !_.isArray(functionResource.Properties.Role["Fn::GetAtt"]) || !_.isArray(functionResource.DependsOn)) {
        throw new this.serverless.classes.Error("Function Resource is not in exepcted format. For function name: " + functionName);
    }
    functionResource.DependsOn = [roleName].concat(functionResource.DependsOn.filter(((val: any) => val !== globalRoleName )));
    functionResource.Properties.Role["Fn::GetAtt"][0] = roleName;
  } 

  /**
   * Will check if function has a definition of iamRoleStatements. If so will create a new Role for the function based on these statements.
   * @param functionName 
   */
  createRoleForFunction(functionName: string) {
    const functionObject = this.serverless.service.getFunction(functionName);
    if(_.isEmpty(functionObject.iamRoleStatements)) {
      return;
    }
    if(functionObject.role) {
      throw new this.serverless.classes.Error("Defing function with both 'role' and 'iamRoleStatements' is not supported. Function name: " + functionName);
    }
    this.validateStatements(functionObject.iamRoleStatements);
    //we use the configured role as a template
    const globalRoleName = this.serverless.providers.aws.naming.getRoleLogicalId();
    const globalIamRole = this.serverless.service.provider.compiledCloudFormationTemplate.Resources[globalRoleName];
    const functionIamRole = _.cloneDeep(globalIamRole);
    //remove the statements
    const policyStatements: any[] = [];
    functionIamRole.Properties.Policies[0].PolicyDocument.Statement = policyStatements;
    //set log statements
    policyStatements[0] = {
      Effect: "Allow",
      Action: ["logs:CreateLogStream", "logs:PutLogEvents"],
      Resource: [
        { 
          'Fn::Sub': 'arn:aws:logs:${AWS::Region}:${AWS::AccountId}' + 
            `:log-group:${this.serverless.providers.aws.naming.getLogGroupName(functionObject.name)}:*:*`, 
        },
      ],
    };
    //set vpc if needed
    if (!_.isEmpty(functionObject.vpc) || !_.isEmpty(this.serverless.service.provider.vpc)) {
      functionIamRole.Properties.ManagedPolicyArns = [
        'arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole',
      ];
    } 
    if(functionObject.iamRoleStatementsInherit && !_.isEmpty(this.serverless.service.provider.iamRoleStatements)) { //add global statements
      for (const s of this.serverless.service.provider.iamRoleStatements) {
        policyStatements.push(s);    
      }
    }
    //add iamRoleStatements
    for (const s of functionObject.iamRoleStatements) {
      policyStatements.push(s);    
    }        
    functionIamRole.Properties.RoleName = this.getFunctionRoleName(functionName);    
    const roleResourceName = this.serverless.providers.aws.naming.getNormalizedFunctionName(functionName) + globalRoleName;
    this.serverless.service.provider.compiledCloudFormationTemplate.Resources[roleResourceName] = functionIamRole;    
    this.updateFunctionResourceRole(functionName, roleResourceName, globalRoleName);    
  }

  createRolesPerFunction() {
    const allFunctions = this.serverless.service.getAllFunctions();
    if(_.isEmpty(allFunctions)) {
      return;
    }
    for (const func of allFunctions) {
      this.createRoleForFunction(func);
    }    
  }
}

export = ServerlessIamPerFunctionPlugin;
