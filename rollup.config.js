var babel = require('rollup-plugin-babel');

module.exports = {
  entry: './app/quakemap.js',
  dest: './quakemap.bundle.js',
  format: 'iife',
  moduleName: 'quakemap',
  sourceMap: 'inline',
  globals: {
    angular: 'angular',
    lodash: '_',
    jquery: 'jQuery',
    rx: 'Rx'
  },
  plugins: [
    babel({ runtimeHelpers: true })
  ]
};
