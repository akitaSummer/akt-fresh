import path from "node:path";
import renderToString from "preact-render-to-string";
import express from "express";

import { ServerContext } from "./context.mjs";
import {
  INTERNAL_PREFIX,
  depsCache,
  islandsCache,
  staticCache,
  __dirname,
  ENCOUNTERED_ISLANDS,
  genVNode,
  template,
} from "./utils.mjs";

const app = express();

const start = (ctx) => {
  ctx.routes.forEach((route) => {
    app.get(`/${route.id.replace(".mjs", "")}`, async (req, res) => {
      if (!route.handler) {
        return res.sendFile(
          path.join(staticCache, `/${route.id.replace(".mjs", ".html")}`)
        );
      }

      const props = await route.handler(req);

      ENCOUNTERED_ISLANDS.clear();
      const vnode = genVNode(route.component, props);
      const s = renderToString(vnode);

      res.setHeader("Content-Type", "text/html");
      res.send(template(s));
    });
  });

  ctx.deps.forEach((dep) => {
    app.get(`${INTERNAL_PREFIX}/${dep}`, async (req, res) => {
      return res.sendFile(path.join(depsCache, `./${dep}.js`));
    });
  });

  ctx.islands.forEach((island) => {
    app.get(
      `${INTERNAL_PREFIX}/js/island/${island.id.replace(".mjs", ".js")}`,
      async (req, res) => {
        return res.sendFile(
          path.join(islandsCache, `/${island.id.replace(".mjs", ".js")}`)
        );
      }
    );
  });

  app.get(`${INTERNAL_PREFIX}/js/main.js`, async (req, res) => {
    return res.sendFile(path.join(__dirname, `../client/main.js`));
  });

  console.log(ctx.deps);

  app.listen(7096, () => {
    console.log("http://localhost:7096");
  });
};

export const run = async () => start(await ServerContext.createServerContext());
