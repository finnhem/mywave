const path = require('path');

/** @type {import('@rspack/cli').Configuration} */
module.exports = {
  entry: {
    main: './apps/waveform/static/waveform/js/index.ts',
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'apps/waveform/static/waveform/js/dist'),
    clean: true,
    publicPath: '/static/waveform/js/dist/',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'builtin:swc-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
              },
              target: 'es2020',
            },
          },
        },
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  optimization: {
    minimize: process.env.NODE_ENV === 'production',
  },
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  devtool: 'source-map',
  watch: true,
}; 