import _ from 'lodash';
import util from 'util';

const PLUGIN_NAME = 'serverless-iam-roles-per-function';

interface Statement {
  Effect: "Allow" | "Deny";
  Action: string | string[];
  Resource: string | any[];
}

type ArbitraryCFN = string | ArbitraryCFN[] | { [key: string]: ArbitraryCFN} ;

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
      'before:package:finalize': this.createRolesPerFunction.bind(this),
    };
    this.defaultInherit = _.get(this.serverless.service, `custom.${PLUGIN_NAME}.defaultInherit`, false);
  }

  /**
   * Utility function which throws an error. The msg will be formated with args using util.format.
   * Error message will be prefixed with ${PLUGIN_NAME}: ERROR:
   */
  throwError(msg: string, ...args: any[]) {
    if(!_.isEmpty(args)) {
      msg  = util.format(msg, args);
    }
    const err_msg = `${PLUGIN_NAME}: ERROR: ${msg}`;
    throw new this.serverless.classes.Error(err_msg);
  }

  validateStatements(statements: any): void {	
    // Verify that iamRoleStatements (if present) is an array of { Effect: ...,	
    // Action: ..., Resource: ... } objects.	
    if(_.isEmpty(statements)) {
      return;
    }
    let violationsFound;	
    if (!Array.isArray(statements)) {	
      violationsFound = 'it is not an array';	
    } else {	
      const descriptions = statements.map((statement, i) => {	
        const missing = [	
          ['Effect'],	
          ['Action', 'NotAction'],	
          ['Resource', 'NotResource'],	
        ].filter(props => props.every(prop => !statement[prop]));	
        return missing.length === 0	
          ? null	
          : `statement ${i} is missing the following properties: ${missing	
              .map(m => m.join(' / '))	
              .join(', ')}`;	
      });	
      const flawed = descriptions.filter(curr => curr);	
      if (flawed.length) {	
        violationsFound = flawed.join('; ');	
      }	
    }	

    if (violationsFound) {	
      const errorMessage = [	
        'iamRoleStatements should be an array of objects,',	
        ' where each object has Effect, Action / NotAction, Resource / NotResource fields.',	
        ` Specifically, ${violationsFound}`,	
      ].join('');	
      this.throwError(errorMessage);	
    }	
  }

  getRoleNameLength(name_parts: any[]) {
    let length=0; //calculate the expected length. Sum the length of each part
    for (const part of name_parts) {
      if (part.Ref) {
        if (part.Ref === 'AWS::Region') {
          length += this.serverless.service.provider.region.length;
        } else {
          length += part.Ref.length;
        }
      } else {
        length += part.length;
      }
    }
    length += (name_parts.length - 1); //take into account the dashes between parts
    return length;
  }

  getFunctionRoleName(functionName: string) {
    const roleName = this.serverless.providers.aws.naming.getRoleName();
    const fnJoin = roleName['Fn::Join'];
    if(!_.isArray(fnJoin) || fnJoin.length !== 2 || !_.isArray(fnJoin[1]) || fnJoin[1].length < 2) {
      this.throwError("Global Role Name is not in exepcted format. Got name: " + JSON.stringify(roleName));
    }
    fnJoin[1].splice(2, 0, functionName); //insert the function name
    if(this.getRoleNameLength(fnJoin[1]) > 64 && fnJoin[1][fnJoin[1].length-1] === 'lambdaRole') {
      // Remove lambdaRole from name to give more space for function name.
      fnJoin[1].pop();
    }
    if(this.getRoleNameLength(fnJoin[1]) > 64) { //aws limits to 64 chars the role name
      this.throwError(`auto generated role name for function: ${functionName} is too long (over 64 chars).
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
        this.throwError("Function Resource is not in exepcted format. For function name: " + functionName);
    }
    functionResource.DependsOn = [roleName].concat(functionResource.DependsOn.filter(((val: any) => val !== globalRoleName )));
    functionResource.Properties.Role["Fn::GetAtt"][0] = roleName;
    return functionResourceName;
  }

  /**
   * Get the necessary statement permissions if there are SQS event sources.
   * @param functionObject
   * @return statement (possibly null)
   */
  getSqsStatement(functionObject: any) {
    const sqsStatement: Statement = {
      Effect: 'Allow',
      Action: [
        'sqs:ReceiveMessage',
        'sqs:DeleteMessage',
        'sqs:GetQueueAttributes',
      ],
      Resource: [],
    };
    for (const event of functionObject.events) {
      if(event.sqs) {
        const sqsArn = event.sqs.arn || event.sqs;
        (sqsStatement.Resource as any[]).push(sqsArn);
      }
    }
    return sqsStatement.Resource.length ? sqsStatement : null;
  }

  /**
   * Get the necessary statement permissions if there are stream event sources of dynamo or kinesis.
   * @param functionObject
   * @return array of statements (possibly empty)
   */
  getStreamStatements(functionObject: any) {
    const res: any[] = [];
    if(_.isEmpty(functionObject.events)) { //no events
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
            this.throwError(`Unsupported stream type: ${streamType} for function: `, functionObject);
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

  collectInlinePolicy(functionObject: any) {
    const policyStatements: Statement[] = [
      { //set log statements
        Effect: "Allow",
        Action: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        Resource: [
          {
            'Fn::Sub': 'arn:aws:logs:${AWS::Region}:${AWS::AccountId}' +
            `:log-group:${this.serverless.providers.aws.naming.getLogGroupName(functionObject.name)}:*:*`,
          },
        ],
      },
    ];

    //set stream statements (if needed)
    const streamStatements = this.getStreamStatements(functionObject);
    for (const s of streamStatements) {
      policyStatements.push(s);
    }

    //set sqs statement (if needed)
    const sqsStatement = this.getSqsStatement(functionObject);
    if (sqsStatement) {
      policyStatements.push(sqsStatement);
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

    //add global statements
    if((functionObject.iamRoleStatementsInherit || (this.defaultInherit && functionObject.iamRoleStatementsInherit !== false))
        && !_.isEmpty(this.serverless.service.provider.iamRoleStatements)) {
      for (const s of this.serverless.service.provider.iamRoleStatements) {
        policyStatements.push(s);
      }
    }

    //add iamRoleStatements
    if(_.isArray(functionObject.iamRoleStatements)) {
      for (const s of functionObject.iamRoleStatements) {
        policyStatements.push(s);
      }
    }
    return policyStatements;
  }

  collectManagedPolicies(functionObject: any) {
    const managedPolicies: ArbitraryCFN[] = [];
    //add global statements
    if((functionObject.iamManagedPoliciesInherit || (this.defaultInherit && functionObject.iamManagedPoliciesInherit !== false))
        && !_.isEmpty(this.serverless.service.provider.iamManagedPolicies)) {
      for (const s of this.serverless.service.provider.iamManagedPolicies) {
        managedPolicies.push(s);
      }
    }

    //add iamRoleStatements
    if(_.isArray(functionObject.iamManagedPolicies)) {
      for (const s of functionObject.iamManagedPolicies) {
        managedPolicies.push(s);
      }
    }

    //set vpc if needed
    if (!_.isEmpty(functionObject.vpc) || !_.isEmpty(this.serverless.service.provider.vpc)) {
      if (!_.includes(managedPolicies, 'arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole')) {
        managedPolicies.push(
          {
            'Fn::Join': ['',
              [
                'arn:',
                { Ref: 'AWS::Partition' },
                ':iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole',
              ],
            ],
          },
        );
      }
    }
    return _.uniq(managedPolicies);
  }

  /**
   * Will check if function has a definition of iamRoleStatements. If so will create a new Role for the function based on these statements.
   * @param functionName
   * @param functionToRoleMap - populate the map with a mapping from function resource name to role resource name
   */
  createRoleForFunction(functionName: string, functionToRoleMap: Map<string, string>) {
    const functionObject = this.serverless.service.getFunction(functionName);

    if(functionObject.iamRoleStatements === undefined) {
      return;
    }

    if(functionObject.role) {
      this.throwError("Defining function with both 'role' and 'iamRoleStatements' is not supported. Function name: " + functionName);
    }

    this.validateStatements(functionObject.iamRoleStatements);

    //we use the configured role as a template
    const globalRoleName = this.serverless.providers.aws.naming.getRoleLogicalId();
    const globalIamRole = this.serverless.service.provider.compiledCloudFormationTemplate.Resources[globalRoleName];
    const functionIamRole = _.cloneDeep(globalIamRole);

    // rebuild managed policies
    functionIamRole.Properties.ManagedPolicyArns = this.collectManagedPolicies(functionObject);

    // rebuild the inline policy
    functionIamRole.Properties.Policies[0].PolicyDocument.Statement = this.collectInlinePolicy(functionObject);

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
