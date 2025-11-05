# Changelog

## [5.1.0](https://github.com/linz/argo-tasks/compare/v5.0.0...v5.1.0) (2025-11-05)


### Features

* **stac-setup:** always validate gsd TDE-1675 ([#1289](https://github.com/linz/argo-tasks/issues/1289)) ([959b407](https://github.com/linz/argo-tasks/commit/959b407b64060f5a62e33b09759b37bab2d65b82))

## [5.0.0](https://github.com/linz/argo-tasks/compare/v4.21.2...v5.0.0) (2025-11-02)


### ⚠ BREAKING CHANGES

* **tileindex-validate:** automatically select scale of output tiles TDE-1674 ([#1287](https://github.com/linz/argo-tasks/issues/1287))

### Features

* **stac-collection-output:** get scale from ODR dataset TDE-1673 ([#1282](https://github.com/linz/argo-tasks/issues/1282)) ([73361b5](https://github.com/linz/argo-tasks/commit/73361b51321e219b99d5e3afa8fdf7774e2fe07f))
* **tileindex-validate:** automatically select scale of output tiles TDE-1674 ([#1287](https://github.com/linz/argo-tasks/issues/1287)) ([e2228f8](https://github.com/linz/argo-tasks/commit/e2228f8c2e967de3a8b32e30985f0ff2e28f048d))

## [4.21.2](https://github.com/linz/argo-tasks/compare/v4.21.1...v4.21.2) (2025-10-29)


### Bug Fixes

* **verify-restore:** should not mark restore manifest done TDE-1703 ([#1286](https://github.com/linz/argo-tasks/issues/1286)) ([266e8e5](https://github.com/linz/argo-tasks/commit/266e8e50def18f619e86bed0b931ae1fa6763978))


### Performance Improvements

* load and process the tiffs in a concurrent queue TDE-1681 ([#1283](https://github.com/linz/argo-tasks/issues/1283)) ([fc7e2fa](https://github.com/linz/argo-tasks/commit/fc7e2fa9970e3ca1d94f132aa5439838b8e6db7d))

## [4.21.1](https://github.com/linz/argo-tasks/compare/v4.21.0...v4.21.1) (2025-10-15)


### Bug Fixes

* `tileindex-validate` log TIFF sources on get resolution error TDE-1677 ([#1275](https://github.com/linz/argo-tasks/issues/1275)) ([9f87ed7](https://github.com/linz/argo-tasks/commit/9f87ed733d47ada94d6b8a17cbaadb4f8919a566))

## [4.21.0](https://github.com/linz/argo-tasks/compare/v4.20.0...v4.21.0) (2025-09-28)


### Features

* increase default zstd compression level TDE-1591 ([#1273](https://github.com/linz/argo-tasks/issues/1273)) ([7fe357e](https://github.com/linz/argo-tasks/commit/7fe357ebc9a94d0524bea008829b53377806e5de))

## [4.20.0](https://github.com/linz/argo-tasks/compare/v4.19.3...v4.20.0) (2025-09-21)


### Features

* Stac setup to check GSD against collection.json TDE-1654 ([#1269](https://github.com/linz/argo-tasks/issues/1269)) ([7237f83](https://github.com/linz/argo-tasks/commit/7237f83a180cfd4d2264610da284119eaa926a91))
* tileindex-validate to output GSD TDE-1655 ([#1268](https://github.com/linz/argo-tasks/issues/1268)) ([859ba6c](https://github.com/linz/argo-tasks/commit/859ba6cde5177a06704be973b3d6042208e27406))


### Bug Fixes

* accept aerial-photos as category TDE-1650 ([#1265](https://github.com/linz/argo-tasks/issues/1265)) ([80d73b6](https://github.com/linz/argo-tasks/commit/80d73b678e98dde39135db209c9fd68565a0b016))

## [4.19.3](https://github.com/linz/argo-tasks/compare/v4.19.2...v4.19.3) (2025-09-11)


### Bug Fixes

* file copy filter applies to filename only TDE-1642 ([#1264](https://github.com/linz/argo-tasks/issues/1264)) ([83cf57b](https://github.com/linz/argo-tasks/commit/83cf57b30b314bcba3ba7a89bb8d95653e826b49))
* mapsheet coverage identifies all items as new TDE-1641 ([#1262](https://github.com/linz/argo-tasks/issues/1262)) ([3646e4f](https://github.com/linz/argo-tasks/commit/3646e4f1d97ea981477db4057eb4b726aae60324))

## [4.19.2](https://github.com/linz/argo-tasks/compare/v4.19.1...v4.19.2) (2025-09-08)


### Bug Fixes

* register https and http FS for all commands. TDE-1637 ([#1260](https://github.com/linz/argo-tasks/issues/1260)) ([c69a972](https://github.com/linz/argo-tasks/commit/c69a97267687374120f2d340abbcac23b598eceb))

## [4.19.1](https://github.com/linz/argo-tasks/compare/v4.19.0...v4.19.1) (2025-09-08)


### Bug Fixes

* local folders did not get deleted TDE-1627 ([#1257](https://github.com/linz/argo-tasks/issues/1257)) ([f89d972](https://github.com/linz/argo-tasks/commit/f89d972c69d2142e2e44620a3a06f17f77d71c92))
* stac setup path join TDE-1634 ([#1258](https://github.com/linz/argo-tasks/issues/1258)) ([51c24ba](https://github.com/linz/argo-tasks/commit/51c24ba94bab14b1d633cef79e11be7fa067b97f))

## [4.19.0](https://github.com/linz/argo-tasks/compare/v4.18.0...v4.19.0) (2025-09-07)


### Features

* delete empty folders TDE-1627 ([#1256](https://github.com/linz/argo-tasks/issues/1256)) ([4dea9fb](https://github.com/linz/argo-tasks/commit/4dea9fb8fd79e2093cae81b995b44e8aaec021bb))


### Bug Fixes

* `ResultMessage` should be trimmed TDE-1554 ([#1248](https://github.com/linz/argo-tasks/issues/1248)) ([04d20b7](https://github.com/linz/argo-tasks/commit/04d20b78784d3449dce6de389c023ac9245143d0))
* decode url passed from CSV report TDE-1603 ([#1246](https://github.com/linz/argo-tasks/issues/1246)) ([caa9ff3](https://github.com/linz/argo-tasks/commit/caa9ff3f0c96ec97ed3e9503d50ec68bfbf60da2))
* ongoing-request=false is not parsed correctly TDE-1554 ([#1251](https://github.com/linz/argo-tasks/issues/1251)) ([5db2c75](https://github.com/linz/argo-tasks/commit/5db2c7528ec20c9c0b69db2dcd8830ac65e0edb0))

## [4.18.0](https://github.com/linz/argo-tasks/compare/v4.17.0...v4.18.0) (2025-08-07)


### Features

* **basemaps:** Pass ODR pull request url into basemap-config PR. BM-1324 ([#1235](https://github.com/linz/argo-tasks/issues/1235)) ([9a710ed](https://github.com/linz/argo-tasks/commit/9a710edc2660519645a9fe77c9e0e91a7c1f47c0))
* implement decompression in copy command TDE-1590 ([#1242](https://github.com/linz/argo-tasks/issues/1242)) ([a0ff51a](https://github.com/linz/argo-tasks/commit/a0ff51a9fc0aed3748d234e2b7ad71baf9d09264))
* stop using GITHUB_TOKEN for release-please TDE-1584  ([#1243](https://github.com/linz/argo-tasks/issues/1243)) ([c8d13b1](https://github.com/linz/argo-tasks/commit/c8d13b1a1354c22c6b5ffbc33d497c05b655c0b3))
* validate restored state of S3 objects from S3 Batch restore report TDE-1554 ([#1239](https://github.com/linz/argo-tasks/issues/1239)) ([413a028](https://github.com/linz/argo-tasks/commit/413a0283a4407640de11f70c00c2cf609fd58c19))


### Bug Fixes

* identify-updated-items should return ordered input based on collection order TDE-1588 ([#1241](https://github.com/linz/argo-tasks/issues/1241)) ([c3e1ce5](https://github.com/linz/argo-tasks/commit/c3e1ce537fc76d264f5c701b6fe591b3bd67f20c))

## [4.17.0](https://github.com/linz/argo-tasks/compare/v4.16.0...v4.17.0) (2025-06-10)


### Features

* **basemaps:** Add support for NZTM vector tiles in PR creation ([#1234](https://github.com/linz/argo-tasks/issues/1234)) ([297ce8c](https://github.com/linz/argo-tasks/commit/297ce8c838ad5eb29f33812a69ae7f4c42a2c4c7))


### Bug Fixes

* **basemaps:** Fix the topographic pull request creation to support topgraphic-v2. BM-1203 ([#1230](https://github.com/linz/argo-tasks/issues/1230)) ([772c115](https://github.com/linz/argo-tasks/commit/772c1154c4a97f918959787e99947e87ccf95ee4))

## [4.16.0](https://github.com/linz/argo-tasks/compare/v4.15.0...v4.16.0) (2025-05-30)


### Features

* generate path for scanned-aerial-photos TDE-1522 ([#1231](https://github.com/linz/argo-tasks/issues/1231)) ([72d7373](https://github.com/linz/argo-tasks/commit/72d7373606cf4fd89413172e794027a55252c345))

## [4.15.0](https://github.com/linz/argo-tasks/compare/v4.14.2...v4.15.0) (2025-05-28)


### Features

* archive-setup command returning archive location based on source path TDE-1500 ([#1218](https://github.com/linz/argo-tasks/issues/1218)) ([018dc2a](https://github.com/linz/argo-tasks/commit/018dc2ac5faf21237cf0e95dd5c8293e3dd3b707))
* compress and delete source files TDE-1482 ([#1216](https://github.com/linz/argo-tasks/issues/1216)) ([487fb30](https://github.com/linz/argo-tasks/commit/487fb30db7d5910c0ea59c4147e0e5ea86cad33e))


### Bug Fixes

* package information is not logged when command has not started TDE-1511 ([#1226](https://github.com/linz/argo-tasks/issues/1226)) ([b62240c](https://github.com/linz/argo-tasks/commit/b62240cec1c342b10c7bbccebd39b6e521842a15))

## [4.14.2](https://github.com/linz/argo-tasks/compare/v4.14.1...v4.14.2) (2025-05-21)


### Bug Fixes

* stac-setup `--geographic-description` should be optional TDE-1510 ([#1224](https://github.com/linz/argo-tasks/issues/1224)) ([f98d3b6](https://github.com/linz/argo-tasks/commit/f98d3b6eb0a773ecd5ee204d38c4ffd4951fd9f6))

## [4.14.1](https://github.com/linz/argo-tasks/compare/v4.14.0...v4.14.1) (2025-05-20)


### Bug Fixes

* allow reading from complex 🦄🌈 URLs TDE-1504 ([#1221](https://github.com/linz/argo-tasks/issues/1221)) ([1396443](https://github.com/linz/argo-tasks/commit/1396443d5c21c22d0e507b0accaf45ad3283f8c0))

## [4.14.0](https://github.com/linz/argo-tasks/compare/v4.13.1...v4.14.0) (2025-05-08)


### Features

* add linz/coastal repo TDE-1456 ([#1215](https://github.com/linz/argo-tasks/issues/1215)) ([7896196](https://github.com/linz/argo-tasks/commit/789619648ed8255ff9fc878a69c95384a132fa72))

## [4.13.1](https://github.com/linz/argo-tasks/compare/v4.13.0...v4.13.1) (2025-04-27)


### Bug Fixes

* update from .js to .ts files TDE-1474 ([#1211](https://github.com/linz/argo-tasks/issues/1211)) ([e5d875c](https://github.com/linz/argo-tasks/commit/e5d875cb9d35ae087444ca083942689a7956a157))

## [4.13.0](https://github.com/linz/argo-tasks/compare/v4.12.1...v4.13.0) (2025-04-22)


### Features

* **basemaps:** Create pull request for the DSM import into elevation.dsm.json config. BM-1245 ([#1205](https://github.com/linz/argo-tasks/issues/1205)) ([0af0884](https://github.com/linz/argo-tasks/commit/0af0884849e235640c3a43321582938cd5838cda))
* node 23 direct typescript ([#1201](https://github.com/linz/argo-tasks/issues/1201)) ([6ee1dec](https://github.com/linz/argo-tasks/commit/6ee1dec8c787f72634542855b508b7ab3e78ea21))
* support national DSM hillshades TDE-1455 ([#1210](https://github.com/linz/argo-tasks/issues/1210)) ([f3863e1](https://github.com/linz/argo-tasks/commit/f3863e1501974305c509b3dfd5403e3768c2766d))
* use `derived_from` checksum to see if tile needs re-creating TDE-1449 ([#1207](https://github.com/linz/argo-tasks/issues/1207)) ([10ee86b](https://github.com/linz/argo-tasks/commit/10ee86b2439916f795a94c63566f74bb4203eb92))

## [4.12.1](https://github.com/linz/argo-tasks/compare/v4.12.0...v4.12.1) (2025-03-24)


### Bug Fixes

* harmonize hillshade odr paths TDE-1447 ([#1202](https://github.com/linz/argo-tasks/issues/1202)) ([9effd49](https://github.com/linz/argo-tasks/commit/9effd492d97fad3b91c63b84f887da6a3e1d3c7c))

## [4.12.0](https://github.com/linz/argo-tasks/compare/v4.11.0...v4.12.0) (2025-02-18)


### Features

* add createFileList function TDE-1382 ([#1196](https://github.com/linz/argo-tasks/issues/1196)) ([3289d30](https://github.com/linz/argo-tasks/commit/3289d3076202efa1cc79fc639afc35d5efcbf52c))
* generate paths for new national hillshade products TDE-1378 ([#1193](https://github.com/linz/argo-tasks/issues/1193)) ([f2f8b68](https://github.com/linz/argo-tasks/commit/f2f8b688349ffe408ebd74d01ab3ac8d5b33da4c))
* **stac-setup:** support historical survey names LI-3977 ([#1198](https://github.com/linz/argo-tasks/issues/1198)) ([8890bbf](https://github.com/linz/argo-tasks/commit/8890bbfdbefb25dd86e13f5ab68690d413c6b793))
* **stac-setup:** support start dates ([#1199](https://github.com/linz/argo-tasks/issues/1199)) ([d7932c2](https://github.com/linz/argo-tasks/commit/d7932c297f6379c55e33e80fbf2c94e626b938e0))

## [4.11.0](https://github.com/linz/argo-tasks/compare/v4.10.0...v4.11.0) (2025-02-04)


### Features

* improve stac-validate logs TDE-1385 ([#1189](https://github.com/linz/argo-tasks/issues/1189)) ([27e0acf](https://github.com/linz/argo-tasks/commit/27e0acf637a9146d0e339d77425e364d9d7acf59))


### Bug Fixes

* **tileindex-validate:** log errors when validating presets fail ([#1180](https://github.com/linz/argo-tasks/issues/1180)) ([e2d75d7](https://github.com/linz/argo-tasks/commit/e2d75d78f85401ec5ef846ae27b98cee6335ce6d))

## [4.10.0](https://github.com/linz/argo-tasks/compare/v4.9.0...v4.10.0) (2024-12-20)


### Features

* retile datasets TDE-1352 ([#1152](https://github.com/linz/argo-tasks/issues/1152)) ([e339419](https://github.com/linz/argo-tasks/commit/e339419a6fe3488720ccbd0c8019f1720d0b0281))


### Bug Fixes

* include zero byte tiffs when validating files TDE-1348 ([#1156](https://github.com/linz/argo-tasks/issues/1156)) ([a1e54de](https://github.com/linz/argo-tasks/commit/a1e54de2f72b86764ee60415c543a9e549d3882c))
* remove GSD unit from stac setup command inputs TDE-1339 TDE-1211 ([#1153](https://github.com/linz/argo-tasks/issues/1153)) ([29d1871](https://github.com/linz/argo-tasks/commit/29d18710225db7b371dce3c9eca256088c92ba5f))

## [4.9.0](https://github.com/linz/argo-tasks/compare/v4.8.0...v4.9.0) (2024-11-29)


### Features

* **basemaps:** Update elevation config to insert the source is 2193 layer. BM-1125 ([#1139](https://github.com/linz/argo-tasks/issues/1139)) ([37f9030](https://github.com/linz/argo-tasks/commit/37f90305afb5fe39aee064ab4947f3e41d3a7f1e))
* generate path from slug TDE-1319 ([#1136](https://github.com/linz/argo-tasks/issues/1136)) ([48c29ac](https://github.com/linz/argo-tasks/commit/48c29acf3249c990f21989364f10d3bfd702e51c))


### Bug Fixes

* **basemaps:** Remove the elevation category for elevation layers. BM-1125 ([#1148](https://github.com/linz/argo-tasks/issues/1148)) ([40e8e0e](https://github.com/linz/argo-tasks/commit/40e8e0e579c98cd50c2b45ad1d74be91488b5baf))

## [4.8.0](https://github.com/linz/argo-tasks/compare/v4.7.0...v4.8.0) (2024-11-12)


### Features

* attempt to remove slivers by dropping small polygons TDE-1130 ([#1119](https://github.com/linz/argo-tasks/issues/1119)) ([aa1f931](https://github.com/linz/argo-tasks/commit/aa1f931684174eb24a55cc413d0f4ace780b9001))
* generate initial collection-related STAC metadata TDE-1300 ([#1124](https://github.com/linz/argo-tasks/issues/1124)) ([e30dff9](https://github.com/linz/argo-tasks/commit/e30dff9cd5dd54067539f23b37715f9c5d179528))

## [4.7.0](https://github.com/linz/argo-tasks/compare/v4.6.0...v4.7.0) (2024-10-21)


### Features

* **basemaps:** Add nz-elevation bucket as valid source s3 bucket. BM-1088 ([#1109](https://github.com/linz/argo-tasks/issues/1109)) ([bc09b74](https://github.com/linz/argo-tasks/commit/bc09b74e53b99de36b9c941711e19380c0ae8ddd))
* expose method to calculate a sheet code from any x,y ([#1110](https://github.com/linz/argo-tasks/issues/1110)) ([ffa03ad](https://github.com/linz/argo-tasks/commit/ffa03ada33108985d3fe866fd9b4eb421c2ee556))
* Flatten providers into strings per role TDE-1291 ([#1108](https://github.com/linz/argo-tasks/issues/1108)) ([92af2f9](https://github.com/linz/argo-tasks/commit/92af2f9b6343c8fe7bd77b253b55bb6c838e889b))


### Bug Fixes

* ensure file systems with matching roleArns are registered correctly TDE-1268 ([#1092](https://github.com/linz/argo-tasks/issues/1092)) ([e004506](https://github.com/linz/argo-tasks/commit/e00450605e3cfaf4b2d2ff2c399e3454cae0cbd8))

## [4.6.0](https://github.com/linz/argo-tasks/compare/v4.5.2...v4.6.0) (2024-10-13)


### Features

* annotate commands with examples ([#1097](https://github.com/linz/argo-tasks/issues/1097)) ([41be2c1](https://github.com/linz/argo-tasks/commit/41be2c10f0c745903adc5e33cea12fe960cab77c))


### Bug Fixes

* avoid negative parameter TDE-1261 ([#1104](https://github.com/linz/argo-tasks/issues/1104)) ([5352975](https://github.com/linz/argo-tasks/commit/5352975726d92e2fdd72309c94e10502f7315948))
* **basemaps:** Get the epsg and name correctly for elevation s3 path. BM-1088 ([#1074](https://github.com/linz/argo-tasks/issues/1074)) ([08e76e4](https://github.com/linz/argo-tasks/commit/08e76e480d068bf37af744d1678696e59f81b728))

## [4.5.2](https://github.com/linz/argo-tasks/compare/v4.5.1...v4.5.2) (2024-10-01)


### Reverts

* PR [#1090](https://github.com/linz/argo-tasks/issues/1090) ensure EAI_AGAIN middleware is added to new file systems TDE-1268 ([#1093](https://github.com/linz/argo-tasks/issues/1093)) ([ddda2e0](https://github.com/linz/argo-tasks/commit/ddda2e06a1e7520ca79616fd45d83be91c7fa778))

## [4.5.1](https://github.com/linz/argo-tasks/compare/v4.5.0...v4.5.1) (2024-10-01)


### Bug Fixes

* **copy:** add threadId to all logs created when running from threads TDE-1268 ([#1089](https://github.com/linz/argo-tasks/issues/1089)) ([3b6e6fe](https://github.com/linz/argo-tasks/commit/3b6e6fe0c5bd7cbfe4e2dfd4d9b92776e8abd17b))
* ensure EAI_AGAIN middleware is added to new file systems TDE-1268 ([#1090](https://github.com/linz/argo-tasks/issues/1090)) ([48ec902](https://github.com/linz/argo-tasks/commit/48ec902dd5ea63a994727fd7a1eb1530c706af91))

## [4.5.0](https://github.com/linz/argo-tasks/compare/v4.4.1...v4.5.0) (2024-09-29)


### Features

* allow excluding date from the survey name when generating path TDE-1261 ([#1067](https://github.com/linz/argo-tasks/issues/1067)) ([057e4d9](https://github.com/linz/argo-tasks/commit/057e4d9e5d8743c13f2348aab8c910e4b2c3f35b))

## [4.4.1](https://github.com/linz/argo-tasks/compare/v4.4.0...v4.4.1) (2024-09-26)


### Bug Fixes

* mapsheet-coverage output filename typo TDE-1164 ([#1085](https://github.com/linz/argo-tasks/issues/1085)) ([d8ba360](https://github.com/linz/argo-tasks/commit/d8ba360d72ab19f2be9b4a13a8bc2c55b264031d))

## [4.4.0](https://github.com/linz/argo-tasks/compare/v4.3.0...v4.4.0) (2024-09-25)


### Features

* add create mapsheet coverage command TDE-1130 ([#1048](https://github.com/linz/argo-tasks/issues/1048)) ([1447e85](https://github.com/linz/argo-tasks/commit/1447e85ec5f86b1cfe43a2980d812afb52101066))

## [4.3.0](https://github.com/linz/argo-tasks/compare/v4.2.5...v4.3.0) (2024-09-22)


### Features

* generate CLI README.md ([#1075](https://github.com/linz/argo-tasks/issues/1075)) ([249799a](https://github.com/linz/argo-tasks/commit/249799a80b09678e0b023676253ed19ceb8bc077))

## [4.2.5](https://github.com/linz/argo-tasks/compare/v4.2.4...v4.2.5) (2024-09-18)


### Bug Fixes

* correct GitHub PR title and branch logged ([#1071](https://github.com/linz/argo-tasks/issues/1071)) ([f189d41](https://github.com/linz/argo-tasks/commit/f189d41fdbde443cd21549f215a5720d54ec807c))

## [4.2.4](https://github.com/linz/argo-tasks/compare/v4.2.3...v4.2.4) (2024-08-30)


### Bug Fixes

* build process where it doesnt like " " ([#1049](https://github.com/linz/argo-tasks/issues/1049)) ([90bce27](https://github.com/linz/argo-tasks/commit/90bce27bdbb602a616b8cd08857e4b6405a7c8cc))
* include flatten parameter in stac-github-import TDE-1242 ([#1060](https://github.com/linz/argo-tasks/issues/1060)) ([201538d](https://github.com/linz/argo-tasks/commit/201538dc62f44664397c726004ed9249aa44571c))

## [4.2.3](https://github.com/linz/argo-tasks/compare/v4.2.2...v4.2.3) (2024-08-01)


### Bug Fixes

* **stac-validate:** work around race condition  when validating 100s of documents TDE-1212 ([#1040](https://github.com/linz/argo-tasks/issues/1040)) ([1d7f5d2](https://github.com/linz/argo-tasks/commit/1d7f5d2ea1191769c5b788eeb6a46d495fc1d6ff))

## [4.2.2](https://github.com/linz/argo-tasks/compare/v4.2.1...v4.2.2) (2024-07-23)


### Bug Fixes

* **basemaps:** Fix the output url path which got additional slash. ([#1023](https://github.com/linz/argo-tasks/issues/1023)) ([2cca93e](https://github.com/linz/argo-tasks/commit/2cca93e6854228bbef167de27e110a90db58024a))
* **basemaps:** Keep the existing settings when replacing existing layer. ([#1024](https://github.com/linz/argo-tasks/issues/1024)) ([fc736f5](https://github.com/linz/argo-tasks/commit/fc736f5bc9bd23a66939ea8ab15e3493e110ec84))
* **stac-validate:** cache json schema objects to reduce network failures TDE-1212 ([#1029](https://github.com/linz/argo-tasks/issues/1029)) ([0338068](https://github.com/linz/argo-tasks/commit/0338068cf5cf31129ff8de0b8617b55cb0f4925a))
* validate band information is consistent ([#1017](https://github.com/linz/argo-tasks/issues/1017)) ([ec64f65](https://github.com/linz/argo-tasks/commit/ec64f6588de7133f186a0f66cb027c3bf52f7959))

## [4.2.1](https://github.com/linz/argo-tasks/compare/v4.2.0...v4.2.1) (2024-06-21)


### Bug Fixes

* **basemaps:** Fix the aerial config path for create pr cli. ([#1013](https://github.com/linz/argo-tasks/issues/1013)) ([eed59e9](https://github.com/linz/argo-tasks/commit/eed59e9833176be7480134430b1d25ef12623d99))

## [4.2.0](https://github.com/linz/argo-tasks/compare/v4.1.0...v4.2.0) (2024-06-11)


### Features

* **basemaps:** Update the create-pr cli to support elevation config. BM-936 ([#953](https://github.com/linz/argo-tasks/issues/953)) ([1ddd8fb](https://github.com/linz/argo-tasks/commit/1ddd8fbfec78c4283541de66f76b1d27512944d8))
* verify multihash when copy TDE-1181 TDE-1172 ([#1001](https://github.com/linz/argo-tasks/issues/1001)) ([84e261b](https://github.com/linz/argo-tasks/commit/84e261b99829a136eadd90ba1c1d39c4d5da58be))


### Bug Fixes

* prevent deadlock when validating bits per sample TDE-1201 ([#1007](https://github.com/linz/argo-tasks/issues/1007)) ([5d44748](https://github.com/linz/argo-tasks/commit/5d44748aace4d7c837e1afb4ebcbd7fd02ad30c7))
* uniform checksum s3 metadata key TDE-1181 ([#999](https://github.com/linz/argo-tasks/issues/999)) ([c177234](https://github.com/linz/argo-tasks/commit/c17723499e7c55cad5559fd9eeb81376061f4aa2))

## [4.1.0](https://github.com/linz/argo-tasks/compare/v4.0.0...v4.1.0) (2024-05-23)


### Features

* allow paths to be split on ";" or "\n" ([#992](https://github.com/linz/argo-tasks/issues/992)) ([7284b23](https://github.com/linz/argo-tasks/commit/7284b23bdf0224cce2075246106b930fafd29208))


### Bug Fixes

* **basemaps:** Fix the collection.json path for the vector data. ([#987](https://github.com/linz/argo-tasks/issues/987)) ([17c8d89](https://github.com/linz/argo-tasks/commit/17c8d89a75bcd1b9325db9a69ca111b374c46c6b))

## [4.0.0](https://github.com/linz/argo-tasks/compare/v3.7.0...v4.0.0) (2024-05-08)


### ⚠ BREAKING CHANGES

* allow to validate asset checksums only TDE-1134 ([#982](https://github.com/linz/argo-tasks/issues/982))

### Features

* allow to validate asset checksums only TDE-1134 ([#982](https://github.com/linz/argo-tasks/issues/982)) ([aca5939](https://github.com/linz/argo-tasks/commit/aca59393016ae92a9a36bec0e0fb62e63cf98e5f))

## [3.7.0](https://github.com/linz/argo-tasks/compare/v3.6.1...v3.7.0) (2024-05-08)


### Features

* **basemaps:** Get vector title from the collection.json file. BM-1017 ([#970](https://github.com/linz/argo-tasks/issues/970)) ([73f912f](https://github.com/linz/argo-tasks/commit/73f912f2ecd62c98a070944d5ef8b2749fafa145))
* stac validate links checksum TDE-1134 ([#972](https://github.com/linz/argo-tasks/issues/972)) ([3bd091c](https://github.com/linz/argo-tasks/commit/3bd091cf9bc20bb190025610cbe859be1329b067))

## [3.6.1](https://github.com/linz/argo-tasks/compare/v3.6.0...v3.6.1) (2024-04-18)


### Bug Fixes

* only validate the tiffs are 8 bit if the preset is webp TDE-1151 TDE-895 ([#966](https://github.com/linz/argo-tasks/issues/966)) ([bf1cc94](https://github.com/linz/argo-tasks/commit/bf1cc946cc4d195f11ee658ce56e4d370918d455))

## [3.6.0](https://github.com/linz/argo-tasks/compare/v3.5.0...v3.6.0) (2024-04-18)


### Features

* add ticket numbers to the suffixes of commits and branches TDE-1146 ([#962](https://github.com/linz/argo-tasks/issues/962)) ([b99db86](https://github.com/linz/argo-tasks/commit/b99db861a16977fad81f7dde66d72d6a4f985a96))
* **basemaps:** Should skip creating pull request when exist instead of throwing errors. BM-1018 ([#965](https://github.com/linz/argo-tasks/issues/965)) ([b2b026e](https://github.com/linz/argo-tasks/commit/b2b026e95ce9f3a6394d21d3332342485a0c08a5))


### Bug Fixes

* Use Pacific/Auckland time zone for collection years TDE-1066 ([#946](https://github.com/linz/argo-tasks/issues/946)) ([cd63f09](https://github.com/linz/argo-tasks/commit/cd63f0937676825a7ce2a1595d66f86ff8230716))

## [3.5.0](https://github.com/linz/argo-tasks/compare/v3.4.0...v3.5.0) (2024-04-09)


### Features

* EAI_AGAIN middleware TDE-1114 ([#949](https://github.com/linz/argo-tasks/issues/949)) ([d09c718](https://github.com/linz/argo-tasks/commit/d09c7187e9a2f592b75f048bb3cadfc824da5e4f))

## [3.4.0](https://github.com/linz/argo-tasks/compare/v3.3.2...v3.4.0) (2024-04-03)


### Features

* **basemaps:** Update the create-pr cli to add new individual vector tileset. BM-992 ([#933](https://github.com/linz/argo-tasks/issues/933)) ([9234ffb](https://github.com/linz/argo-tasks/commit/9234ffb45d55918c0b7bd38b209ce91cb21bd185))
* detects and error if the tiff is not 8 bits TDE-895 ([#890](https://github.com/linz/argo-tasks/issues/890)) ([9e639b7](https://github.com/linz/argo-tasks/commit/9e639b7fae9bd63c9a938a3f1f2139dab4c6a921))
* force fully qualified domains for s3 requests TDE-1084 ([#940](https://github.com/linz/argo-tasks/issues/940)) ([3fdbf98](https://github.com/linz/argo-tasks/commit/3fdbf98b600ca27d67bbc807dedad2f1bf16029b))

## [3.3.2](https://github.com/linz/argo-tasks/compare/v3.3.1...v3.3.2) (2024-03-25)


### Bug Fixes

* Change bareword key to variable reference TDE-1100 ([#935](https://github.com/linz/argo-tasks/issues/935)) ([b710d87](https://github.com/linz/argo-tasks/commit/b710d87084af6c1af9b11b089b865276660e1737))

## [3.3.1](https://github.com/linz/argo-tasks/compare/v3.3.0...v3.3.1) (2024-03-20)


### Bug Fixes

* handle missing elevation basemaps config-url TDE-1100 ([#931](https://github.com/linz/argo-tasks/issues/931)) ([b025faa](https://github.com/linz/argo-tasks/commit/b025faa3931070d58ce52a6c5fd7767c69b09187))

## [3.3.0](https://github.com/linz/argo-tasks/compare/v3.2.1...v3.3.0) (2024-03-18)


### Features

* add new fields for GitHub PR TDE-1100 ([#923](https://github.com/linz/argo-tasks/issues/923)) ([3f53dc9](https://github.com/linz/argo-tasks/commit/3f53dc9188e37ab42c1adbaf260d19e5e30b8027))


### Bug Fixes

* **basemaps:** Fix the event category is not parsed and populated in the pull request. BM-982 ([#915](https://github.com/linz/argo-tasks/issues/915)) ([125cfd5](https://github.com/linz/argo-tasks/commit/125cfd51f67045b92d6d361064634db5121cc3ca))
* Lints TDE-1030 ([#860](https://github.com/linz/argo-tasks/issues/860)) ([c898187](https://github.com/linz/argo-tasks/commit/c89818759756572e6aaf4ada65425139d2e4a4ff))
* Run `throws` with the right arguments TDE-1030 ([#893](https://github.com/linz/argo-tasks/issues/893)) ([0c3e4a6](https://github.com/linz/argo-tasks/commit/0c3e4a60b7ec8044accda9050199363b876e9e0f))

## [3.2.1](https://github.com/linz/argo-tasks/compare/v3.2.0...v3.2.1) (2024-02-25)


### Bug Fixes

* all tiff alignment should be validated TDE-1013 ([#882](https://github.com/linz/argo-tasks/issues/882)) ([3642257](https://github.com/linz/argo-tasks/commit/36422570e14f5de8dab7b840afabd727b31d8846))

## [3.2.0](https://github.com/linz/argo-tasks/compare/v3.1.1...v3.2.0) (2024-02-23)


### Features

* add isKnown function to validate mapsheet code is part of the known sheet ranges ([#864](https://github.com/linz/argo-tasks/issues/864)) ([bfffc35](https://github.com/linz/argo-tasks/commit/bfffc35e7197b9bb886caa4f0b71e43602ae87c4))


### Bug Fixes

* validate that all TIFF locations have been extracted TDE-1013 ([#879](https://github.com/linz/argo-tasks/issues/879)) ([c8a54e4](https://github.com/linz/argo-tasks/commit/c8a54e4a157c7e119513b25fdc05ffe65b2504eb))

## [3.1.1](https://github.com/linz/argo-tasks/compare/v3.1.0...v3.1.1) (2024-02-19)


### Bug Fixes

* tileindex-validate errors should not been thrown asap TDE-1013 ([#877](https://github.com/linz/argo-tasks/issues/877)) ([0f95e4f](https://github.com/linz/argo-tasks/commit/0f95e4fa707fc41eea5805955a5d1a47e3a25afd))

## [3.1.0](https://github.com/linz/argo-tasks/compare/v3.0.2...v3.1.0) (2024-02-19)


### Features

* Slugify more characters TDE-1044 ([#875](https://github.com/linz/argo-tasks/issues/875)) ([66020a4](https://github.com/linz/argo-tasks/commit/66020a487952a73c706c62730f58a8f6089a0f60))

## [3.0.2](https://github.com/linz/argo-tasks/compare/v3.0.1...v3.0.2) (2024-02-18)


### Bug Fixes

* CI missing environment variable for secret ([#872](https://github.com/linz/argo-tasks/issues/872)) ([75ed70f](https://github.com/linz/argo-tasks/commit/75ed70fcb6d43bd30cb5481d00626a73d57f993e))

## [3.0.1](https://github.com/linz/argo-tasks/compare/v3.0.0...v3.0.1) (2024-02-16)


### Reverts

* "refactor: Move default value up the stack TDE-1030 ([#854](https://github.com/linz/argo-tasks/issues/854))" ([#867](https://github.com/linz/argo-tasks/issues/867)) ([bd2c505](https://github.com/linz/argo-tasks/commit/bd2c5053b004882026cd24d2692fa34d20e6c05f))

## [3.0.0](https://github.com/linz/argo-tasks/compare/v2.18.2...v3.0.0) (2024-02-11)


### ⚠ BREAKING CHANGES

* automate target path TDE-961 ([#828](https://github.com/linz/argo-tasks/issues/828))

### Features

* automate target path TDE-961 ([#828](https://github.com/linz/argo-tasks/issues/828)) ([7dd206a](https://github.com/linz/argo-tasks/commit/7dd206a7153ae9ff22369da09974f565bbd4845e))
* Handle 1:50k imagery TDE-1014 ([#855](https://github.com/linz/argo-tasks/issues/855)) ([8be7266](https://github.com/linz/argo-tasks/commit/8be726663c6f4002d76d97e3e40b62c0dcd35057))
* Slugify strings TDE-1019 ([#827](https://github.com/linz/argo-tasks/issues/827)) ([b0a7874](https://github.com/linz/argo-tasks/commit/b0a7874df994c473ccbfb0cb106886e4ea34bd50))


### Bug Fixes

* add tiff url to error messages TDE-961 ([#844](https://github.com/linz/argo-tasks/issues/844)) ([3f4b174](https://github.com/linz/argo-tasks/commit/3f4b174e00963676304b79e94f19bfd1f54f5ad1))
* interim fix for Rakiura Stewart Island tiles TDE-1015 ([#857](https://github.com/linz/argo-tasks/issues/857)) ([3b6e23f](https://github.com/linz/argo-tasks/commit/3b6e23f4d4d4b86cd95b4a2d6831538be3a52480))
* update target path naming hierarchy TDE-955 ([#845](https://github.com/linz/argo-tasks/issues/845)) ([5a8678d](https://github.com/linz/argo-tasks/commit/5a8678dc238f1deeb41e874c95778e60d5178123))

## [2.18.2](https://github.com/linz/argo-tasks/compare/v2.18.1...v2.18.2) (2023-12-15)


### Bug Fixes

* upgrade to latest cogeotiff to fix a number of bugs TDE-835 TDE-945 ([#753](https://github.com/linz/argo-tasks/issues/753)) ([b5856b1](https://github.com/linz/argo-tasks/commit/b5856b1a3f565682222f31bf6a6af6a5a65861e4))

## [2.18.1](https://github.com/linz/argo-tasks/compare/v2.18.0...v2.18.1) (2023-12-04)


### Bug Fixes

* specify bot email address in Pull Requests TDE-983 ([#786](https://github.com/linz/argo-tasks/issues/786)) ([ec8848d](https://github.com/linz/argo-tasks/commit/ec8848d9635cbfda138fd660b0e8fe3d176005af))

## [2.18.0](https://github.com/linz/argo-tasks/compare/v2.17.0...v2.18.0) (2023-12-01)


### Features

* Pin Node.js Docker image TDE-958 ([#766](https://github.com/linz/argo-tasks/issues/766)) ([98f1d1c](https://github.com/linz/argo-tasks/commit/98f1d1cbca395ff5a46f7e66244d744fd8bb3758))


### Bug Fixes

* Handle resolution multiple of 10 TDE-968 ([#780](https://github.com/linz/argo-tasks/issues/780)) ([2a2921f](https://github.com/linz/argo-tasks/commit/2a2921f33ea79f12184b918fcadc2b83549d809c))

## [2.17.0](https://github.com/linz/argo-tasks/compare/v2.16.0...v2.17.0) (2023-11-29)


### Features

* lint resolution TDE-938 ([#747](https://github.com/linz/argo-tasks/issues/747)) ([b4b8512](https://github.com/linz/argo-tasks/commit/b4b851208dddcca2a6b2c7419b882914276f9155))
* Lint workflows using actionlint TDE-919 ([#742](https://github.com/linz/argo-tasks/issues/742)) ([8c458b4](https://github.com/linz/argo-tasks/commit/8c458b4a1a1a5c48d6c604e72b3c91f15bbb6949))
* Pin actions to hashes TDE-934 ([#758](https://github.com/linz/argo-tasks/issues/758)) ([cd7d938](https://github.com/linz/argo-tasks/commit/cd7d93829b240b11bc627d35386e1340266cee52))


### Bug Fixes

* GitHub PAT for Argo Workflows Pull Requests TDE-940 ([#768](https://github.com/linz/argo-tasks/issues/768)) ([392371f](https://github.com/linz/argo-tasks/commit/392371f1403c71bc27dd756ae5a9bca640d1b2aa))
* Run code under test TDE-968 ([#779](https://github.com/linz/argo-tasks/issues/779)) ([9d4563f](https://github.com/linz/argo-tasks/commit/9d4563f28d8d704a15552fecfe742978f8214098))

## [2.16.0](https://github.com/linz/argo-tasks/compare/v2.15.1...v2.16.0) (2023-11-08)


### Features

* **basemaps:** Decompress basemaps config json file if it is gzip file. ([#738](https://github.com/linz/argo-tasks/issues/738)) ([1cbf015](https://github.com/linz/argo-tasks/commit/1cbf015c643f6c2637593a87aa1d553c1bb42f09))
* **basemaps:** Move create-mapsheet into argo task. BM-879 ([#727](https://github.com/linz/argo-tasks/issues/727)) ([a560882](https://github.com/linz/argo-tasks/commit/a56088232b91e4514e384f714656ea41dbefe695))
* lint imagery input target paths TDE-857 ([#730](https://github.com/linz/argo-tasks/issues/730)) ([ea996f8](https://github.com/linz/argo-tasks/commit/ea996f8f0263fefdd1b3baaa46d99721774bb6be))


### Bug Fixes

* **basemaps:** create-mapsheet config arg conflicts with role config arg ([#733](https://github.com/linz/argo-tasks/issues/733)) ([3b85208](https://github.com/linz/argo-tasks/commit/3b8520860f2c73848140d6ca1201608ac0ce30f1))

## [2.15.1](https://github.com/linz/argo-tasks/compare/v2.15.0...v2.15.1) (2023-10-09)


### Bug Fixes

* **basemaps:** Fix the default zoom level not populate to the config. BM-903 ([#688](https://github.com/linz/argo-tasks/issues/688)) ([7c91012](https://github.com/linz/argo-tasks/commit/7c910123cbac2be3fd1595ab165a88250ad576a6))

## [2.15.0](https://github.com/linz/argo-tasks/compare/v2.14.1...v2.15.0) (2023-10-03)


### Features

* re-point ci to argo-tasks ecr repository ([#681](https://github.com/linz/argo-tasks/issues/681)) ([d244e2f](https://github.com/linz/argo-tasks/commit/d244e2f82f7cc811360e2fa7df7f94ea783659a3))

## [2.14.1](https://github.com/linz/argo-tasks/compare/v2.14.0...v2.14.1) (2023-09-27)


### Bug Fixes

* **basemaps:** Fix the create pull request cli input to support the vector layer as well. ([#670](https://github.com/linz/argo-tasks/issues/670)) ([6d7d357](https://github.com/linz/argo-tasks/commit/6d7d357399677eec9bb70264ba0769fec285e6e3))
* collection.json is pushed to gh before pretty-printed TDE-893 ([#673](https://github.com/linz/argo-tasks/issues/673)) ([b98aea8](https://github.com/linz/argo-tasks/commit/b98aea8059750b7ab0bdda9c6f15b0e1fd720111))

## [2.14.0](https://github.com/linz/argo-tasks/compare/v2.13.0...v2.14.0) (2023-09-21)


### Features

* **basemaps:** Get the region from collection.json and validate the source and target bucket. ([#662](https://github.com/linz/argo-tasks/issues/662)) ([821225e](https://github.com/linz/argo-tasks/commit/821225ea2f2c7d1052ec223dba909312275663c8))
* **basemaps:** Remove the @basemaps/shared package from argo-tasks. ([#665](https://github.com/linz/argo-tasks/issues/665)) ([71449b8](https://github.com/linz/argo-tasks/commit/71449b8079ab373564f0956399e5c1517d391ae7))
* **basemaps:** Update the create-pr cli to take targets as input. ([#661](https://github.com/linz/argo-tasks/issues/661)) ([3b1bd1a](https://github.com/linz/argo-tasks/commit/3b1bd1a6609b55a73161f16c0ee9d9d2833ede0e))
* **bmc:** New github wrapper to use github api by pat. BM-878 ([#634](https://github.com/linz/argo-tasks/issues/634)) ([3d6c81e](https://github.com/linz/argo-tasks/commit/3d6c81ea85bed722b3b5bf80a868f1611b4787c0))
* pretty print JSON files TDE-759 ([#647](https://github.com/linz/argo-tasks/issues/647)) ([1beab94](https://github.com/linz/argo-tasks/commit/1beab943c24bbf7b183b01a5de0953770f56c5fe))


### Bug Fixes

* **basemaps:** Import config types from the file to avoid importing dynamo ([#666](https://github.com/linz/argo-tasks/issues/666)) ([6574d87](https://github.com/linz/argo-tasks/commit/6574d8762a4ff24012fdaab99643cdf795aa4525))
* **stac-sync:** add content type ([#645](https://github.com/linz/argo-tasks/issues/645)) ([a137084](https://github.com/linz/argo-tasks/commit/a137084cb0d53522ee7795f547b3b879cbc1c575))

## [2.13.0](https://github.com/linz/argo-tasks/compare/v2.12.0...v2.13.0) (2023-09-05)


### Features

* **cli:** Move the basemaps github create-pr cli into argo-tasks. BM-872 ([#627](https://github.com/linz/argo-tasks/issues/627)) ([a47b38a](https://github.com/linz/argo-tasks/commit/a47b38a556888a2c3df742e515692a2b23d6f12e))
* **group:** increase logging for grouping ([#609](https://github.com/linz/argo-tasks/issues/609)) ([2966586](https://github.com/linz/argo-tasks/commit/2966586f09d52565f8fdd2fb9420c7b17c404062))


### Bug Fixes

* **copy:** copy and fix content-types TDE-859 ([#633](https://github.com/linz/argo-tasks/issues/633)) ([cc7c5cc](https://github.com/linz/argo-tasks/commit/cc7c5cc60abae9831e121ba531f844ee63622bda))

## [2.12.0](https://github.com/linz/argo-tasks/compare/v2.11.0...v2.12.0) (2023-07-25)


### Features

* **group:** create a output file per item grouped ([#565](https://github.com/linz/argo-tasks/issues/565)) ([5d77c40](https://github.com/linz/argo-tasks/commit/5d77c40e56745e874f26561622b8dd3dc78baab2))


### Bug Fixes

* only join target and basepath if basepath exists TDE-777 ([#496](https://github.com/linz/argo-tasks/issues/496)) ([8c4ed41](https://github.com/linz/argo-tasks/commit/8c4ed418d04d5f03c276ae38f1910284b17e0a81))
* **publish-copy:** delete the failed copy file so it can be retried ([#554](https://github.com/linz/argo-tasks/issues/554)) ([6be7e94](https://github.com/linz/argo-tasks/commit/6be7e9494df78d23e23274c8dab0e8e1da41b127))

## [2.11.0](https://github.com/linz/argo-tasks/compare/v2.10.0...v2.11.0) (2023-07-12)


### Features

* ensure collection links are sorted with root as the first link ([#542](https://github.com/linz/argo-tasks/issues/542)) ([1fb1ad4](https://github.com/linz/argo-tasks/commit/1fb1ad4179a7ded3a34bfaf064d8594e48c04fc9))
* **group:** add --from-file to work with argo artifacts ([#541](https://github.com/linz/argo-tasks/issues/541)) ([83e7420](https://github.com/linz/argo-tasks/commit/83e7420a5e09d0028af8fbfe45304eb6c2993231))
* **group:** add cli to group input items into set size outputs ([#539](https://github.com/linz/argo-tasks/issues/539)) ([171365e](https://github.com/linz/argo-tasks/commit/171365eef4920354a86481cb0412d9a9c29a1fb2))
* include git version info in container ([#543](https://github.com/linz/argo-tasks/issues/543)) ([5ba6d4c](https://github.com/linz/argo-tasks/commit/5ba6d4c993d0ba3cbb74ff348a22b05f2ea722c5))


### Bug Fixes

* re-add --include option ([#538](https://github.com/linz/argo-tasks/issues/538)) ([248f137](https://github.com/linz/argo-tasks/commit/248f137b822c40e31b7e2588e864e6cc0b5d9484))

## [2.10.0](https://github.com/linz/argo-tasks/compare/v2.9.1...v2.10.0) (2023-07-05)


### Features

* support parsing tfw and point geotiff bounding boxes ([#503](https://github.com/linz/argo-tasks/issues/503)) ([cb181bf](https://github.com/linz/argo-tasks/commit/cb181bf11902288be19ba6714749260f66b0cdf7))
* tileindex-validate retile with geojson output TDE-780 & TDE-786 ([#508](https://github.com/linz/argo-tasks/issues/508)) ([5c7642c](https://github.com/linz/argo-tasks/commit/5c7642c81b1506a6e0936566e8c726f4adcc8c76))


### Bug Fixes

* do not mix image width and height with projection x and y. ([#509](https://github.com/linz/argo-tasks/issues/509)) ([47cc02a](https://github.com/linz/argo-tasks/commit/47cc02a0baaef165eb098d94e8dcd380c51c4129))

## [2.9.1](https://github.com/linz/argo-tasks/compare/v2.9.0...v2.9.1) (2023-06-07)


### Bug Fixes

* check for mismatching paths in manifest TDE-764 ([#479](https://github.com/linz/argo-tasks/issues/479)) ([bcf9446](https://github.com/linz/argo-tasks/commit/bcf9446debfbf31bcc34b8881783a1d5eade2ae5))
* collection had catalog type should be collection ([#466](https://github.com/linz/argo-tasks/issues/466)) ([c19c36e](https://github.com/linz/argo-tasks/commit/c19c36e694b6d297d568af88b8c2288c85ddd63c))

## [2.9.0](https://github.com/linz/argo-tasks/compare/v2.8.0...v2.9.0) (2023-05-22)


### Features

* **Dockerfile:** install git and openssh-client for push to github ([#460](https://github.com/linz/argo-tasks/issues/460)) ([ae444f1](https://github.com/linz/argo-tasks/commit/ae444f1fd93d9c1553db10c33c618c30815fd034))
* **stac-github-import:** import stac github ([#456](https://github.com/linz/argo-tasks/issues/456)) ([3763e0f](https://github.com/linz/argo-tasks/commit/3763e0f0eae63a4291abb7708d67831cbb4b690d))
* **tileindex-validate:** detect when tiffs are not in EPSG:2193 and error ([#448](https://github.com/linz/argo-tasks/issues/448)) ([e9d57b7](https://github.com/linz/argo-tasks/commit/e9d57b71c7e76edd13699dd5a4c71c3240297ca6))


### Bug Fixes

* dev dependencies were not installed before running prettier ([#461](https://github.com/linz/argo-tasks/issues/461)) ([5a3874b](https://github.com/linz/argo-tasks/commit/5a3874b56586b6b67fc1eae70e4a1614d2991a0a))
* **stac-validate:** support other schemes than http for links/references ([#458](https://github.com/linz/argo-tasks/issues/458)) ([a38581b](https://github.com/linz/argo-tasks/commit/a38581b405e270fbc53f902372293db6ccb0c6a7))

## [2.8.0](https://github.com/linz/argo-tasks/compare/v2.7.0...v2.8.0) (2023-05-15)


### Features

* **stac-catalog:** pretty print the Catalog output file ([#446](https://github.com/linz/argo-tasks/issues/446)) ([40c0201](https://github.com/linz/argo-tasks/commit/40c020152671c424090c69dbfb3e63fcc7dee9de))
* validate files for duplicates TDE-711 ([#404](https://github.com/linz/argo-tasks/issues/404)) ([c8be644](https://github.com/linz/argo-tasks/commit/c8be644e62809dd6cd4098612f9a59068c762d7c))

## [2.7.0](https://github.com/linz/argo-tasks/compare/v2.6.0...v2.7.0) (2023-05-09)


### Features

* organised the mapsheet api ([#422](https://github.com/linz/argo-tasks/issues/422)) ([63aa548](https://github.com/linz/argo-tasks/commit/63aa54832837f80515cc1ef817909b42f97ad27b))
* synchronize stac TDE-725 ([#417](https://github.com/linz/argo-tasks/issues/417)) ([f2fc5ff](https://github.com/linz/argo-tasks/commit/f2fc5ff3ca19a7806f9e4a3f7f29a09bf780688d))

## [2.6.0](https://github.com/linz/argo-tasks/compare/v2.5.1...v2.6.0) (2023-04-28)


### Features

* **stac-catalog:** checksum all collections in the catalog ([#395](https://github.com/linz/argo-tasks/issues/395)) ([405a2e7](https://github.com/linz/argo-tasks/commit/405a2e7a5bb0ea3dfd215611d044e662d8a2ef6c))
* **stac-catalog:** load collection titles from paths ([#389](https://github.com/linz/argo-tasks/issues/389)) ([7395c1f](https://github.com/linz/argo-tasks/commit/7395c1f6bfd4596d11807fa4c4e9dc518878d3f7))

## [2.5.1](https://github.com/linz/argo-tasks/compare/v2.5.0...v2.5.1) (2023-04-24)


### Bug Fixes

* Dockerfile entrypoint for GitHub Actions TDE-724 ([#382](https://github.com/linz/argo-tasks/issues/382)) ([6f65900](https://github.com/linz/argo-tasks/commit/6f65900ac212db3a200e472b07abc39f7680255d))

## [2.5.0](https://github.com/linz/argo-tasks/compare/v2.4.3...v2.5.0) (2023-04-20)


### Features

* create stac-catalog TDE-724 ([#373](https://github.com/linz/argo-tasks/issues/373)) ([7a01a2d](https://github.com/linz/argo-tasks/commit/7a01a2dfd9d65e38e48e638306d32e8b25660f63))


### Bug Fixes

* stac-validate --recursive fails with local path TDE-732 ([#368](https://github.com/linz/argo-tasks/issues/368)) ([4f6b2d4](https://github.com/linz/argo-tasks/commit/4f6b2d437f73ef4bc3b78c5b7827b920b9ee6002))

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
* concurrent queue should not stack trace on error ([#156](https://github.com/linz/argo-tasks/issues/156)) ([80b8d18](https://github.com/linz/argo-tasks/commit/80b8d18796a56f96ae5ed31f2cd1fbf0a0cbaae3))
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
