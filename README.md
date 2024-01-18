# Argo Tasks

Utility tasks containers for argo

## Why?

LINZ uses [Argo workflows](https://argoproj.github.io/workflows/) for running bulk data tasks in AWS, there are some utilities that are often needed for these tasks

## Command Line Tools

- [lds-fetch-layer](#lds-fetch-layer)
- [create-manifest](#create-manifest)
- [group](#group)
- [generate-path](#generate-path)
- [list](#list)
- [pretty-print](#pretty-print)
- [stac catalog](#stac-catalog)
- [stac github-import](#stac-github-import)
- [stac sync](#stac-sync)
- [stac validate](#stac-validate)
- [tileindex-validate](#tileindex-validate)
- [bm-create-pr](#bm-create-pr)

### `lds-fetch-layer`

Fetch a layer from the LDS and download it as GeoPackage.

#### Example

Fetch the latest version of layer `50063` - 50063-nz-chatham-island-airport-polygons-topo-150k and save it into ./output:

```bash
lds-fetch-layer --target ./output 50063
```

Multiple layers can be fetched at the same time, fetch `51002` and `51000`:

```bash
lds-fetch-layer  --target ./output 51002 51000
```

### `generate-path`

Generate target path for ODR buckets using collection metadata.
For imagery naming conventions see: https://github.com/linz/imagery/blob/master/docs/naming.md
For elevation naming conventions see: https://github.com/linz/elevation/blob/master/docs/naming.md

#### Example

```bash
generate-path --target-bucket-name nz-imagery s3://linz-workflows-scratch/2024-01/04-is-niwe-hawkes-bay-l7tt4/flat/
```

### `list`

List files from AWS and split them into groups for processing.

#### Example

- List all tiffs in a folder:

```bash
list s3://linz-imagery/sample --include ".*.tiff$" --output /tmp/list.json
```

- List tiffs and split them into groups of 10:

```bash
list s3://linz-imagery/sample --include ".*.tiff$" --group 10  --output /tmp/list.json
```

- List tiffs and split them into groups of either 10 files or 100MB which ever comes first:

```bash
list s3://linz-imagery/sample --include ".*.tiff$" --group 10 --group-size 100MB --output /tmp/list.json
```

- Exclude a specific tiff:

```bash
list s3://linz-imagery/sample --include ".*.tiff$"  --exclude "BG33.tiff$" --output /tmp/list.json
```

### `pretty-print`

Format all JSON files within a directory using `prettier`.

#### Example

- Format and overwrite files:

```bash
pretty-print source/
```

- Create a copy of the formatted file in another flatten directory (testing only - does not handle duplicate filenames):

```bash
pretty-print source/ --target output/
```

### `create-manifest`

Generate a manifest of files that need to be copied and their target paths.

If $ACTION_PATH is set, store the resulting manifest files as json documents.

#### Example

```bash
create-manifest s3://link-workflow-artifacts/sample/flat --include ".*.tiff$"  --exclude "BG33.tiff$" --output /tmp/list.json --target s3://linz-imagery/sample
```

### `copy`

Copy a manifest of files between two locations, for manifest creation see [create-manifest](#create-manifest).

#### Example

```bash
copy ./debug/manifest-eMxkhansySrfQt79rIbAGOGrQ2ne-h4GdLXkbA3O6mo.json --concurrency 10
```

### `group`

group an input list into an array of arrays.

#### Example

```bash
group --size 2 "a" "b" "c" '["1","2","3"]'
# [["a","b"], ["c","1"], ["2", "3"]]
```

### `stac catalog`

Create STAC catalog JSON file when given links to catalog template JSON file and location to search for collection.json files.

#### Example

```bash
stac catalog --template catalog_template.json --output catalog.json /path/to/stac/
```

Example template file:

```json
{
  "stac_version": "1.0.0",
  "type": "Catalog",
  "id": "linz-imagery",
  "description": "Toitū Te Whenua Land Information New Zealand makes New Zealand's publicly owned aerial and satellite imagery archive freely available to use under an open licence. This public S3 bucket has been made available to enable bulk access and cloud-based data processing. You can also access the imagery through the LINZ Data Service or LINZ Basemaps.",
  "links": [
    { "rel": "self", "href": "https://linz-imagery.s3.ap-southeast-2.amazonaws.com/catalog.json" },
    { "rel": "root", "href": "./catalog.json" }
  ]
}
```

Output will look like:

```json
{
  "stac_version": "1.0.0",
  "type": "Catalog",
  "id": "linz-imagery",
  "description": "Toitū Te Whenua Land Information New Zealand makes New Zealand's publicly owned aerial and satellite imagery archive freely available to use under an open licence. This public S3 bucket has been made available to enable bulk access and cloud-based data processing. You can also access the imagery through the LINZ Data Service or LINZ Basemaps.",
  "links": [
    {
      "rel": "self",
      "href": "https://linz-imagery.s3.ap-southeast-2.amazonaws.com/catalog.json"
    },
    {
      "rel": "root",
      "href": "./catalog.json"
    },
    {
      "rel": "child",
      "href": "./auckland/auckland_2010-2011_0.125m/rgb/2193/collection.json",
      "title": "Auckland 0.125m Urban Aerial Photos (2010-2011)",
      "file:checksum": "1220670da4eb9d1e9a8ce209ac2894bc523ffc33d805718058ff268d20092f3596fd",
      "file:size": 387938
    },
    {
      "rel": "child",
      "href": "./auckland/auckland_2010-2012_0.5m/rgb/2193/collection.json",
      "title": "Auckland 0.5m Rural Aerial Photos (2010-2012)",
      "file:checksum": "1220fd8793f08d92ca52ebf283db98c847cf2a23730ff10e8da95121bbd753445068",
      "file:size": 23987
    }
  ]
}
```

### `stac github-import`

Format and push a STAC collection.json file to a GitHub repository. Used by the [publish-copy](https://github.com/linz/topo-workflows/blob/master/workflows/imagery/publish-copy.yaml) Argo Workflow.

#### Example

```bash
stac github-import --source s3://path/to/collection/ --target s3://linz-imagery/path/to/dataset/ --repo-name "linz/imagery-test)" (`--repo-name` is optional and defaults to linz/imagery).
```

### `stac sync`

Synchronise STAC (JSON) files from one path to another.

#### Example

```bash
stac sync /path/to/stac/ s3://linz-imagery/
```

### `stac validate`

Validate STAC file(s) from an S3 location

#### Example

- Validate a single item:

```bash
stac validate s3://linz-imagery-staging/test/stac-validate/item1.json
```

- Validate multiple items:

```bash
stac validate s3://linz-imagery-staging/test/stac-validate/item1.json s3://linz-imagery/test/test/item2.json
```

- Validate a collection and linked items:

```bash
stac validate --recursive s3://linz-imagery-staging/test/stac-validate/collection.json
```

- Validate a collection without validating linked items:

```bash
stac validate s3://linz-imagery-staging/test/stac-validate/collection.json
```

- Validate a the `file:checksum` of all assets inside of a collection:

```bash
stac validate --checksum --recursive s3://linz-imagery-staging/test/stac-validate/collection.json
```

### `tileindex-validate`

Validate or create retiling information for a list of tiffs.

Outputs files for visualisation of the tiles and as an list for [topo-imagery](https://github.com/linz/topo-imagery/pkgs/container/topo-imagery) to use for retiling with GDAL.

- `input.geojson` GeoJSON file containing the bounding boxes of the source files. Example: [input.geojson](docs/input.geojson)
- `output.geojson` GeoJSON file containing the bounding boxes of the requested target files. Example: [output.geojson](docs/output.geojson)
- `file-list.json` a list of source and target files to be used as an input for `topo-imagery`. Example: [file-list.json](docs/file-list.json)

`--validate`
Validate list of tiffs match a LINZ Mapsheet tile index and assert that there will be no duplicates. Example:

```bash
tileindex-validate --validate --scale 5000 s3://linz-imagery/auckland/auckland_2010-2012_0.5m/rgb/2193/
```

`--retile`
Output a list of tiles to be retiled to the scale specified, and which tilename they should receive when merged. Example:

```bash
tileindex-validate --retile --scale 10000 s3://linz-imagery/auckland/auckland_2010-2012_0.5m/rgb/2193/
```

### `bm-create-pr`

Fetch a layer from the LDS and download it as GeoPackage.

#### Example

- Create a pull request in the basemaps-config repo after imagery layer imported:

```bash
bm-create-pr --target
["s3://linz-basemaps/3857/gisborne-cyclone-gabrielle_2023_0.2m/01HAAYW5NXJMRMBZBHFPCNY71J/","s3://linz-basemaps/2193/gisborne-cyclone-gabrielle_2023_0.2m/01HAAYW5PMJ90MGRSQCB9YPX0W/"]
```

Add --individual flag to import layer into standalone individual config file, otherwise import into aerial map.
Add --vector flag to import new layer into vector map.

## Versioning and Release

To publish a release, the Pull Request opened by `release-please` bot needs to be merged:

1. Open the PR and verify that the `CHANGELOG` contains what you expect in the release. If the latest change you expect is not there, double-check that a GitHub Actions is not currently running or failed.
2. Approve and merge the PR.
3. Once the Pull Request is merged to `master` a [GitHub Action](https://github.com/linz/argo-tasks/blob/master/.github/workflows/release-please.yml) it creates the release and publish a new container tagged for this release.
