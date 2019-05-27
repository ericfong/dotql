import _ from 'lodash'

export default ({ preresolve } = {}) => {
  const templates = {}
  return {
    schema: {
      Template: {
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
        preresolve,
      },
      Queries: {
        templateById: {
          type: 'Template',
          resolve(dot, where) {
            if (_.isString(where)) return { ...templates[where], id: where }
            return null
          },
        },
        preresolve,
      },
      Mutations: {
        setTemplateById: {
          type: 'Template',
          resolve(dot, args) {
            return (templates[args.id] = Object.assign(templates[args.id] || {}, args))
          },
        },
        preresolve,
      },
    },
    prepared: {
      Queries: {
        templateById: { templateById: { $args: { $ref: 'where' } } },
      },
      Mutations: {
        setTemplateById: { setTemplateById: { $args: { $ref: 'args' } } },
      },
    },
  }
}
