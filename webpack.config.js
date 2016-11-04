module.exports = {
  entry: './app/quakemap.js',
  output: {
    path: __dirname,
    filename: 'quakemap.bundle.js'
  },
  external: {
    angular: 'angular',
    jquery: 'jQuery',
    lodash: '_',
    rx: 'Rx'
  },
  module: {
    loaders: [{
      test: /\.js$/,
      exclude: /node_modules/,
      loader: 'babel'
    }]
  }
};
