# Changelog

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
