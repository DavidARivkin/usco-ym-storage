'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.jsonToFormData = jsonToFormData;
// detect node for conditional import for jsonToFormData
var isNode = typeof process !== 'undefined' && process.versions && !!process.versions.node;
if (isNode) {
  // TODO : deal with node.js side  for example using https://www.npmjs.com/package/form-data: fake one for now
}

function jsonToFormData(jsonData) {
  jsonData = JSON.parse(JSON.stringify(jsonData));
  var formData = void 0;
  if (isNode) {
    formData = { append: function append(fieldName, value) {} }; // FIXME: hack for tests/nodes.js
  } else {
      formData = new FormData();
    }
  for (var fieldName in jsonData) {
    var value = jsonData[fieldName];
    // value = encodeURIComponent(JSON.stringify(value))
    // value = JSON.stringify(value)
    // value = value.replace(/\"/g, '')
    if (Object.prototype.toString.call(value) === '[object Object]') {
      value = JSON.stringify(value);
      // console.log("value",value)
    }
    if (Object.prototype.toString.call(value) === '[object Array]') {
      // value = //JSON.stringify(value)
      // value = 'arr[]', arr[i]//value.reduce()
      // console.log("value",value)
      value = '{ ' + value.join(',') + ' }';
    }
    if (typeof value === 'boolean') {
      value = '\'' + value + '\'';
    }

    // console.log("append",fieldName, value)
    formData.append(fieldName, value);
  }
  return formData;
}