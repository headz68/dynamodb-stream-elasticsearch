const elasticsearch = require('elasticsearch')
const httpAwsEs = require('http-aws-es')

module.exports = (hosts, testMode) => {
  const esParams = {hosts}
  // Because we use ordinary elasticsearch container instead of AWS elasticsearch for integration tests
  if (!testMode) esParams.connectionClass = httpAwsEs

  const es = new elasticsearch.Client(esParams)
  return {
    index: ({index, type, id, body}) => new Promise((resolve, reject) => {
      es.index({index, type, id, body, refresh: true}, (error, response) => {
        if (error) reject(error)
        resolve(response)
      })
    }),
    remove: ({index, type, id}) => new Promise((resolve, reject) => {
      es.delete({index, type, id, refresh: true}, (error, response) => {
        if (error) reject(error)
        resolve(response)
      })
    })
  }
}