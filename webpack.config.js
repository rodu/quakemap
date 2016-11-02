module.exports = {
  entry: './quakemap.js',
  output: {
    path: __dirname,
    filename: 'quakemap.bundle.js'
  },
  module: {
    loaders: [{
      test: /\.js$/,
      exclude: /node_modules/,
      loader: 'babel'
    }]
  }
};
