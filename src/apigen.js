require('isomorphic-fetch')
const camelCase = require('camel-case')
const helpers = require('./exported-helpers')
const processArgs = require('./process-args')

module.exports = apiGen

const configDefaults = {
  httpEndpoint: 'http://127.0.0.1:8888',
  debug: false
}

function apiGen (version, definitions, config) {
  config = Object.assign(configDefaults, config)
  const api = {}
  const {httpEndpoint} = config
  for (const apiGroup in definitions) {
    for (const apiMethod in definitions[apiGroup]) {
      const methodName = camelCase(apiMethod)
      const url = `${httpEndpoint}/${version}/${apiGroup}/${apiMethod}`
      api[methodName] = fetchMethod(methodName, url, definitions[apiGroup][apiMethod], config.debug)
    }
  }
  for(const helper in helpers.api) {
    // Insert `api` as the first parameter to all API helpers
    api[helper] = (...args) => helpers.api[helper](api, ...args)
  }
  return Object.assign(api, helpers)
}

function fetchMethod (methodName, url, definition, debug) {
  return function (...args) {
    if (args.length === 0) {
      console.error(usage(methodName, definition))
      return
    }

    const optionsFormatter = option => {
      if(typeof option === 'boolean') {
        return {broadcast: option}
      }
    }

    const {params, options, returnPromise, callback} =
      processArgs(args, Object.keys(definition.params || []), methodName, optionsFormatter)

    const body = JSON.stringify(params)
    fetch(url, {body, method: 'POST'}).then(response => {
      if (response.status >= 200 && response.status < 300) {
        return response.json()
      } else {
        return response.text().then(bodyResp => {
          const error = new Error(bodyResp)
          error.status = response.status
          error.statusText = response.statusText
          throw error
        })
      }
    }).then(objectResp => {
      if (debug) {
        console.error('api response =>', url, body, objectResp)
      }
      callback(null, objectResp)
    })
    .catch(error => {
      if (debug) {
        console.error('api error =>', url, body, error)
      }
      callback(error)
    })

    return returnPromise
  }
}

function usage (methodName, definition) {
  let usage = ''
  const out = str => {
    usage += str + '\n'
  }

  out(`USAGE`)
  out(`${methodName} - ${definition.brief}`)

  out('\nPARAMETERS')
  if (definition.params) {
    out(JSON.stringify(definition.params, null, 2))
  } else {
    out('none')
  }

  out('\nRETURNS')
  if (definition.results) {
    out(`${JSON.stringify(definition.results, null, 2)}`)
  } else {
    out(`no data`)
  }

  out('\nERRORS')
  if (definition.errors) {
    for (const error in definition.errors) {
      const errorDesc = definition.errors[error]
      out(`${error}${errorDesc ? ` - ${errorDesc}` : ''}`)
    }
  } else {
    out(`nothing special`)
  }

  return usage
}
