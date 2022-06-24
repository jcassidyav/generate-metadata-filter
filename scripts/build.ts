import path from "path";
import { build as esbuild } from "esbuild";

const pkg = require(path.resolve("./package.json"));

const external = [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.peerDependencies || {})];

const baseConfig = {
    platform: "node" as const,
    target: "esnext" as const,
    format: "cjs" as const,
    nodePaths: [path.join(__dirname, "../src")],
    sourcemap: true,
    external: external
};

async function main() {
    await esbuild({
        ...baseConfig,
        outdir: path.join(__dirname, "../build/cjs"),
        entryPoints: [path.join(__dirname, "../src/index.ts")],
        bundle: true
    });

    await esbuild({
        ...baseConfig,
        format: "esm",
        outdir: path.join(__dirname, "../build/esm"),
        entryPoints: [path.join(__dirname, "../src/index.ts")],
        bundle: true
    });
}

if (require.main === module) {
    main();
}
