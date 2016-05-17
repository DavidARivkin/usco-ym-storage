'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.makeApiStreamGets = makeApiStreamGets;
exports.getBom = getBom;
exports.getParts = getParts;
exports.getAssemblies = getAssemblies;
exports.getAssemblyEntries = getAssemblyEntries;
exports.makeGetStreamForAssemblies = makeGetStreamForAssemblies;
exports.getAssemblyEntriesNoAssemblyFound = getAssemblyEntriesNoAssemblyFound;
exports.otherHelper = otherHelper;

var _rx = require('rx');

var _rx2 = _interopRequireDefault(_rx);

var _ramda = require('ramda');

var _obsUtils = require('usco-utils/obsUtils');

var _utils = require('usco-utils/utils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Observable = _rx2.default.Observable;
var just = Observable.just;
function makeApiStreamGets(source$, outputMapper, design$, authData$, apiEndpoint$) {
  var get$ = source$.withLatestFrom(design$, authData$, apiEndpoint$, function (sourceData, design, authData, apiEndpoint) {
    return { sourceData: sourceData, designId: design.id, authToken: authData.token, apiEndpoint: apiEndpoint };
  }).map(outputMapper).filter(_utils.exists);

  return get$;
}

// ///////All of these create requests from input data
function getBom(data) {
  var designId = data.designId;
  var authToken = data.authToken;
  var apiEndpoint = data.apiEndpoint;


  var authTokenStr = '/?auth_token=' + authToken;
  var designUri = apiEndpoint + '/designs/' + designId;
  var bomUri = designUri + '/bom' + authTokenStr;

  return {
    url: bomUri,
    method: 'get',
    type: 'ymLoad',
    typeDetail: 'bom',
    responseType: 'json'
  };
}

function getParts(data) {
  var designId = data.designId;
  var authToken = data.authToken;
  var apiEndpoint = data.apiEndpoint;


  var authTokenStr = '/?auth_token=' + authToken;
  var designUri = apiEndpoint + '/designs/' + designId;
  var partUri = designUri + '/parts' + authTokenStr;

  return {
    url: partUri,
    method: 'get',
    type: 'ymLoad',
    typeDetail: 'parts',
    responseType: 'json'
  };
}

function getAssemblies(data) {
  // FIXME: semi hack
  var designId = data.designId;
  var authToken = data.authToken;
  var apiEndpoint = data.apiEndpoint;


  var authTokenStr = '/?auth_token=' + authToken;
  var designUri = apiEndpoint + '/designs/' + designId;
  var assembliesUri = designUri + '/assemblies' + authTokenStr;

  /*let request = Rx.DOM.ajax({// FIXME: swap out for something else
    url: assembliesUri,
    crossDomain: true,
    async: true
  })
  return request*/

  return {
    url: assembliesUri,
    method: 'get',
    type: 'ymLoad',
    typeDetail: 'assemblies',
    responseType: 'json'
  };
}

function getAssemblyEntries(data) {
  var designId = data.designId;
  var authToken = data.authToken;
  var sourceData = data.sourceData;
  var apiEndpoint = data.apiEndpoint;

  //FIXME : UGH pre filter this

  if (sourceData && sourceData.uuid) {

    var authTokenStr = '/?auth_token=' + authToken;
    var designUri = apiEndpoint + '/designs/' + designId;
    var assembliesUri = designUri + '/assemblies/' + sourceData.uuid + '/entries' + authTokenStr;

    return {
      url: assembliesUri,
      method: 'get',
      type: 'ymLoad',
      typeDetail: 'assemblyEntries',
      responseType: 'json',
      assemblyId: sourceData.uuid // FIXME : temporary, used to know WHICH assembly the further data belongs to
    };
  } else {
      return undefined;
    }
}

function makeGetStreamForAssemblies(source$, outputMapper, design$, authData$, apiEndpoint$) {
  return source$.withLatestFrom(design$, authData$, apiEndpoint$, function (_, design, authData, apiEndpoint) {
    return { designId: design.id, authToken: authData.token, apiEndpoint: apiEndpoint };
  }).map(getAssemblies);
}

function getAssemblyEntriesNoAssemblyFound(getAssemblies$) {
  return getAssemblies$.filter(function (data) {
    return data === undefined;
  }).map(function (_) {
    var result = just({
      response: []
    });
    result.request = { type: 'ymLoad', typeDetail: 'assemblyEntries' };
    return result;
  });
}

function otherHelper(source$) {
  return source$.filter(function (d) {
    return d.request;
  }).filter(function (res$) {
    return res$.request.type === 'ymLoad' && res$.request.typeDetail === 'assemblies';
  }) // handle errors etc
  .flatMap(function (data) {
    var responseWrapper$ = data.catch(function (e) {
      return _rx2.default.Observable.empty();
    });
    var request$ = just(data.request);
    var response$ = responseWrapper$.pluck('response');
    return (0, _obsUtils.combineLatestObj)({ response$: response$, request$: request$ }); // .materialize()//FIXME: still do not get this one
  }).pluck('response').map(_ramda.head);
}

// TODO : experiment with reuseable boilerplate for responses
function reqWithCheck(source$, valid) {

  function valid(req) {
    req.type === 'ymLoad' && req.typeDetail === 'assemblies';
  }

  return source$.filter(function (d) {
    return d.request;
  }).filter(function (res$) {
    return valid(res$.request);
    //res$ => res$.request.type === 'ymLoad' && res$.request.typeDetail === 'assemblies'
  }) // handle errors etc
  .flatMap(function (data) {
    var responseWrapper$ = data.catch(function (e) {
      return _rx2.default.Observable.empty();
    });
    var request$ = just(data.request);
    var response$ = responseWrapper$.pluck('response');
    return (0, _obsUtils.combineLatestObj)({ response$: response$, request$: request$ }); // .materialize()//FIXME: still do not get this one
  });
}