import _ from 'lodash';

interface Statement {
  Effect: "Allow" | "Deny";
  Action: string | string[];
  Resource: string | any[];  
}

class ServerlessIamPerFunctionPlugin {

  provider: string;
  hooks: {[i: string]: () => void};
  serverless: any;
  awsPackagePlugin: any; 
  defaultInherit: boolean;

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
    this.defaultInherit = _.get(this.serverless.service, "custom.serverless-iam-roles-per-function.defaultInherit", false);
  }

  validateStatements(statements: any): void {
    const awsPackagePluginName = "AwsPackage";
    if(!this.awsPackagePlugin) {
      for (const plugin of this.serverless.pluginManager.plugins) {
        if(plugin.constructor && plugin.constructor.name === awsPackagePluginName) {
          this.awsPackagePlugin = plugin;
          break;
        }
      }
    }
    if(!this.awsPackagePlugin) {
      this.serverless.cli.log(`WARNING: could not find ${awsPackagePluginName} plugin to verify statements.`);
      return;
    }
    this.awsPackagePlugin.validateStatements(statements);
  } 

  getFunctionRoleName(functionName: string) {
    const roleName = this.serverless.providers.aws.naming.getRoleName();
    const fnJoin = roleName['Fn::Join'];
    if(!_.isArray(fnJoin) || fnJoin.length !== 2 || !_.isArray(fnJoin[1]) || fnJoin[1].length < 2) {
      throw new this.serverless.classes.Error("Global Role Name is not in exepcted format. Got name: " + JSON.stringify(roleName));
    }
    fnJoin[1].splice(2, 0, functionName);
    let length=0; //calculate the expected length. Sum the lenght of each part
    for (const part of fnJoin[1]) {
      length += part.length;
    }
    length += (fnJoin[1].length - 1); //take into account the dashes between parts
    if(length > 64) { //aws limits to 64 chars the role name
      throw new this.serverless.classes.Error(`auto generated role name for function: ${functionName} is too long (over 64 chars).
        Try setting a custom role name using the property: iamRoleStatementsName.`);
    }
    return roleName;
  }

  /**
   * 
   * @param functionName 
   * @param roleName 
   * @param globalRoleName 
   * @return the function resource name
   */
  updateFunctionResourceRole(functionName: string, roleName: string, globalRoleName: string): string {
    const functionResourceName = this.serverless.providers.aws.naming.getLambdaLogicalId(functionName);
    const functionResource = this.serverless.service.provider.compiledCloudFormationTemplate.Resources[functionResourceName];
    if(_.isEmpty(functionResource) || _.isEmpty(functionResource.Properties) || _.isEmpty(functionResource.Properties.Role) ||
      !_.isArray(functionResource.Properties.Role["Fn::GetAtt"]) || !_.isArray(functionResource.DependsOn)) {
        throw new this.serverless.classes.Error("Function Resource is not in exepcted format. For function name: " + functionName);
    }
    functionResource.DependsOn = [roleName].concat(functionResource.DependsOn.filter(((val: any) => val !== globalRoleName )));
    functionResource.Properties.Role["Fn::GetAtt"][0] = roleName;
    return functionResourceName;
  }

  /**
   * Get the necessary statement permissions if there are stream event sources of dynamo or kinesis. 
   * @param functionObject 
   * @return array of statements (possibly empty)
   */
  getStreamStatements(functionObject: any) {  
    const res: any[] = [];  
    if(!functionObject.events) { //no events
      return res;
    }
    const dynamodbStreamStatement: Statement = {
      Effect: 'Allow',
      Action: [
        'dynamodb:GetRecords',
        'dynamodb:GetShardIterator',
        'dynamodb:DescribeStream',
        'dynamodb:ListStreams',
      ],
      Resource: [],
    };
    const kinesisStreamStatement: Statement = {
      Effect: 'Allow',
      Action: [
        'kinesis:GetRecords',
        'kinesis:GetShardIterator',
        'kinesis:DescribeStream',
        'kinesis:ListStreams',
      ],
      Resource: [],
    };
    for (const event of functionObject.events) {
      if(event.stream) {
        const streamArn = event.stream.arn || event.stream;
        const streamType = event.stream.type || streamArn.split(':')[2];
        switch (streamType) {
          case 'dynamodb':
            (dynamodbStreamStatement.Resource as any[]).push(streamArn);  
            break;
          case 'kinesis':
            (kinesisStreamStatement.Resource as any[]).push(streamArn);
            break;
          default:
            throw new this.serverless.classes.Error(`Unsupported stream type: ${streamType} for function: `, functionObject);            
        }        
      }
    }
    if (dynamodbStreamStatement.Resource.length) {
      res.push(dynamodbStreamStatement);
    }
    if (kinesisStreamStatement.Resource.length) {
      res.push(kinesisStreamStatement);
    }
    return res;
  }

  /**
   * Will check if function has a definition of iamRoleStatements. If so will create a new Role for the function based on these statements.
   * @param functionName 
   * @param functionToRoleMap - populate the map with a mapping from function resource name to role resource name
   */
  createRoleForFunction(functionName: string, functionToRoleMap: Map<string, string>) {
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
    const policyStatements: Statement[] = [];
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
    for (const s of this.getStreamStatements(functionObject)) { //set stream statements (if needed)
      policyStatements.push(s);
    }
    // set sns publish for DLQ if needed
    // currently only sns is supported: https://serverless.com/framework/docs/providers/aws/events/sns#dlq-with-sqs
    if (!_.isEmpty(functionObject.onError)) { //
      policyStatements.push({
        Effect: 'Allow',
        Action: [
          'sns:Publish',
        ],
        Resource: functionObject.onError,
      });
    }
    if((functionObject.iamRoleStatementsInherit || (this.defaultInherit && functionObject.iamRoleStatementsInherit !== false)) 
      && !_.isEmpty(this.serverless.service.provider.iamRoleStatements)) { //add global statements
      for (const s of this.serverless.service.provider.iamRoleStatements) {
        policyStatements.push(s);    
      }
    }
    //add iamRoleStatements
    for (const s of functionObject.iamRoleStatements) {
      policyStatements.push(s);    
    }        
    functionIamRole.Properties.RoleName = functionObject.iamRoleStatementsName || this.getFunctionRoleName(functionName);
    const roleResourceName = this.serverless.providers.aws.naming.getNormalizedFunctionName(functionName) + globalRoleName;
    this.serverless.service.provider.compiledCloudFormationTemplate.Resources[roleResourceName] = functionIamRole;    
    const functionResourceName = this.updateFunctionResourceRole(functionName, roleResourceName, globalRoleName);
    functionToRoleMap.set(functionResourceName, roleResourceName);
  }

  /**
   * Go over each EventSourceMapping and if it is for a function with a function level iam role then adjust the DependsOn
   * @param functionToRoleMap 
   */
  setEventSourceMappings(functionToRoleMap: Map<string, string>) {
    for (const mapping of _.values(this.serverless.service.provider.compiledCloudFormationTemplate.Resources)) {
      if(mapping.Type && mapping.Type === 'AWS::Lambda::EventSourceMapping') {
        const functionNameFn = _.get(mapping, "Properties.FunctionName.Fn::GetAtt");
        if(!_.isArray(functionNameFn)) {
          continue;
        }
        const functionName = functionNameFn[0];
        const roleName = functionToRoleMap.get(functionName);
        if(roleName) {
          mapping.DependsOn = roleName;
        }
      }
    }
  }

  createRolesPerFunction() {
    const allFunctions = this.serverless.service.getAllFunctions();
    if(_.isEmpty(allFunctions)) {
      return;
    }
    const functionToRoleMap: Map<string, string> = new Map();
    for (const func of allFunctions) {
      this.createRoleForFunction(func, functionToRoleMap);
    }
    this.setEventSourceMappings(functionToRoleMap);
  }
}

export = ServerlessIamPerFunctionPlugin;
