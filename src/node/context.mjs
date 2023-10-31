import fs from "node:fs/promises";
import path from "node:path";
import { rimraf } from "rimraf";
import esbuild from "esbuild";
import renderToString from "preact-render-to-string";

import {
  __filename,
  __dirname,
  cacheDir,
  islandsCache,
  routesCache,
  depsCache,
  staticCache,
  INTERNAL_PREFIX,
  ISLANDS,
  ENCOUNTERED_ISLANDS,
  fixIslandExternal,
  depsExternal,
  fsExists,
  genVNode,
  template,
} from "./utils.mjs";

export class ServerContext {
  #routes;
  #islands;
  #deps;
  // #staticFiles;
  // #bundler;
  // #renderFn;
  // #middlewares;
  // #app;
  // #notFound;
  // #error;

  constructor(
    routes,
    islands,
    deps
    // staticFiles,
    // renderfn,
    // middlewares,
    // app,
    // notFound,
    // error
  ) {
    this.#routes = routes;
    this.#islands = islands;
    this.#deps = deps;
    // this.#staticFiles = staticFiles;
    // this.#renderFn = renderfn;
    // this.#middlewares = middlewares;
    // this.#app = app;
    // this.#notFound = notFound;
    // this.#error = error;
    // this.#bundler = new Bundler(this.#islands, importMapURL);
  }

  get routes() {
    return this.#routes;
  }

  get islands() {
    return this.#islands;
  }

  get deps() {
    return this.#deps;
  }

  static async createServerContext() {
    const [routeDir, islandDir] = await Promise.all([
      fs.readdir(path.join(__dirname, "../../example/routes")),
      fs.readdir(path.join(__dirname, "../../example/islands")),
    ]);

    const routeNames = routeDir.filter((item) => item.endsWith(".jsx"));

    const islandNames = islandDir.filter((item) => item.endsWith(".jsx"));

    const cacheExist = await fsExists(cacheDir);

    if (cacheExist) {
      await rimraf(cacheDir);
    }

    await Promise.all([
      fs.mkdir(islandsCache, { recursive: true }),
      fs.mkdir(routesCache, { recursive: true }),
      fs.mkdir(depsCache, { recursive: true }),
      fs.mkdir(staticCache, { recursive: true }),
    ]);

    const {
      default: { dependencies, devDependencies },
    } = await import(path.join(__dirname, "../../package.json"), {
      assert: { type: "json" },
    });

    const deps = Object.keys(devDependencies ?? {}).concat(
      Object.keys(dependencies ?? {})
    );

    const routeExternal = [
      ...deps,
      ...islandNames.map(
        (island) => "../islands/" + island.replace(".jsx", "")
      ),
    ];

    const esdeps = [];
    await Promise.all(
      ["preact/hooks", ...deps].map(async (dep) => {
        const {
          default: { module },
        } = await import(
          path.join(__dirname, `../../node_modules/${dep}/package.json`),
          {
            assert: { type: "json" },
          }
        );
        if (module) {
          esdeps.push(dep);
        }
      })
    );

    await Promise.all([
      ...routeNames.map(async (route) => {
        const res = await esbuild.build({
          entryPoints: [path.join(__dirname, `../../example/routes/${route}`)],
          outdir: "/dist",
          format: "esm",
          write: false,
          bundle: true,
          target: "esnext",
          platform: "browser",
          loader: { ".js": "jsx" },
          define: { "process.env.NODE_ENV": "production" },
          jsxFactory: "h",
          jsxFragment: "Fragment",
          external: routeExternal,
          plugins: [fixIslandExternal()],
        });

        await fs.writeFile(
          path.join(routesCache, `./${route.replace(".jsx", ".mjs")}`),
          `import { h } from "preact";\n${res.outputFiles[0].text}`
        );
      }),
      ...islandNames.map(async (island) => {
        const res = await esbuild.build({
          entryPoints: [
            path.join(__dirname, `../../example/islands/${island}`),
          ],
          outdir: "/dist",
          format: "esm",
          write: false,
          bundle: true,
          target: "esnext",
          platform: "browser",
          loader: { ".js": "jsx" },
          define: { "process.env.NODE_ENV": "production" },
          jsxFactory: "h",
          jsxFragment: "Fragment",
          external: [...deps],
        });

        await fs.writeFile(
          path.join(islandsCache, `./${island.replace(".jsx", ".mjs")}`),
          `import { h } from "preact";\n${res.outputFiles[0].text}`
        );
      }),

      ...islandNames.map(async (island) => {
        const res = await esbuild.build({
          entryPoints: [
            path.join(__dirname, `../../example/islands/${island}`),
          ],
          outdir: "/dist",
          format: "esm",
          write: false,
          bundle: true,
          target: "esnext",
          platform: "browser",
          loader: { ".js": "jsx" },
          define: { "process.env.NODE_ENV": "production" },
          jsxFactory: "h",
          jsxFragment: "Fragment",
          external: [...deps],
          plugins: [depsExternal(esdeps)],
        });

        await fs.writeFile(
          path.join(islandsCache, `./${island.replace(".jsx", ".js")}`),
          `import { h } from "${INTERNAL_PREFIX}/preact";\n${res.outputFiles[0].text}`
        );
      }),
      ...["preact/hooks", ...deps].map(async (dep) => {
        const {
          default: { module },
        } = await import(
          path.join(__dirname, `../../node_modules/${dep}/package.json`),
          {
            assert: { type: "json" },
          }
        );
        if (module) {
          const res = await esbuild.build({
            entryPoints: [
              path.join(
                __dirname,
                `../../node_modules/${dep}/${module ?? main}`
              ),
            ],
            outdir: "/dist",
            format: "esm",
            write: false,
            bundle: true,
            target: "esnext",
            platform: "browser",
            define: { "process.env.NODE_ENV": "production" },
            external: [...esdeps],
            plugins: [depsExternal(esdeps)],
          });
          if (dep.includes("/")) {
            const dir = dep.split("/").slice(0, -1).join("/");
            await fs.mkdir(path.join(depsCache, `./${dir}`), {
              recursive: true,
            });
          }
          await fs.writeFile(
            path.join(depsCache, `./${dep}.js`),
            `${res.outputFiles[0].text}`
          );
        }
      }),
    ]);

    const routesCacheNames = (await fs.readdir(routesCache)).filter((item) =>
      item.endsWith(".mjs")
    );
    const islandsCacheNames = (await fs.readdir(islandsCache)).filter((item) =>
      item.endsWith(".mjs")
    );

    const routes = [];
    const islands = [];

    await Promise.all(
      islandsCacheNames.map(async (cache) => {
        const esm = await import(path.join(islandsCache, `./${cache}`));
        const detail = {
          id: cache,
          name: cache,
          component: esm.default,
          handler: esm.handler,
        };
        islands.push(detail);
        ISLANDS.push(detail);
      })
    );
    await Promise.all(
      routesCacheNames.map(async (cache) => {
        ENCOUNTERED_ISLANDS.clear();
        const esm = await import(path.join(routesCache, `./${cache}`));
        if (!esm.handler) {
          const vnode = genVNode(esm.default);
          const s = renderToString(vnode);
          await fs.writeFile(
            path.join(staticCache, cache.replace(".mjs", ".html")),
            template(s)
          );
        }
        routes.push({
          id: cache,
          name: cache,
          component: esm.default,
          handler: esm.handler,
        });
      })
    );

    return new ServerContext(routes, islands, esdeps);
  }
}
