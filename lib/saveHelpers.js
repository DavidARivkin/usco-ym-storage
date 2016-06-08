'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.toParts = toParts;
exports.toBom = toBom;
exports.toAssemblies = toAssemblies;
exports.dataFromItems = dataFromItems;

var _ramda = require('ramda');

var _httpUtils = require('./utils/httpUtils');

var _modelUtils = require('usco-utils/modelUtils');

var _utils = require('usco-utils/utils');

var _assign = require('fast.js/object/assign');

var _assign2 = _interopRequireDefault(_assign);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// faster object.assign

// helper to generate output data to parts
function toParts() {
  var method = arguments.length <= 0 || arguments[0] === undefined ? 'put' : arguments[0];
  var data = arguments[1];
  var designId = data.designId;
  var authToken = data.authToken;
  var apiEndpoint = data.apiEndpoint;

  var entries = data._entries || [];

  var authTokenStr = authToken ? '/?auth_token=' + authToken : '';
  var designUri = apiEndpoint + '/designs/' + designId;
  var partUri = designUri + '/parts';

  var fieldNames = ['id', 'name', 'description', 'uuid'];
  var mapping = {
    'id': 'uuid',
    'params': 'part_parameters'
  };

  /* "binary_document_id": null,
  "binary_document_url": "",
  "source_document_id": null,
  "source_document_url": "",]*/
  var requests = entries.map(function (entry) {
    var refined = (0, _ramda.pick)(fieldNames, (0, _utils.remapJson)(mapping, entry));
    var send = (0, _httpUtils.jsonToFormData)(refined);

    return {
      url: partUri + '/' + refined.uuid + authTokenStr,
      method: method,
      send: send,
      type: 'ymSave',
      typeDetail: 'parts',
      mimeType: null, // 'application/json'
      responseType: 'json'
    };
  });
  return requests;
}

// helper to generate output data to bom
function toBom() {
  var method = arguments.length <= 0 || arguments[0] === undefined ? 'put' : arguments[0];
  var data = arguments[1];
  var designId = data.designId;
  var authToken = data.authToken;
  var apiEndpoint = data.apiEndpoint;

  var entries = data._entries || [];

  var authTokenStr = authToken ? '/?auth_token=' + authToken : '';
  var designUri = apiEndpoint + '/designs/' + designId;
  var bomUri = designUri + '/bom';

  var fieldNames = ['qty', 'phys_qty', 'unit', 'part_uuid', 'part_parameters', 'part_version', 'printable'];
  var mapping = {
    'id': 'part_uuid',
    'params': 'part_parameters',
    'version': 'part_version'
  };

  var requests = entries.map(function (entry) {
    var outEntry = (0, _modelUtils.mergeData)({}, entry);
    outEntry.qty = outEntry.qty - entry._qtyOffset; // adjust quantity, removing any dynamic counts
    var refined = (0, _ramda.pick)(fieldNames, (0, _utils.remapJson)(mapping, outEntry));
    var send = (0, _httpUtils.jsonToFormData)(refined);

    return {
      url: bomUri + '/' + refined.part_uuid + authTokenStr,
      method: method,
      send: send,
      type: 'ymSave',
      typeDetail: 'bom',
      mimeType: null, // 'application/json'
      responseType: 'json'
    };
  });
  return requests;
}

// helper to generate output data to assemblies
function toAssemblies() {
  var method = arguments.length <= 0 || arguments[0] === undefined ? 'put' : arguments[0];
  var data = arguments[1];
  var designId = data.designId;
  var authToken = data.authToken;
  var apiEndpoint = data.apiEndpoint;

  var entries = data._entries || [];

  var authTokenStr = authToken ? '/?auth_token=' + authToken : '';
  var designUri = apiEndpoint + '/designs/' + designId;

  var fieldNames = ['uuid', 'name', 'color', 'pos', 'rot', 'sca', 'part_uuid'];
  var mapping = { 'id': 'uuid', 'typeUid': 'part_uuid' };
  var requests = entries.map(function (entry) {
    var refined = (0, _ramda.pick)(fieldNames, (0, _utils.remapJson)(mapping, entry));
    var send = (0, _httpUtils.jsonToFormData)(refined);

    // console.log('assemblies entry', entry)
    var assemblyId = entry.assemblyId; // head(pluck('assemblyId', entries)) // head(entries).assemblyId
    var assembliesUri = designUri + '/assemblies/' + assemblyId + '/entries';

    return {
      url: assembliesUri + '/' + refined.uuid + authTokenStr,
      method: method,
      send: send,
      type: 'ymSave',
      typeDetail: 'assemblies'
    };
  });
  return requests;
}

function dataFromItems(items) {
  // console.log('items', items)
  return Object.keys(items.transforms).reduce(function (list, key) {
    var transforms = items['transforms'][key];
    var metadata = items['metadata'][key];

    if (transforms && metadata) {
      var entry = (0, _assign2.default)({}, transforms, metadata);
      list.push(entry);
    }
    return list;
  }, []);
}