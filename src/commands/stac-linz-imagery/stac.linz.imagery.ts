import { fsa } from '@chunkd/fs';
import { command, option, positional, string } from 'cmd-ts';
import { isAbsolute } from 'path';
import { logger } from '../../log.js';
import { config, registerCli, verbose } from '../common.js';
import { ExecFileSync } from 'child_process';

/** is a path a URL */
export function isUrl(path: string): boolean {
  try {
    new URL(path);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Convert a path to relative
 *
 * https://foo.com + https://foo.com/bar.html => ./bar.html
 * s3://foo/ + s3://foo/bar/baz.html => ./bar/baz.html
 * /home/blacha + /home/blacha/index.json => ./index.json
 *
 * @param basePath path to make relative to
 * @param filePath target file
 * @returns relative path to file
 */
export function makeRelative(basePath: string, filePath: string): string {
  if (isUrl(filePath) || isAbsolute(filePath)) {
    if (!filePath.startsWith(basePath)) {
      throw new Error(`FilePaths are not relative base: ${basePath} file: ${filePath}`);
    }
    return filePath.slice(basePath.length);
  }
  return filePath;
}

export const commandStacLinzImagery = command({
  name: 'stac-linz-imagery',
  description: 'Format and push a linz-imagery collection.json file to GitHub',
  args: {
    config,
    verbose,
    source: option({
      type: string,
      long: 'source',
      description: 'Source location of the collection.json file',
    }),
    target: option({
      type: string,
      long: 'target',
      description: 'Target location for the collection.json file',
    }),
  },

  handler: async (args) => {
    registerCli(args);
    logger.info('StacCollectionCreation:Start');

    // source: s3://linz-workflow-artifacts/2023-04/25-ispi-manawatu-whanganui-2010-2011-0-4m-tttsb/flat/
    // target s3://linz-imagery/manawatu-whanganui/manawatu-whanganui_2010-2011_0.4m/rgb/2193/

    // const git_author_name = process.env['GIT_AUTHOR_NAME'] ?? 'Imagery[bot]';
    // const git_author_email = process.env['GIT_AUTHOR_EMAIL'] ?? 'imagery@linz.govt.nz';

    const gitName = 'Imagery[bot]';
    const gitEmail = 'placeholder@linz.govt.nz';

    const gitRepo = '/tmp/gitrepo/imagery/';
    // const sourceCollection = args.source.replace(/\/+$/, '') + '/collection.json';
    // const targetCollection = gitRepo + 'stac/' + args.target.replace('s3://linz-imagery/', '');
    // const gitBranch = '';
    const tmpCollection = '/tmp/collection.json';

    console.log(sourceCollection);
    console.log(targetCollection);
  },
});

// From topo-imagery
// # Clone the GitHub repo
// run_command(["git", "clone", """git@github.com:linz/imagery-test""", gitrepo], None)
// # Configure Git
// run_command(["git", "config", "user.email", git_author_email], gitrepo)
// run_command(["git", "config", "user.name", git_author_name], gitrepo)

// # Get the collection file
// get_log().info(
//     "download_collection", path=source_collection_file, target_path=tmp_collection_path
// )
// write(tmp_collection_path, read(source_collection_file))

// # Rewrite the self link and save the file to its repo location
// with open(tmp_collection_path) as cf:
//     coll = json.load(cf)
//     for link in coll["links"]:
//         if link["rel"] == "root":
//             coll["links"].remove(link)
//     coll["links"].append(
//         {
//             "rel": "root",
//             "href": "https://linz-imagery.s3.ap-southeast-2.amazonaws.com/catalog.json",
//             "type": "application/json",
//         },
//     )

//     # print(coll)

//     write(
//         "/tmp/tmp_collection.json",
//         json.dumps(coll, ensure_ascii=False, indent=2).encode("utf-8"),
//     )

// # Checkout branch
// run_command(["git", "checkout", "-b", "argo/" + git_branch_name], gitrepo)
// # Add and commit
// run_command(["git", "commit", "-am", "feat: " + git_branch_name], gitrepo)
// # Push branch
// run_command(["git", "push", "origin", "HEAD"], gitrepo)

// export async function createLinks(basePath: string, templateLinks: st.StacLink[]): Promise<st.StacLink[]> {
//   const collections = await fsa.toArray(fsa.list(basePath));

//   for (const coll of collections) {
//     if (coll.endsWith('/collection.json')) {
//       const relPath = makeRelative(basePath, coll);
//       const buf = await fsa.read(coll);
//       const collection = JSON.parse(buf.toString()) as st.StacCollection;
//       // Multihash header 0x12 - Sha256 0x20 - 32 bits of hex digest
//       const checksum = '1220' + createHash('sha256').update(buf).digest('hex');
//       const collLink: st.StacLink = {
//         rel: 'child',
//         href: fsa.join('./', relPath),
//         title: collection.title,
//         'file:checksum': checksum,
//         'file:size': buf.length,
//       };
//       templateLinks.push(collLink);
//     }
//   }
//   return templateLinks;
// }
