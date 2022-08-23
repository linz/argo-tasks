# Argo Tasks

Utility tasks containers for argo

## Why?

LINZ uses Argo workflows for running bulk data tasks in AWS, there are some utilities that are often needed for these tasks



## Command Line Tools


### lds-layer-fetch

Fetch a layer from the LDS and download it as GeoPackage

#### Example 

Fetch the latest version of layer `50063` - 50063-nz-chatham-island-airport-polygons-topo-150k and save it into /tmp/50063.gpkg

```bash
lds-layer-fetch --layer-id 50063 --target /tmp/50063.gpkg
```