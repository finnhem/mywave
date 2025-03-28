const path = require('path');

module.exports = {
    entry: './apps/waveform/static/waveform/js/main.ts',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'apps/waveform/static/waveform/js/dist')
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js']
    },
    devtool: 'source-map'
}; 