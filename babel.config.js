module.exports = api => {
  api.cache(true)
  return {
    presets: [['@babel/preset-env', { targets: { browsers: '>2.5%' }, modules: false }]],
    plugins: ['lodash'],

    ignore: ['build', 'node_modules', 'index.js', 'babel.config.js', 'webpack.config.js'],
  }
}
