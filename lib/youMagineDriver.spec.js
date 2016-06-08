'use strict';

var _ava = require('ava');

var _ava2 = _interopRequireDefault(_ava);

require('babel-core/register');

var _rx = require('rx');

var _rx2 = _interopRequireDefault(_rx);

var _ramda = require('ramda');

var _index = require('./index');

var _index2 = _interopRequireDefault(_index);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _Rx$Observable = _rx2.default.Observable;
var just = _Rx$Observable.just;
var never = _Rx$Observable.never;


_ava2.default.cb('should handle data saving', function (t) {
  var saveData = {
    apiEndpoint: 'https://api.youmagine.com/v1',
    design: { id: 1, synched: true },
    authData: { token: '42' }, // bom & parts
    bom: [{ id: 0, qty: 2, phys_qty: 1 }], // assemblies data
    eMetas: { id: 1, typeUid: 0, name: 'one' },
    eTrans: { id: 1, typeUid: 0, pos: [0, 0, 1], rot: [1, 1, 1], sca: [1, 1, 1] },
    eMeshs: { id: 1, typeUid: 0 }
  };
  var saveData$ = just(saveData) // .shareReplay(30)
  .delay(1) // Hacky way of making it work see http://stackoverflow.com/questions/25634375/rxjs-only-the-first-observer-can-see-data-from-observable-share
  .share();

  var saveQuery$ = saveData$.map(function (data) {
    return { method: 'save', data: data, type: 'design' };
  });

  var fakeHttpDriver = function fakeHttpDriver(outRequests$) {
    outRequests$.scan(function (acc, data) {
      acc.push(data);
      return acc;
    }, []).filter(function (d) {
      return d.length >= 3;
    }).forEach(function (data) {
      // TODO: flesh these out ?
      t.deepEqual(data[0].url, 'https://api.youmagine.com/v1/designs/1/parts/0/?auth_token=42');
      t.deepEqual(data[0].method, 'put');
      t.deepEqual(data[0].type, 'ymSave');
      t.deepEqual(data[0].typeDetail, 'parts');

      t.deepEqual(data[1].url, 'https://api.youmagine.com/v1/designs/1/bom/0/?auth_token=42');
      t.deepEqual(data[1].method, 'put');
      t.deepEqual(data[1].type, 'ymSave');
      t.deepEqual(data[1].typeDetail, 'bom');

      t.deepEqual(data[2].url, 'https://api.youmagine.com/v1/designs/1/assemblies/undefined/entries/undefined/?auth_token=42');
      t.deepEqual(data[2].method, 'put');
      t.deepEqual(data[2].type, 'ymSave');
      t.deepEqual(data[2].typeDetail, 'assemblies');
      t.end();
    });
    return never();
  };

  var outgoing$ = saveQuery$;
  var ymDriver = (0, _index2.default)(fakeHttpDriver);
  ymDriver(outgoing$);
});

_ava2.default.cb('should handle data saving , without auth token aswell', function (t) {
  var saveData = {
    apiEndpoint: 'https://api.youmagine.com/v1',
    design: { id: 1, synched: true },
    authData: { token: undefined }, // bom & parts
    bom: [{ id: 0, qty: 2, phys_qty: 1 }], // assemblies data
    eMetas: { id: 1, typeUid: 0, name: 'one' },
    eTrans: { id: 1, typeUid: 0, pos: [0, 0, 1], rot: [1, 1, 1], sca: [1, 1, 1] },
    eMeshs: { id: 1, typeUid: 0 }
  };
  var saveData$ = just(saveData) // .shareReplay(30)
  .delay(1) // Hacky way of making it work see http://stackoverflow.com/questions/25634375/rxjs-only-the-first-observer-can-see-data-from-observable-share
  .share();

  var saveQuery$ = saveData$.map(function (data) {
    return { method: 'save', data: data, type: 'design' };
  });

  var fakeHttpDriver = function fakeHttpDriver(outRequests$) {
    outRequests$.scan(function (acc, data) {
      acc.push(data);
      return acc;
    }, []).filter(function (d) {
      return d.length >= 3;
    }).forEach(function (data) {
      // TODO: flesh these out ?
      t.deepEqual(data[0].url, 'https://api.youmagine.com/v1/designs/1/parts/0');
      t.deepEqual(data[0].method, 'put');
      t.deepEqual(data[0].type, 'ymSave');
      t.deepEqual(data[0].typeDetail, 'parts');

      t.deepEqual(data[1].url, 'https://api.youmagine.com/v1/designs/1/bom/0');
      t.deepEqual(data[1].method, 'put');
      t.deepEqual(data[1].type, 'ymSave');
      t.deepEqual(data[1].typeDetail, 'bom');

      t.deepEqual(data[2].url, 'https://api.youmagine.com/v1/designs/1/assemblies/undefined/entries/undefined');
      t.deepEqual(data[2].method, 'put');
      t.deepEqual(data[2].type, 'ymSave');
      t.deepEqual(data[2].typeDetail, 'assemblies');
      t.end();
    });
    return never();
  };

  var outgoing$ = saveQuery$;
  var ymDriver = (0, _index2.default)(fakeHttpDriver);
  ymDriver(outgoing$);
});

_ava2.default.cb('should handle data loading', function (t) {
  var fakeHttpDriver = function fakeHttpDriver(outRequests$) {
    var replyToAssemblies$ = outRequests$.filter(function (r) {
      return r.method === 'get' && r.typeDetail === 'assemblies';
    }).map(function (data) {
      var response$$ = just({ response: [{ uuid: 'xx' }] }).delay(1).share();
      response$$.request = {
        method: 'get',
        type: 'ymLoad',
        typeDetail: 'assemblies'
      };
      return response$$;
    });

    return replyToAssemblies$.merge(outRequests$);
  };

  var loadData = { design: { id: 0 }, authData: 'F00', apiEndpoint: 'fake/url' };
  var loadDataQuery$ = just({ method: 'load', data: loadData, type: 'design' }).delay(1).share();

  var ymDriver = (0, _index2.default)(fakeHttpDriver);
  var driverOutputs$ = ymDriver(loadDataQuery$).data;

  driverOutputs$.scan(function (acc, data) {
    acc.push(data.typeDetail);
    return acc;
  }, []).filter(function (data) {
    return data.length >= 3;
  }).map(function (data) {
    // we recieved all 3 types of data, we are gold !
    return (0, _ramda.contains)('parts', data) && (0, _ramda.contains)('bom', data) && (0, _ramda.contains)('assemblyEntries', data);
  }).forEach(function (output) {
    t.is(output, true);
    t.end();
  });
});

_ava2.default.cb('should handle data loading even without a token', function (t) {
  var fakeHttpDriver = function fakeHttpDriver(outRequests$) {
    var replyToAssemblies$ = outRequests$.filter(function (r) {
      return r.method === 'get' && r.typeDetail === 'assemblies';
    }).map(function (data) {
      var response$$ = just({ response: [{ uuid: 'xx' }] }).delay(1).share();
      response$$.request = {
        method: 'get',
        type: 'ymLoad',
        typeDetail: 'assemblies'
      };
      return response$$;
    });

    return replyToAssemblies$.merge(outRequests$);
  };

  var loadData = { design: { id: 0 }, authData: { token: undefined }, apiEndpoint: 'fake/url' };
  var loadDataQuery$ = just({ method: 'load', data: loadData, type: 'design' }).delay(1).share();

  var ymDriver = (0, _index2.default)(fakeHttpDriver);
  var driverOutputs$ = ymDriver(loadDataQuery$).data;

  driverOutputs$.scan(function (acc, data) {
    acc.push(data.typeDetail);
    return acc;
  }, []).filter(function (data) {
    return data.length >= 3;
  }).map(function (data) {
    // we recieved all 3 types of data, we are gold !
    return (0, _ramda.contains)('parts', data) && (0, _ramda.contains)('bom', data) && (0, _ramda.contains)('assemblyEntries', data);
  }).forEach(function (output) {
    t.is(output, true);
    t.end();
  });
});