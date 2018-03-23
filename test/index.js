/* eslint-env mocha */
const {assert} = require('chai')
const fetch = require('node-fetch')
const AWS = require('aws-sdk')
const {pushStream} = require('./../src/index')
const elastic = require('../utils/esWrapper')
const {sampleData, modifyEvent} = require('./fixtures')
const {removeEventData} = require('./../utils/index')

const converter = AWS.DynamoDB.Converter.unmarshall
const INDEX = 'test'
const TYPE = 'test1'
const ES_ENDPOINT = 'localhost:9200'
const es = elastic(ES_ENDPOINT, true)

async function assertThrowsAsync (fn, regExp) {
  let f = () => {}
  try {
    await fn()
  } catch (e) {
    f = () => { throw e }
  } finally {
    assert.throws(f, regExp)
  }
}

function resolveAfter1Second () {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve()
    }, 1000)
  })
}

// 1. run a docker container
// docker run -i -p 9200:9200 --name my_elastic -p 9300:9300 -e "discovery.type=single-node" elasticsearch
describe('MODIFY event', () => {
  beforeEach(async () => {
    const promiseArray = sampleData.map(
      data => es.index({index: INDEX, type: TYPE, id: data.url, body: data, refresh: true}))
    await Promise.all(promiseArray).catch(e => { console.log(e) })
  })
  afterEach(async () => {
    const promiseArray = sampleData.map(
      data => es.remove({index: INDEX, type: TYPE, id: data.url, refresh: true}))
    await Promise.all(promiseArray)
  })

  it('should modify existing item', async () => {
    await pushStream({event: modifyEvent, index: INDEX, type: TYPE, endpoint: ES_ENDPOINT, testMode: true})
    await resolveAfter1Second() // give time for elasticsearch to refresh index
    const keys = converter(modifyEvent.Records[0].dynamodb.Keys)
    const result = await fetch(`http://${ES_ENDPOINT}/${INDEX}/${TYPE}/${keys.url}`)
    const body = await result.json()

    const data = removeEventData(converter(modifyEvent.Records[0].dynamodb.NewImage))
    assert.deepEqual(data, body._source)
  })
  it('wrong input index is not a string', async () => {
    const simpleData = {
      index: 12,
      type: 'test1',
      body: {test: 'test', myvalue: {1: 'test'}},
      id: '12',
      endpoint: ES_ENDPOINT,
      testMode: true
    }
    await assertThrowsAsync(async () => pushStream(simpleData), 'Please provide correct index')
  })
  it('wrong input type is not a string', async () => {
    const simpleData = {
      index: 'asd',
      type: '',
      body: {test: 'test', myvalue: {1: 'test'}},
      id: '12',
      endpoint: ES_ENDPOINT,
      testMode: true
    }
    await assertThrowsAsync(async () => pushStream(simpleData), 'Please provide correct type')
  })
  it('wrong input endpoint is not a string', async () => {
    const simpleData = {
      index: '12',
      type: 'test1',
      body: {test: 'test', myvalue: {1: 'test'}},
      id: '12',
      testMode: true
    }
    await assertThrowsAsync(async () => pushStream(simpleData), 'Please provide correct endpoint')
  })
})