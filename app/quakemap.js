import angular from 'angular';

import dashboard from './dashboard/dashboard';
import shims from './shims/shims';

const quakemap = angular.module('quakemap', [
    shims,
    dashboard
  ])
  .name;

angular.bootstrap(document, [quakemap]);

export default quakemap;
