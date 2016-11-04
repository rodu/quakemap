var babel = require('rollup-plugin-babel');

module.exports = {
  entry: './app/quakemap.js',
  dest: './quakemap.bundle.js',
  format: 'iife',
  moduleName: 'quakemap',
  sourceMap: 'inline',
  globals: {
    angular: 'angular',
    redux: 'Redux',
    d3: 'd3',
    lodash: '_',
    jquery: 'jQuery',
    audio: 'audiojs',
    chrome: 'chrome',
    musicmetadata: 'musicmetadata',
    postal: 'postal',
    md5: 'md5'
  },
  plugins: [
    babel({
      exclude: 'node_modules/**'
    })
  ]
};
