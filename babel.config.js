module.exports = api => {
  api.cache(true)
  return {
    presets: [
      [
        '@babel/preset-env',
        process.env.NODE_ENV === 'test' ? { targets: { node: 'current' } } : { targets: { browsers: '>2.5%' }, modules: false },
      ],
    ],
    plugins: [],

    ignore: ['build', 'node_modules', 'index.js', 'babel.config.js', 'webpack.config.js'],
  }
}
