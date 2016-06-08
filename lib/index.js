'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = makeYMDriver;

var _rx = require('rx');

var _rx2 = _interopRequireDefault(_rx);

var _obsUtils = require('usco-utils/obsUtils');

var _utils = require('usco-utils/utils');

var _diffPatchUtils = require('usco-utils/diffPatchUtils');

var _ramda = require('ramda');

var _helpers = require('./helpers');

var _saveHelpers = require('./saveHelpers');

var _loadHelpers = require('./loadHelpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Observable = _rx2.default.Observable;
var merge = Observable.merge;
var just = Observable.just;


// actual driver stuff
// storage driver for YouMagine designs & data etc
function makeYMDriver(httpDriver) {
  var params = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];


  function youMagineStorageDriver(outgoing$) {
    // ////////////////////////
    // deal with designInfos
    var designInfos$ = outgoing$.filter(function (data) {
      return data.query === 'designExists';
    }).pluck('data').share();

    var apiEndpoint$ = outgoing$.pluck('data', 'apiEndpoint').filter(_utils.exists).shareReplay(1);

    var designExistsRequest$ = outgoing$.filter(function (data) {
      return data.query === 'designExists';
    }).distinctUntilChanged().pluck('data').map(function (_ref) {
      var design = _ref.design;
      var authData = _ref.authData;
      var apiEndpoint = _ref.apiEndpoint;
      return { designId: design.id, authToken: authData.token, apiEndpoint: apiEndpoint };
    }).map(function (data) {
      var designId = data.designId;
      var authToken = data.authToken;
      var apiEndpoint = data.apiEndpoint;

      var authTokenStr = authToken ? '/?auth_token=' + authToken : '';
      var designUri = apiEndpoint + '/designs/' + designId + authTokenStr;
      return {
        url: designUri,
        method: 'get',
        type: 'ymLoad',
        typeDetail: 'designExists'
      };
    });

    // all that is needed for save & load
    // deal with saving
    var save$ = outgoing$.debounce(50) // only save if last events were less than 50 ms appart
    .filter(function (data) {
      return data.method === 'save';
    }).pluck('data').share();

    var design$ = save$.pluck('design');
    var authData$ = save$.pluck('authData');

    // deal wiht loading basics
    var load$ = outgoing$.debounce(50) // only load if last events were less than 50 ms appart
    .filter(function (data) {
      return data.method === 'load';
    }).pluck('data').share();

    var lDesign$ = load$.pluck('design');

    var lAuthData$ = load$.pluck('authData');

    // saving stuff
    var dataDebounceRate = 1000; // debounce rate (in ms) for the input RAW data , affects the rate of request GENERATION, not of outbound requests
    var requestDebounceRate = 500; // time in ms between each emited http request : ie don't spam the api !

    var bom$ = (0, _diffPatchUtils.changesFromObservableArrays)(save$.pluck('bom').distinctUntilChanged(null, _ramda.equals).debounce(dataDebounceRate));

    var parts$ = (0, _diffPatchUtils.changesFromObservableArrays)(save$.pluck('bom').distinctUntilChanged(null, _ramda.equals).debounce(dataDebounceRate));

    var assemblies$ = (0, _diffPatchUtils.changesFromObservableArrays)((0, _obsUtils.combineLatestObj)({
      metadata: save$.pluck('eMetas'),
      transforms: save$.pluck('eTrans'),
      meshes: save$.pluck('eMeshs')
    }).debounce(dataDebounceRate).filter(_utils.exists).map(_saveHelpers.dataFromItems));

    //requests sent out to the server for CUD operations
    var partsOut$ = (0, _helpers.makeApiStream)(parts$, _saveHelpers.toParts, design$, authData$, apiEndpoint$);
    var bomOut$ = (0, _helpers.makeApiStream)(bom$, _saveHelpers.toBom, design$, authData$, apiEndpoint$);
    var assemblyOut$ = (0, _helpers.makeApiStream)(assemblies$, _saveHelpers.toAssemblies, design$, authData$, apiEndpoint$);

    //requests sent out to the server for Read operations
    var partsIn$ = (0, _loadHelpers.makeApiStreamGets)(load$, _loadHelpers.getParts, lDesign$, lAuthData$, apiEndpoint$);
    var bomIn$ = (0, _loadHelpers.makeApiStreamGets)(load$, _loadHelpers.getBom, lDesign$, lAuthData$, apiEndpoint$);
    var assembliesIn$ = (0, _loadHelpers.makeGetStreamForAssemblies)(load$, null, lDesign$, lAuthData$, apiEndpoint$);
    var assemblyEntriesIn$ = (0, _loadHelpers.makeApiStreamGets)((0, _loadHelpers.otherHelper)(httpDriver(assembliesIn$)), _loadHelpers.getAssemblyEntries, lDesign$, lAuthData$, apiEndpoint$);

    // Finally put it all together
    var allSaveRequests$ = (0, _helpers.spreadRequests)(requestDebounceRate, merge(partsOut$, bomOut$, assemblyOut$));
    var allLoadRequests$ = merge(partsIn$, bomIn$, assemblyEntriesIn$);

    //and send them on their way
    var outToHttp$ = merge(designExistsRequest$, allSaveRequests$, allLoadRequests$);

    var inputs$ = httpDriver(outToHttp$).merge((0, _loadHelpers.getAssemblyEntriesNoAssemblyFound)((0, _loadHelpers.otherHelper)(httpDriver(assembliesIn$))));

    // starts when outputing data, done when confirmation recieved
    function confirmSaveDone(what) {
      var confirmation$ = inputs$.filter(function (r) {
        return r.request;
      }).filter(function (res$) {
        return res$.request.type === 'ymSave';
      }) // handle errors etc
      .flatMap(function (data) {
        var responseWrapper$ = data.catch(function (e) {
          return _rx2.default.Observable.empty();
        });
        var request$ = just(data.request);
        var response$ = responseWrapper$.pluck('response');
        return (0, _obsUtils.combineLatestObj)({ response$: response$, request$: request$ }); // .materialize()//FIXME: still do not get this one
      }).map(function (data) {
        return data.request.typeDetail;
      }).filter(function (data) {
        return data === what;
      });
      return confirmation$;
    }

    function computeSaveProgress(outObs$, what) {
      return outObs$.map(function (_) {
        return true;
      }).merge(confirmSaveDone(what).map(function (_) {
        return false;
      }));
    }

    var saveInProgressParts$ = computeSaveProgress(partsOut$, 'parts');
    var saveInProgressBom$ = computeSaveProgress(bomOut$, 'bom');
    var saveInProgressAssembly$ = computeSaveProgress(assemblyOut$, 'assemblies');
    var saveInProgress$ = merge(saveInProgressParts$, saveInProgressBom$, saveInProgressAssembly$).map(function (data) {
      return { saveInProgress: data };
    });

    return {
      data: inputs$,
      progress: saveInProgress$
    };
  }

  return youMagineStorageDriver;
}