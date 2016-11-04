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
  .name;

export default shims;