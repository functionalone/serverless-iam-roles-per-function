# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [3.2.0](https://github.com/functionalone/serverless-iam-roles-per-function/compare/v3.1.1...v3.2.0) (2021-03-19)


### Features

* Support new provider.iam property ([0d3dd37](https://github.com/functionalone/serverless-iam-roles-per-function/commit/0d3dd37328b283cafc92f42dbc16ed37a6ecd7b2)), closes [#73](https://github.com/functionalone/serverless-iam-roles-per-function/issues/73)

### [3.1.1](https://github.com/functionalone/serverless-iam-roles-per-function/compare/v3.1.0...v3.1.1) (2021-01-03)


### Bug Fixes

* change PermissionsBoundary feature to add suport for cloudformation functions ([PR#70](https://github.com/functionalone/serverless-iam-roles-per-function/pull/70))

## [3.1.0](https://github.com/functionalone/serverless-iam-roles-per-function/compare/v3.0.2...v3.1.0) (2020-12-17)


### Features

* Permission boundary ([PR#68](https://github.com/functionalone/serverless-iam-roles-per-function/pull/68))

## [3.0.2](https://github.com/functionalone/serverless-iam-roles-per-function/compare/v3.0.1...v3.0.2) (2020-12-04)

### Bug Fixes
Add `logs:CreateLogGroup` action to default policy ([#42](https://github.com/functionalone/serverless-iam-roles-per-function/issues/42)) ([b5e1837](https://github.com/functionalone/serverless-iam-roles-per-function/commit/b5e1837))
## [3.0.1](https://github.com/functionalone/serverless-iam-roles-per-function/compare/v3.0.0...v3.0.1) (2020-11-28)


### Features

* Docs: added contributing section ([d9715ba](https://github.com/functionalone/serverless-iam-roles-per-function/commit/d9715ba))

## [3.0.0](https://github.com/functionalone/serverless-iam-roles-per-function/compare/v2.0.2...v3.0.0) (2020-11-02)

### Bug Fixes
* Function properties schema validation fixe ([#63](https://github.com/functionalone/serverless-iam-roles-per-function/issues/63)) ([1f81264](https://github.com/functionalone/serverless-iam-roles-per-function/commit/1f81264))

### Features
* Support for Serverless v2.5.0 ([#53](https://github.com/functionalone/serverless-iam-roles-per-function/issues/53)) ([09e56ae](https://github.com/functionalone/serverless-iam-roles-per-function/commit/09e56ae))
* nodejs 12 support ([#32](https://github.com/functionalone/serverless-iam-roles-per-function/issues/32)) ([4dd58a2](https://github.com/functionalone/serverless-iam-roles-per-function/commit/4dd58a2))
* Use resolved region name in counting length of role name ([#33](https://github.com/functionalone/serverless-iam-roles-per-function/issues/33)) ([f9fd677](https://github.com/functionalone/serverless-iam-roles-per-function/commit/f9fd677)), closes [#26](https://github.com/functionalone/serverless-iam-roles-per-function/issues/26)

## [2.0.2](https://github.com/functionalone/serverless-iam-roles-per-function/compare/v2.0.1...v2.0.2) (2019-08-30)


### Features

* update dependencies ([61c04e7](https://github.com/functionalone/serverless-iam-roles-per-function/commit/61c04e7))

<a name="2.0.1"></a>
## [2.0.1](https://github.com/functionalone/serverless-iam-roles-per-function/compare/v2.0.0...v2.0.1) (2019-05-10)


### Bug Fixes
* Fix regression when using a vpc with a function ([#24](https://github.com/functionalone/serverless-iam-roles-per-function/issues/24))


<a name="2.0.0"></a>
## [2.0.0](https://github.com/functionalone/serverless-iam-roles-per-function/compare/v1.0.4...v2.0.0) (2019-04-30)


### Features
* Prevent hard coded aws partition in arn of resources ([#18](https://github.com/functionalone/serverless-iam-roles-per-function/issues/18))
* Support for SQS event source ([#17](https://github.com/functionalone/serverless-iam-roles-per-function/issues/17))

<a name="1.0.4"></a>
## [1.0.4](https://github.com/functionalone/serverless-iam-roles-per-function/compare/v1.0.3...v1.0.4) (2018-09-02)


### Features

* improved formatting for error messages from the plugin ([cea0541](https://github.com/functionalone/serverless-iam-roles-per-function/commit/cea0541))
* update dependencies ([43641b3](https://github.com/functionalone/serverless-iam-roles-per-function/commit/43641b3))
* update README with download stats ([f9b0b4a](https://github.com/functionalone/serverless-iam-roles-per-function/commit/f9b0b4a))



<a name="1.0.3"></a>
## [1.0.3](https://github.com/functionalone/serverless-iam-roles-per-function/compare/v1.0.2...v1.0.3) (2018-08-26)


### Features

* support for auto shortening the role name when default naming scheme exceeds 64 chars ([97284e4](https://github.com/functionalone/serverless-iam-roles-per-function/commit/97284e4))
* update dependencies ([b16de8d](https://github.com/functionalone/serverless-iam-roles-per-function/commit/b16de8d))



<a name="1.0.2"></a>
## [1.0.2](https://github.com/functionalone/serverless-iam-roles-per-function/compare/v1.0.1...v1.0.2) (2018-07-28)


### Features

* update dependencies ([1f5a6ef](https://github.com/functionalone/serverless-iam-roles-per-function/commit/1f5a6ef))



<a name="1.0.1"></a>
## [1.0.1](https://github.com/functionalone/serverless-iam-roles-per-function/compare/v1.0.0...v1.0.1) (2018-05-30)


### Features

* fix README with coveralls coverage status ([aa3efe3](https://github.com/functionalone/serverless-iam-roles-per-function/commit/aa3efe3))



<a name="1.0.0"></a>
## [1.0.0](https://github.com/functionalone/serverless-iam-roles-per-function/compare/v0.1.9...v1.0.0) (2018-05-29)


### Bug Fixes

* remove managed policies from cloned role ([942816f](https://github.com/functionalone/serverless-iam-roles-per-function/commit/942816f))


### Features

* support for running tests with multiple serverless versions ([0153d79](https://github.com/functionalone/serverless-iam-roles-per-function/commit/0153d79))
* tests to check empty iam statements array and no-block ([8d601b4](https://github.com/functionalone/serverless-iam-roles-per-function/commit/8d601b4))
* update dependencies to latest versions ([b4487c3](https://github.com/functionalone/serverless-iam-roles-per-function/commit/b4487c3))
* update README with code coverage status ([8387371](https://github.com/functionalone/serverless-iam-roles-per-function/commit/8387371))



<a name="0.1.9"></a>
## [0.1.9](https://github.com/functionalone/serverless-iam-roles-per-function/compare/v0.1.8...v0.1.9) (2018-05-26)


### Bug Fixes

* support per function role with an empty iamRoleStatements clause (issue [#9](https://github.com/functionalone/serverless-iam-roles-per-function/issues/9)) ([5a3aadf](https://github.com/functionalone/serverless-iam-roles-per-function/commit/5a3aadf))


### Features

* code coverage reporting ([51367c8](https://github.com/functionalone/serverless-iam-roles-per-function/commit/51367c8))



<a name="0.1.8"></a>
## [0.1.8](https://github.com/functionalone/serverless-iam-roles-per-function/compare/v0.1.7...v0.1.8) (2018-05-17)


### Features

* add travis ci build status ([24399ae](https://github.com/functionalone/serverless-iam-roles-per-function/commit/24399ae))



<a name="0.1.7"></a>
## [0.1.7](https://github.com/functionalone/serverless-iam-roles-per-function/compare/v0.1.6...v0.1.7) (2018-05-16)


### Features

* add dependencies status to readme ([9eb79e0](https://github.com/functionalone/serverless-iam-roles-per-function/commit/9eb79e0))



<a name="0.1.6"></a>
## [0.1.6](https://github.com/functionalone/serverless-iam-roles-per-function/compare/v0.1.5...v0.1.6) (2018-05-15)


### Features

* dependencies update ([d36f969](https://github.com/functionalone/serverless-iam-roles-per-function/commit/d36f969))



<a name="0.1.5"></a>
## [0.1.5](https://github.com/functionalone/serverless-iam-roles-per-function/compare/v0.1.4...v0.1.5) (2018-02-25)


### Bug Fixes

* support for auto adding permissions when sns dlq is used (issue [#5](https://github.com/functionalone/serverless-iam-roles-per-function/issues/5)) ([c4c89d6](https://github.com/functionalone/serverless-iam-roles-per-function/commit/c4c89d6))



<a name="0.1.4"></a>
## [0.1.4](https://github.com/functionalone/serverless-iam-roles-per-function/compare/v0.1.3...v0.1.4) (2018-02-23)


### Bug Fixes

* support for stream based event sources (issue [#3](https://github.com/functionalone/serverless-iam-roles-per-function/issues/3)) ([3b63d49](https://github.com/functionalone/serverless-iam-roles-per-function/commit/3b63d49))



<a name="0.1.3"></a>
## [0.1.3](https://github.com/functionalone/serverless-iam-roles-per-function/compare/v0.1.2...v0.1.3) (2018-02-20)


### Features

* new configuration to control default inherit or override behaviour ([542175f](https://github.com/functionalone/serverless-iam-roles-per-function/commit/542175f))
* support custom role names via the property: iamRoleStatementsName ([93cd015](https://github.com/functionalone/serverless-iam-roles-per-function/commit/93cd015)), closes [#2](https://github.com/functionalone/serverless-iam-roles-per-function/issues/2)



<a name="0.1.2"></a>
## [0.1.2](https://github.com/functionalone/serverless-iam-roles-per-function/compare/v0.1.1...v0.1.2) (2018-02-07)


### Bug Fixes

* remove dependency on local install of serverless framework. issue [#1](https://github.com/functionalone/serverless-iam-roles-per-function/issues/1) ([fcf61aa](https://github.com/functionalone/serverless-iam-roles-per-function/commit/fcf61aa))
