# Argo Tasks

Utility tasks containers for argo

## Why?

LINZ uses Argo workflows for running bulk data tasks in AWS, there are some utilities that are often needed for these tasks



## Command Line Tools


### lds-fetch-layer

Fetch a layer from the LDS and download it as GeoPackage

#### Example 

Fetch the latest version of layer `50063` - 50063-nz-chatham-island-airport-polygons-topo-150k and save it into /tmp/50063.gpkg

```bash
lds-fetch-layer --layer-id 50063 --target /tmp/50063.gpkg
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
