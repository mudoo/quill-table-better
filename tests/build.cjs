const path = require('node:path');
const webpack = require('webpack');
const production = require('../config/webpack.prod');

async function build(mode) {
  const compiler = webpack({
    ...production,
    mode,
    devtool: false,
    output: { ...production.output, path: path.resolve(__dirname, '../.test-build', mode) },
    optimization: { minimize: mode === 'production' },
    module: {
      rules: production.module.rules.map(rule => rule.loader === 'ts-loader'
        ? { ...rule, options: { transpileOnly: true } }
        : rule)
    }
  });
  await new Promise((resolve, reject) => {
    compiler.run((error, stats) => {
      compiler.close(closeError => {
        if (error || closeError) return reject(error || closeError);
        if (stats.hasErrors()) return reject(new Error(stats.toString({ all: false, errors: true })));
        console.log(`Built ${mode} browser fixture`);
        resolve();
      });
    });
  });
}

(async () => {
  for (const mode of ['development', 'production']) await build(mode);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
