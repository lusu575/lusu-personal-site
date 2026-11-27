import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");

const stripQueryPlugin = {
  name: "strip-relative-query",
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^\.\.?\/.*\?/ }, (args) => {
      const cleanPath = args.path.split("?", 1)[0];
      return {
        path: path.resolve(args.resolveDir, cleanPath)
      };
    });
  }
};

await build({
  entryPoints: [path.join(PROJECT_ROOT, "js/pond-windows/pond-site-bridge.mjs")],
  outfile: path.join(PROJECT_ROOT, "js/pond-windows/pond-site-bundle.mjs"),
  bundle: true,
  format: "esm",
  target: ["es2022"],
  minify: true,
  legalComments: "none",
  plugins: [stripQueryPlugin]
});

console.log("Built js/pond-windows/pond-site-bundle.mjs");
