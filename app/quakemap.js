import angular from 'angular';

import dashboard from './dashboard/dashboard';

const quakemap = angular.module('quakemap', [
    dashboard
  ])
  .name;

export default quakemap;
