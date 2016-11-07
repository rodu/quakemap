import angular from 'angular';

import mapComponent from './map.component';
import viewSelector from './view-selector.component';
import datatable from './datatable.component';
import metadataInfo from './metadata-info.component';
import quakesService from './quakes.service';

const dashboard = angular.module('dashboard', ['datatables'])
  .factory('quakesService', quakesService)
  .component('map', mapComponent)
  .component('viewSelector', viewSelector)
  .component('metadataInfo', metadataInfo)
  .directive('datatable', datatable)
  .name;

export default dashboard;
