import angular from 'angular';

/**
* @ngdoc overview
* @name shims
* @description
* Description of the shims module.
*/
const shims = angular.module('shims', [])
  .value('leaflet', window.L)
  .value('lodash', window._)
  .value('Rx', window.Rx)
  .value('jquery', window.jQuery)
  .name;

export default shims;
