import angular from 'angular';

import mapComponent from './map.component';

const dashboard = angular.module('dashboard', [])
  .component('map', mapComponent)
  .name;

export default dashboard;
