# Changelog

## [2.4.3](https://github.com/linz/argo-tasks/compare/v2.4.2...v2.4.3) (2023-04-13)


### Bug Fixes

* stac-validate handle list input TDE-504 ([#363](https://github.com/linz/argo-tasks/issues/363)) ([1072a3e](https://github.com/linz/argo-tasks/commit/1072a3e3ec04dae7d6df4efe7be51c6921a7c208))

## [2.4.2](https://github.com/linz/argo-tasks/compare/v2.4.1...v2.4.2) (2023-04-03)


### Bug Fixes

* increase MaxListCount to 1000 TDE-698 ([#350](https://github.com/linz/argo-tasks/issues/350)) ([60a1084](https://github.com/linz/argo-tasks/commit/60a1084ff11a0023ecaf1cbf2a6fb4c35e7b3f13))

## [2.4.1](https://github.com/linz/argo-tasks/compare/v2.4.0...v2.4.1) (2023-04-03)


### Bug Fixes

* unescaped bracket ([#344](https://github.com/linz/argo-tasks/issues/344)) ([6eba67d](https://github.com/linz/argo-tasks/commit/6eba67db53af5854f966aee1682e9cf9261fe0c5))

## [2.4.0](https://github.com/linz/argo-tasks/compare/v2.3.0...v2.4.0) (2023-03-06)


### Features

* add --transform to allow renaming of files as part of the manifest ([#284](https://github.com/linz/argo-tasks/issues/284)) ([ed1ff48](https://github.com/linz/argo-tasks/commit/ed1ff4833bd2be7ceeac5c75ece96b3d551a6329))

## [2.3.0](https://github.com/linz/argo-tasks/compare/v2.2.1...v2.3.0) (2023-03-02)


### Features

* **copy:** validate that the file has the same ending file size as the source ([#275](https://github.com/linz/argo-tasks/issues/275)) ([c05e76a](https://github.com/linz/argo-tasks/commit/c05e76a4951fb30a6b9af9ebacbce7741a3012bf))
* **stac-validate:** add --checksum to validate assets with `file:checksum` ([#276](https://github.com/linz/argo-tasks/issues/276)) ([9c407fc](https://github.com/linz/argo-tasks/commit/9c407fc1b0f509f8490f65adcb444cec1328d26c))


### Bug Fixes

* remove dev deps from docker container ([#274](https://github.com/linz/argo-tasks/issues/274)) ([e8d4adc](https://github.com/linz/argo-tasks/commit/e8d4adc80a54bbfe97f754f3a6dd25b4ab6c50be))

## [2.2.1](https://github.com/linz/argo-tasks/compare/v2.2.0...v2.2.1) (2023-02-21)


### Bug Fixes

* stop using alpine images ([#257](https://github.com/linz/argo-tasks/issues/257)) ([7c249af](https://github.com/linz/argo-tasks/commit/7c249afe0374d438927aaa800fc12af9f4cd8268))

## [2.2.0](https://github.com/linz/argo-tasks/compare/v2.1.1...v2.2.0) (2023-02-12)


### Features

* **copy:** log errors in child workers as composite error reasons get swallowed TDE-637 ([#247](https://github.com/linz/argo-tasks/issues/247)) ([45b71cf](https://github.com/linz/argo-tasks/commit/45b71cf8bc82321465c0050913339a95b3a5a236))

## [2.1.1](https://github.com/linz/argo-tasks/compare/v2.1.0...v2.1.1) (2023-01-29)


### Bug Fixes

* allow multiple downloads from LDS cache ([#212](https://github.com/linz/argo-tasks/issues/212)) ([6fae252](https://github.com/linz/argo-tasks/commit/6fae252dc7fc571850a55293534a70e2ebe87955))

## [2.1.0](https://github.com/linz/argo-tasks/compare/v2.0.1...v2.1.0) (2023-01-25)


### Features

* --force-no-clobber copy option TDE-595 ([#208](https://github.com/linz/argo-tasks/issues/208)) ([e73a9f8](https://github.com/linz/argo-tasks/commit/e73a9f8a603af4da4418c16e2ce9c4dee1062fd8))
* move to aws-sdk-v3 ([#187](https://github.com/linz/argo-tasks/issues/187)) ([7495070](https://github.com/linz/argo-tasks/commit/749507092e655104dd8d205cf440c55155130da1))

## [2.0.1](https://github.com/linz/argo-tasks/compare/v2.0.0...v2.0.1) (2023-01-19)


### Bug Fixes

* yarn bundle is not required ([#196](https://github.com/linz/argo-tasks/issues/196)) ([a255dd8](https://github.com/linz/argo-tasks/commit/a255dd8e5436a31e32b3a9020c445a7134ed1f6a))

## [2.0.0](https://github.com/linz/argo-tasks/compare/v1.0.0...v2.0.0) (2023-01-18)


### ⚠ BREAKING CHANGES

* create-manifest allows flatten as optional ([#159](https://github.com/linz/argo-tasks/issues/159))
* allow multiple layers to be downloaded with the layer downloader ([#70](https://github.com/linz/argo-tasks/issues/70))
* add --exclude and --include for list ([#26](https://github.com/linz/argo-tasks/issues/26))

### Features

* add --exclude and --include for list ([#26](https://github.com/linz/argo-tasks/issues/26)) ([b677a9f](https://github.com/linz/argo-tasks/commit/b677a9f0187d24b78fce24397921dbaf4d0bb205))
* add copy and flatten commands to move source imagery around ([#56](https://github.com/linz/argo-tasks/issues/56)) ([9173869](https://github.com/linz/argo-tasks/commit/9173869d5f826f0a238f3c5a717674ff175c55af))
* allow compressed output ([#57](https://github.com/linz/argo-tasks/issues/57)) ([7b127c9](https://github.com/linz/argo-tasks/commit/7b127c9563bca45eee5f319154d35ebd1a8b3069))
* allow multiple layers to be downloaded with the layer downloader ([#70](https://github.com/linz/argo-tasks/issues/70)) ([887d9cb](https://github.com/linz/argo-tasks/commit/887d9cba5576c7f4795f09bf5fe8224a66f5c001))
* allow use a user configured path to store actions ([#114](https://github.com/linz/argo-tasks/issues/114)) ([01008f2](https://github.com/linz/argo-tasks/commit/01008f20ab19ad7cbae4225d07e6c2b82dbfc146))
* **copy:** add --no-clobber to not overwrite files if they exist and have the same size ([#103](https://github.com/linz/argo-tasks/issues/103)) ([2127bbf](https://github.com/linz/argo-tasks/commit/2127bbf3c04bfa2e4513d1779f03e15e8c175eda))
* **copy:** use worker_threads to add more concurrency ([#106](https://github.com/linz/argo-tasks/issues/106)) ([ba14db5](https://github.com/linz/argo-tasks/commit/ba14db5b48606c3c5ce242a80f7f88b995cad682))
* core STAC validator TDE-456 ([#32](https://github.com/linz/argo-tasks/issues/32)) ([ea46732](https://github.com/linz/argo-tasks/commit/ea46732b8044c924db94f0ceb6cd2633a98fd8ec))
* create example direct copy commands ([#77](https://github.com/linz/argo-tasks/issues/77)) ([73386e6](https://github.com/linz/argo-tasks/commit/73386e6a4044ed8a0dcf5c16e555c31e3b626f8a))
* create-manifest allows flatten as optional ([#159](https://github.com/linz/argo-tasks/issues/159)) ([76c20f6](https://github.com/linz/argo-tasks/commit/76c20f6800ba3c2e92518efe010d6dd40973cf6f))
* **deps:** bump @linzjs/style from 3.11.0 to 3.13.0 ([#121](https://github.com/linz/argo-tasks/issues/121)) ([b4df1ba](https://github.com/linz/argo-tasks/commit/b4df1ba530a12b045df682e3dc03d4b38e8a6c25))
* **deps:** bump @linzjs/style from 3.13.0 to 3.14.0 ([#133](https://github.com/linz/argo-tasks/issues/133)) ([dbb002b](https://github.com/linz/argo-tasks/commit/dbb002b12de52e67973bc674f260d00865ad60fc))
* **deps:** bump @linzjs/style from 3.14.0 to 3.15.0 ([#179](https://github.com/linz/argo-tasks/issues/179)) ([d462d8d](https://github.com/linz/argo-tasks/commit/d462d8d23dbeb580c816667471b5850def11feaf))
* **deps:** bump ajv from 8.11.0 to 8.11.2 ([#116](https://github.com/linz/argo-tasks/issues/116)) ([b67eadc](https://github.com/linz/argo-tasks/commit/b67eadc34acf50db1c107c5a6b6cedbb44731fe2))
* **deps:** bump ajv from 8.11.2 to 8.12.0 ([#173](https://github.com/linz/argo-tasks/issues/173)) ([f76aeea](https://github.com/linz/argo-tasks/commit/f76aeea6dfa5a2e7069ff1478b9d1fab80d1400b))
* **deps:** bump pino from 8.7.0 to 8.8.0 ([#158](https://github.com/linz/argo-tasks/issues/158)) ([fd13fe0](https://github.com/linz/argo-tasks/commit/fd13fe0c6738f9055431479b7293a95d01bffb75))
* **deps:** bump zod from 3.19.1 to 3.20.2 ([#152](https://github.com/linz/argo-tasks/issues/152)) ([fe6f1cd](https://github.com/linz/argo-tasks/commit/fe6f1cd47aede65c2348fa244193b1528bd2c7d3))
* ensure connections to aws are reused ([#107](https://github.com/linz/argo-tasks/issues/107)) ([2d586af](https://github.com/linz/argo-tasks/commit/2d586af84a649a64d6c151eea3ac0befb95c5fe1))
* **flatten:** store the manifest of what is going to be flattened into s3 rather than argo ([#104](https://github.com/linz/argo-tasks/issues/104)) ([c81459e](https://github.com/linz/argo-tasks/commit/c81459ef3a477792b28c204b3b992ff757995600))
* **list:** import list command from basemaps/cli ([8642dca](https://github.com/linz/argo-tasks/commit/8642dca0d795db8e9a852828eae24382ce4b31fd))
* **list:** list total size of files listed ([#146](https://github.com/linz/argo-tasks/issues/146)) ([f39162d](https://github.com/linz/argo-tasks/commit/f39162d4eba091d1a2e43f0da8230470468a5613))
* Publish Imagery TDE-494 ([#119](https://github.com/linz/argo-tasks/issues/119)) ([42124ec](https://github.com/linz/argo-tasks/commit/42124ec513bb1b6f9b93f0490b670493180c1424))
* read copy configuration from a s3 json object ([#61](https://github.com/linz/argo-tasks/issues/61)) ([bb959c8](https://github.com/linz/argo-tasks/commit/bb959c8baa248350b0fa2bc4a9ffc26e61475233))
* support multiple role config files ([#115](https://github.com/linz/argo-tasks/issues/115)) ([932804c](https://github.com/linz/argo-tasks/commit/932804cb92352958344af455bf24b388f169230d))
* use $AWS_ROLE_CONFIG_PATH to be more consistent ([571857c](https://github.com/linz/argo-tasks/commit/571857c4dc292857f3d2ff36d78334680732bbd9))
* use action-typescript v2 ([#186](https://github.com/linz/argo-tasks/issues/186)) ([8ae5f52](https://github.com/linz/argo-tasks/commit/8ae5f5244ba1131b8e14c75b123e2b13b636cf17))
* validate stac_extensions TDE-503 ([#71](https://github.com/linz/argo-tasks/issues/71)) ([626183b](https://github.com/linz/argo-tasks/commit/626183b1d2b3b1b911ec7b13ffcaaa4bbaa3e286))
* validate tiffs are named the same as their tileset ([#80](https://github.com/linz/argo-tasks/issues/80)) ([ea36c2f](https://github.com/linz/argo-tasks/commit/ea36c2f06e5a2595937ce415ff6798919ed3131e))


### Bug Fixes

* add the entire source and stop bundling the CLI ([#108](https://github.com/linz/argo-tasks/issues/108)) ([caa00e2](https://github.com/linz/argo-tasks/commit/caa00e2b2bac609baa99d85dede510f4aa1a6053))
* concurrenct queue should not stack trace on error ([#156](https://github.com/linz/argo-tasks/issues/156)) ([80b8d18](https://github.com/linz/argo-tasks/commit/80b8d18796a56f96ae5ed31f2cd1fbf0a0cbaae3))
* **copy:** duration should not be negative ([#101](https://github.com/linz/argo-tasks/issues/101)) ([34cdc0a](https://github.com/linz/argo-tasks/commit/34cdc0abbbd02706edeb57a6b50156df6840a642))
* create-manifest command name typo ([#127](https://github.com/linz/argo-tasks/issues/127)) ([10e90df](https://github.com/linz/argo-tasks/commit/10e90df12e457bf81ae78d4fd79d2834c981d678))
* error if tileset validation fails TDE-586 ([#135](https://github.com/linz/argo-tasks/issues/135)) ([09ca6ea](https://github.com/linz/argo-tasks/commit/09ca6eaf19b142aec7424da543c2ed6386db0213))
* **list:** upgrade chunkd to allow listing to work ([3a7a975](https://github.com/linz/argo-tasks/commit/3a7a9751352846e5d1bf9ee6ae984d222ebd998e))
* report validation success at end ([#128](https://github.com/linz/argo-tasks/issues/128)) ([834c718](https://github.com/linz/argo-tasks/commit/834c71836ac09460900e16b8b7e08e38b8d5828c))
* trim \n from all arguments ([#81](https://github.com/linz/argo-tasks/issues/81)) ([33ea859](https://github.com/linz/argo-tasks/commit/33ea85991cda00be00d1e6e957bf6cbe8bcf28ef))

## 1.0.0 (2022-08-24)


### Features

* **lds-fetch-layer:** add data fetcher from lds ([8a7ec3b](https://github.com/linz/argo-tasks/commit/8a7ec3baf67edb54c2ec5c43e4a736875f96d2c9))
* **lds-fetch-layer:** allow fetching of specific versions ([f1c950b](https://github.com/linz/argo-tasks/commit/f1c950b3b3fff4d6cfdfdcf163900676496ab8db))

## 0.0.2 (2022-08-11)


### ⚠ BREAKING CHANGES

* this switches from commonjs to ESM modules

### Features

* create github release on version tag ([#10](https://github.com/linz/template-javascript-hello-world/issues/10)) ([550cf40](https://github.com/linz/template-javascript-hello-world/commit/550cf406918c06faac6bf7b2e57500f5f4be621a))
* initial commit ([9ed41de](https://github.com/linz/template-javascript-hello-world/commit/9ed41de00ea3cf08eda07563bc444c124fb6814c))
* switch to ESM modules for packaging ([#12](https://github.com/linz/template-javascript-hello-world/issues/12)) ([b82767f](https://github.com/linz/template-javascript-hello-world/commit/b82767fa973324a23f9f6eb692147f603ea6a0cc))


### Bug Fixes

* get typescript to compile into esm ([cff197b](https://github.com/linz/template-javascript-hello-world/commit/cff197be277a9f13277f10276cc93d1a6835328e))


### Continuous Integration

* switch to release-please for release automation ([c5ad62d](https://github.com/linz/template-javascript-hello-world/commit/c5ad62d7fc96a198618bebb716702c56758e9824))
