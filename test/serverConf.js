import _ from 'lodash'

const serverTestConf = {
  schema: {
    Template: {
      id: {
        type: 'String',
        resolve: dot => `${dot.projectId}/${dot.name}`,
      },
      projectId: {
        type: 'String',
        resolve: dot => dot.projectId || dot.id.split('/')[0],
      },
      name: {
        type: 'String',
        resolve: dot => dot.name || dot.id.split('/')[1],
      },
      value: {
        type: 'Object',
        async resolve(_dot, args, ctx, info) {
          const dot = await info.resolveOthers({ projectId: 1, name: 1 })
          return dot.projectId === 'demo' && dot.name === 'new' ? { defaultTemplate: true } : JSON.parse(dot.json)
        },
      },
      $mutate: (dot, args) => Object.assign(dot, args),
    },
    Queries: {
      templateById: {
        type: ['Template'],
        resolve(dot, where) {
          if (_.isString(where)) return [{ id: where }]
          return null
        },
      },
    },
    Mutations: {
      setTemplateById: {
        type: 'Template',
        resolve(dot, args) {
          return args
        },
      },
    },
  },
}
export default serverTestConf