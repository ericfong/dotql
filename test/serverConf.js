import _ from 'lodash'

const ensureFields = template => {
  if (template.id && !template.name) {
    const [projectId, name] = template.id.split('/')
    template.projectId = projectId
    template.name = name
  }
  return template
}

export default ({ preresolve } = {}) => {
  const templates = {}
  return {
    schema: {
      Template: {
        projectId: { type: 'String' },
        name: { type: 'String' },
        value: {
          type: 'Object',
          async resolve(_dot) {
            const dot = ensureFields(_dot)
            return dot.projectId === 'demo' && dot.name === 'new' ? { defaultTemplate: true } : JSON.parse(dot.json)
          },
        },
        preresolve,
      },
      Queries: {
        templateById: {
          type: 'Template',
          async resolve(dot, where) {
            if (_.isString(where)) {
              return ensureFields({ ...templates[where], id: where })
            }
            return null
          },
        },
        preresolve,
      },
      Mutations: {
        setTemplateById: {
          type: 'Template',
          async resolve(dot, args) {
            return (templates[args.id] = Object.assign(templates[args.id] || {}, args))
          },
        },
        preresolve,
      },
    },
    prepared: {
      Queries: {
        templateById: { templateById: { $args: { $ref: 'where' }, id: 1 } },
      },
      Mutations: {
        setTemplateById: { setTemplateById: { $args: { $ref: 'args' }, id: 1 } },
      },
    },
  }
}
