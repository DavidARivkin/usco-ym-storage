import test from 'ava'
import 'babel-core/register'
import Rx from 'rx'
const {just, never} = Rx.Observable
import {contains} from 'ramda'

import makeYMDriver from './index'

test.cb('should handle data saving', t => {
  const saveData = {
    apiEndpoint: 'https://api.youmagine.com/v1',
    design: {id: 1, synched: true},
    authData: {token: '42'}, // bom & parts
    bom: [{id: 0, qty: 2, phys_qty: 1}], // assemblies data
    eMetas: {id: 1, typeUid: 0, name: 'one'},
    eTrans: {id: 1, typeUid: 0, pos: [0, 0, 1], rot: [1, 1, 1], sca: [1, 1, 1]},
    eMeshs: {id: 1, typeUid: 0}
  }
  const saveData$ = just(saveData) // .shareReplay(30)
    .delay(1) // Hacky way of making it work see http://stackoverflow.com/questions/25634375/rxjs-only-the-first-observer-can-see-data-from-observable-share
    .share()

  const saveQuery$ = saveData$
    .map(function (data) {
      return {method: 'save', data, type: 'design'}
    })

  const fakeHttpDriver = function (outRequests$) {
    outRequests$
      .scan(function (acc, data) {
        acc.push(data)
        return acc
      }, [])
      .filter(d => d.length >= 3)
      .forEach(data => {
        // TODO: flesh these out ?
        t.deepEqual(data[0].url, 'https://api.youmagine.com/v1/designs/1/parts/0/?auth_token=42')
        t.deepEqual(data[0].method, 'put')
        t.deepEqual(data[0].type, 'ymSave')
        t.deepEqual(data[0].typeDetail, 'parts')

        t.deepEqual(data[1].url, 'https://api.youmagine.com/v1/designs/1/bom/0/?auth_token=42')
        t.deepEqual(data[1].method, 'put')
        t.deepEqual(data[1].type, 'ymSave')
        t.deepEqual(data[1].typeDetail, 'bom')

        t.deepEqual(data[2].url, 'https://api.youmagine.com/v1/designs/1/assemblies/undefined/entries/undefined/?auth_token=42')
        t.deepEqual(data[2].method, 'put')
        t.deepEqual(data[2].type, 'ymSave')
        t.deepEqual(data[2].typeDetail, 'assemblies')
        t.end()
    })
    return never()
  }

  const outgoing$ = saveQuery$
  const ymDriver = makeYMDriver(fakeHttpDriver)
  ymDriver(outgoing$)
})

test.cb('should handle data loading', t => {
  const fakeHttpDriver = function (outRequests$) {
    const replyToAssemblies$ = outRequests$
      .filter(r => r.method === 'get' && r.typeDetail === 'assemblies')
      .map(function (data) {
        let response$$ = just({response: [{uuid: 'xx'}]}).delay(1).share()
        response$$.request = {
          method: 'get',
          type: 'ymLoad',
          typeDetail: 'assemblies'
        }
        return response$$
      })

    return replyToAssemblies$.merge(outRequests$)
  }

  const loadData = {design: {id: 0}, authData: 'F00', apiEndpoint: 'fake/url'}
  const loadDataQuery$ = just({method: 'load', data: loadData, type: 'design'})
    .delay(1)
    .share()

  const ymDriver = makeYMDriver(fakeHttpDriver)
  const driverOutputs$ = ymDriver(loadDataQuery$).data

  driverOutputs$
    .scan(function (acc, data) {
      acc.push(data.typeDetail)
      return acc
    }, [])
    .filter(data => data.length >= 3)
    .map(function (data) {
      // we recieved all 3 types of data, we are gold !
      return (contains('parts', data) && contains('bom', data) && contains('assemblyEntries', data))
    })
    .forEach(function (output) {
      t.is(output, true)
      t.end()
    })
})
