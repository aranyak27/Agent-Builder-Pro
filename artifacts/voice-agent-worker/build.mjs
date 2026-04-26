import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/agent.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "dist/agent.mjs",
  sourcemap: true,
  packages: "external",
});
