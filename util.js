// import assert from 'assert'
import _ from 'lodash'

export const enhance = (base = {}, enhancers) => {
  if (enhancers) {
    if (_.isArray(enhancers)) {
      return _.reduce(
        _.flattenDeep(enhancers),
        (_base, _enhancer) => {
          const enhanced = _enhancer(_base)
          // assert(enhanced && enhanced.query, `enhancer ${_enhancer} don't return .query function`)
          return enhanced
        },
        base
      )
    }
    return enhancers(base)
  }
  return base
}
