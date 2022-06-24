export default {
  extensions: ["ts"],
  nodeArguments: ["-r", "./esbuild-hook"],
  require: ['./src/__tests__/_cwd.js']
};
