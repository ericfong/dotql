module.exports = api => {
  api.cache(true)
  const isBrowser = process.env.BABEL_ENV === 'browser'
  return {
    presets: [
      [
        '@babel/preset-env',
        {
          targets: isBrowser ? { browsers: '>1%' } : { node: 8 },
          modules: isBrowser ? false : 'commonjs',
          useBuiltIns: 'usage',
          corejs: 3,
        },
      ],
    ],
    plugins: ['@babel/plugin-proposal-class-properties', '@babel/plugin-proposal-optional-chaining', 'lodash'],

    ignore: ['node_modules', 'build', 'babel.config.js'],
  }
}
