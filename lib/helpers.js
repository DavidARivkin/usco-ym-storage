'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.makeApiStream = makeApiStream;
exports.spreadRequests = spreadRequests;

var _rx = require('rx');

var _rx2 = _interopRequireDefault(_rx);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Observable = _rx2.default.Observable;
var merge = Observable.merge;

// helper function that takes an input source Observable, a mapper function
// and additional observables to generate a stream of CRUD operations

function makeApiStream(source$, outputMapper, design$, authData$, apiEndpoint$) {
  var upsert$ = source$.map(function (d) {
    return d.upserted;
  }).withLatestFrom(design$, authData$, apiEndpoint$, function (_entries, design, authData, apiEndpoint) {
    return {
      _entries: _entries,
      designId: design.id,
      authToken: authData.token,
      apiEndpoint: apiEndpoint
    };
  }).map(outputMapper.bind(null, 'put'));

  var delete$ = source$.map(function (d) {
    return d.removed;
  }).withLatestFrom(design$, authData$, apiEndpoint$, function (_entries, design, authData, apiEndpoint) {
    return {
      _entries: _entries,
      designId: design.id,
      authToken: authData.token,
      apiEndpoint: apiEndpoint
    };
  }).map(outputMapper.bind(null, 'delete'));

  return merge(upsert$, delete$);
}

// spread out requests with TIME amount of time between each of them
function spreadRequests() {
  var time = arguments.length <= 0 || arguments[0] === undefined ? 300 : arguments[0];
  var data$ = arguments[1];

  /* return Rx.Observable.zip(
    out$,
    Rx.Observable.timer(0, 2000),
    function(item, i) { console.log("data",item); return item}
  ).tap(e=>console.log("api stream",e))*/
  return data$.flatMap(function (items) {
    return _rx2.default.Observable.from(items).zip(_rx2.default.Observable.interval(time), function (item, index) {
      return item;
    });
  }); // .tap(e=>console.log("api stream",e))
}