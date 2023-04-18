# Argo Tasks

Utility tasks containers for argo

## Why?

LINZ uses [Argo workflows](https://argoproj.github.io/workflows/) for running bulk data tasks in AWS, there are some utilities that are often needed for these tasks

## Command Line Tools

- [lds-fetch-layer](#lds-fetch-layer)
- [create-manifest](#create-manifest)
- [list](#list)
- [stac-validate](#stac-validate)

### lds-fetch-layer

Fetch a layer from the LDS and download it as GeoPackage

#### Example

Fetch the latest version of layer `50063` - 50063-nz-chatham-island-airport-polygons-topo-150k and save it into ./output

```bash
lds-fetch-layer --target ./output 50063
```

Multiple layers can be fetched at the same time, fetch `51002` and `51000`

```bash
lds-fetch-layer  --target ./output 51002 51000
```

### list

List files from AWS and split them into groups for processing

#### Example

List all tiffs in a folder

```bash
list s3://linz-imagery/sample --include ".*.tiff$" --output /tmp/list.json
```

List tiffs and split them into groups of 10

```bash
list s3://linz-imagery/sample --include ".*.tiff$" --group 10  --output /tmp/list.json
```

List tiffs and split them into groups of either 10 files or 100MB which ever comes first

```bash
list s3://linz-imagery/sample --include ".*.tiff$" --group 10 --group-size 100MB --output /tmp/list.json
```

Exclude a specific tiff

```bash
list s3://linz-imagery/sample --include ".*.tiff$"  --exclude "BG33.tiff$" --output /tmp/list.json
```

### create-manifest

Generate a manifest of files that need to be copied and their target paths.

if $ACTION_PATH is set, store the resulting manifest files as json documents

```
create-manifest s3://link-workflow-artifacts/sample/flat --include ".*.tiff$"  --exclude "BG33.tiff$" --output /tmp/list.json --target s3://linz-imagery/sample
```

### copy

Copy a manifest of files between two locations, for manifest creation see [create-manifest](#create-manifest)

```
copy ./debug/manifest-eMxkhansySrfQt79rIbAGOGrQ2ne-h4GdLXkbA3O6mo.json --concurrency 10
```

### stac-catalog

Create STAC catalog from collections(s)

#### Stac Catalog example

```bash
stac-catalog --id linz-example-id --output catalog.json directory1/collection.json directory2/collection.json
```

### stac-validate

Validate STAC file(s) from an S3 location

#### STAC Validate example

Validate a single item

```bash
stac-validate s3://linz-imagery-staging/test/stac-validate/item1.json
```

Validate multiple items

```bash
stac-validate s3://linz-imagery-staging/test/stac-validate/item1.json s3://linz-imagery/test/test/item2.json
```

Validate a collection and linked items

```bash
stac-validate --recursive s3://linz-imagery-staging/test/stac-validate/collection.json
```

Validate a collection without validating linked items

```bash
stac-validate s3://linz-imagery-staging/test/stac-validate/collection.json
```

Validate a the `file:checksum` of all assets inside of a collection

```bash
stac-validate --checksum --recursive s3://linz-imagery-staging/test/stac-validate/collection.json
```

## Versioning and Release

[googleapis/release-please](https://github.com/googleapis/release-please) is used to support the release process.
The library generates a `changelog` based on the commit messages.
