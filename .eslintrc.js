// @see https://eslint.org/docs/user-guide/configuring#configuring-rules

const OFF = 0;
const WARN = 1;
const ERROR = 2;

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    node: true,
    mocha: true,
  },
  plugins: [
    'import',
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  rules: {
    '@typescript-eslint/no-explicit-any': OFF,
    '@typescript-eslint/explicit-module-boundary-types': OFF,
    '@typescript-eslint/no-unused-vars': [ERROR, { argsIgnorePattern: '^_' }],
    // eslint-disable-next-line max-len
    // https://github.com/typescript-eslint/typescript-eslint/blob/master/packages/eslint-plugin/docs/rules/no-unused-vars.md
    'no-unused-vars': OFF,
    'camelcase': ERROR,
    'space-infix-ops': ERROR,
    'keyword-spacing': ERROR,
    'space-before-blocks': ERROR,
    'spaced-comment': ERROR,
    'arrow-body-style': [ERROR, 'as-needed'],
    'comma-dangle': [ERROR, 'always-multiline'],
    'import/imports-first': ERROR,
    'import/newline-after-import': ERROR,
    'import/no-named-as-default': ERROR,
    'import/no-unresolved': [ERROR, { commonjs: true, amd: true }],
    'import/no-cycle': ['error', { maxDepth: 9999 }],
    indent: [ERROR, 2, { SwitchCase: 1 }],
    'max-len': [ERROR, 120],
    'newline-per-chained-call': ERROR,
    'no-confusing-arrow': ERROR,
    'no-use-before-define': ERROR,
    'require-yield': ERROR,
    'function-call-argument-newline': [ERROR, 'consistent'],
    'linebreak-style': OFF,
    'no-trailing-spaces': ERROR,
    'no-cond-assign': [ERROR, 'except-parens'],
    'no-unused-expressions': [ERROR, { allowShortCircuit: true, allowTernary: true }],
    'sort-imports': [ERROR, {
      ignoreCase: false,
      ignoreDeclarationSort: true,
      ignoreMemberSort: false,
      memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
    }],
    eqeqeq: [ERROR, 'always', { null: 'ignore' }],
    quotes: [ERROR, 'single'],
    // JSDoc Requirements
    'require-jsdoc': [WARN, {
      require: {
        FunctionDeclaration: true,
        MethodDefinition: true,
        ClassDeclaration: false,
      },
    }],
    'valid-jsdoc': [ERROR, {
      requireReturn: true,
      requireReturnDescription: false,
      requireParamDescription: false,
      requireParamType: true,
      requireReturnType: false,
      preferType: {
        Boolean: 'boolean', Number: 'number', object: 'Object', String: 'string',
      },
    }],
  },
  settings: {
    'import/resolver': {
      'node': {
        'extensions': ['.js', '.jsx', '.ts', '.tsx'],
      },
    },
  },
  overrides: [
    {
      files: ['*.test.ts'],
      rules: {
        '@typescript-eslint/no-var-requires': OFF,
      },
    },
  ],
};
