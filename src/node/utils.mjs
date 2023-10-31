import path from "node:path";
import { h, options } from "preact";
import { fileURLToPath } from "node:url";
import crypto from "crypto";

export const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);

export const cacheDir = path.join(__dirname, "../../.akt_fresh");
export const islandsCache = path.join(cacheDir, "./islands");
export const routesCache = path.join(cacheDir, "./routes");
export const depsCache = path.join(cacheDir, "./packages");
export const staticCache = path.join(cacheDir, "./static");

export const INTERNAL_PREFIX = "/_frsh";

export const JS_PREFIX = `/js`;

export const BUILD_ID = crypto.randomUUID();

export const ISLANDS = [];
export const ENCOUNTERED_ISLANDS = new Set([]);
let ISLAND_PROPS = [];
const originalHook = options.vnode;
let ignoreNext = false;
options.vnode = (vnode) => {
  const originalType = vnode.type;
  if (typeof vnode.type === "function") {
    const island = ISLANDS.find((island) => island.component === originalType);
    if (island) {
      if (ignoreNext) {
        ignoreNext = false;
        return;
      }
      ENCOUNTERED_ISLANDS.add(island);
      vnode.type = (props) => {
        ignoreNext = true;
        const child = h(originalType, props);
        ISLAND_PROPS.push(props);
        return h(
          `!--frsh-${island.id}:${ISLAND_PROPS.length - 1}--`,
          null,
          child
        );
      };
    }
  }
  if (originalHook) originalHook(vnode);
};

export const fixIslandExternal = () => {
  return {
    name: "fixIslandExternal",
    setup(build) {
      build.onResolve({ filter: /(islands)/ }, (args) => ({
        path: args.path + ".mjs",
        external: true,
      }));
    },
  };
};

export const depsExternal = (arr) => {
  const regex = new RegExp(
    `^(${arr
      .map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|")})$`,
    "i"
  );
  console.log(regex);
  return {
    name: "depsExternal",
    setup(build) {
      build.onResolve({ filter: regex }, (args) => ({
        path: INTERNAL_PREFIX + "/" + args.path,
        external: true,
      }));
    },
  };
};

export const fsExists = async (path) => {
  try {
    await fs.access(path, fs.F_OK);
  } catch (e) {
    return false;
  }
  return true;
};

export const genVNode = (render, props) =>
  h(({ Component }) => h(Component, {}), {
    Component() {
      return h(render, props ?? {});
    },
  });

const bundleAssetUrl = (path) => {
  return `${INTERNAL_PREFIX}${JS_PREFIX}${path}`;
};

export const template = (s) => {
  let res = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charSet="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body>${s}</body>
  `;
  if (ENCOUNTERED_ISLANDS.size > 0) {
    // Prepare the inline script that loads and revives the islands
    let islandImports = "";
    let islandRegistry = "";
    for (const island of ENCOUNTERED_ISLANDS) {
      const randomNonce = crypto.randomUUID().replace(/-/g, "");
      const url = bundleAssetUrl(`/island/${island.id.replace(".mjs", ".js")}`);
      islandImports += `\nimport ${island.name.replace(
        ".mjs",
        ""
      )} from "${url}";`;
      islandRegistry += `\n  ${island.id.replace(
        ".mjs",
        ""
      )}: ${island.name.replace(".mjs", "")},`;
    }

    const initCode = `
    import { h } from "${INTERNAL_PREFIX}/preact";
    import { revive } from "${bundleAssetUrl(
      "/main.js"
    )}";${islandImports}\nrevive({${islandRegistry}\n});`;

    // Append the inline script to the body
    const randomNonce = crypto.randomUUID().replace(/-/g, "");

    return (
      res +
      `
    <script id="__FRSH_ISLAND_PROPS" type="application/json">${JSON.stringify(
      ISLAND_PROPS
    )}</script><script type="module" nonce="${randomNonce}">${initCode}</script>
    </html>`
    );
  }

  return (
    res +
    `
</html>
`
  );
};
