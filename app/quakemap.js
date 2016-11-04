import angular from 'angular';

import dashboard from './dashboard/dashboard';
import shims from './shims/shims';
import utils from './utils/utils';

const quakemap = angular.module('quakemap', [
    shims,
    utils,
    dashboard
  ])
  .name;

angular.bootstrap(document, [quakemap]);

export default quakemap;
