import angular from 'angular';

import MapUtils from './mapUtils';

const utils = angular.module('utils', [])
  .service('mapUtils', MapUtils)
  .name;

export default utils;
