import angular from 'angular';

import mapComponent from './map.component';
import quakesService from './quakes.service';

const dashboard = angular.module('dashboard', [])
  .factory('quakesService', quakesService)
  .component('map', mapComponent)
  .name;

export default dashboard;
