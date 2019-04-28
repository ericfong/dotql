module.exports = api => {
  api.cache(true)
  return {
    presets: [
      [
        '@babel/preset-env',
        process.env.NODE_ENV === 'test' ? { targets: { node: 'current' } } : { targets: { browsers: '>1%' }, modules: false },
      ],
    ],
    plugins: [],

    ignore: ['build', 'node_modules', 'test', '**/*.test.js', 'index.js', 'babel.config.js', 'webpack.config.js'],
  }
}
