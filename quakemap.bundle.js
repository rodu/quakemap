var quakemap = (function (angular,rx) {
'use strict';

angular = 'default' in angular ? angular['default'] : angular;

var radioFilterSubject = new rx.BehaviorSubject();

/**
* @ngdoc directive
* @name dashboard.directive:map
* @description
* Description of the map directive.
*/

MapController.$inject = ['leaflet', 'quakesService'];
function MapController(L, quakesService) {
  var quakesStream = void 0;

  this.$onInit = function () {
    var map = L.map('map');
    var markers = {};
    var circles = {};

    var drawQuake = function drawQuake(quake) {
      var popupData = '' + '<h3>' + quake.place + '</h3>' + '<ul>' + '<li><strong>Time:</strong> ' + new Date(quake.time).toUTCString() + '</li>' + '<li><strong>Magnitude:</strong> ' + quake.mag + '</li>' + '</ul>';

      circles[quake.code] = L.circle([quake.lat, quake.lng], quake.mag * 1000).addTo(map);

      markers[quake.code] = L.marker([quake.lat, quake.lng]).addTo(map).bindPopup(popupData);
    };

    L.tileLayer('//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '\n        &copy; <a href="http://osm.org/copyright">OpenStreetMap</a>\n        contributors\n      '
    }).addTo(map);

    map.setView([0, 0], 7);

    quakesStream = quakesService.getQuakesStream().subscribe(drawQuake);

    radioFilterSubject.subscribe(function (quake) {
      if (quake) {
        map.setView([quake.lat, quake.lng], 7);
      }
    });
  };

  this.$onDestroy = function () {
    quakesStream.dispose();
  };
}

var mapComponent = {
  template: '<div id="map">map</div>',
  controller: MapController,
  controllerAs: 'map',
  bindings: {}
};

var strongestSoFar = function strongestSoFar() {
  var acc = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : { mag: 0 };
  var val = arguments[1];

  return val.mag > acc.mag ? val : acc;
};

var latestSoFar = function latestSoFar() {
  var acc = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
  var val = arguments[1];

  return val.time > acc.time ? val : acc;
};

/**
* @ngdoc directive
* @name dashboard.directive:viewSelector
* @description
* Description of the viewSelector directive.
*/
ViewSelectorController.$inject = ['quakesService', 'lodash', 'jquery'];
function ViewSelectorController(quakesService, _, $) {

  this.$onInit = function () {
    var quakesStream = quakesService.getQuakesStream();

    var $radios = $('[name="show-filter"]');
    var radioChanges = Rx.Observable.fromEvent($radios, 'change');

    var byValue = function byValue(event) {
      /* eslint no-invalid-this:0 */
      return this === event.target.value;
    };

    radioChanges.filter(byValue, 'mag').merge(quakesStream).scan(strongestSoFar).sample(250).subscribe(radioFilterSubject);

    radioChanges.filter(byValue, 'time').merge(quakesStream).scan(latestSoFar).sample(250)
    // skips the first value to let the mag observer value only to go through
    .skip(1).subscribe(radioFilterSubject);
  };

  this.$onDestroy = function () {};
}

var viewSelector = {
  template: '\n    <div class="show-filter">\n      <form>\n        <span class="filter-title"><strong>Show</strong></span>\n        <label class="radio-inline">\n          <input checked="true"\n            type="radio"\n            name="show-filter"\n            value="mag"> Strongest\n        </label>\n        <label class="radio-inline">\n          <input type="radio" name="show-filter" value="time"> Latest\n        </label>\n      </form>\n    </div>\n  ',
  controller: ViewSelectorController,
  controllerAs: 'viewSelector',
  bindings: {}
};

/**
* @ngdoc directive
* @name dashboard.directive:datatable
* @description
* Description of the datatable directive.
*/
datatable.$inject = ['$timeout', '$filter', 'quakesService'];
function datatable($timeout, $filter, quakesService) {

  var scope = {};

  function link($scope, $element) {
    var $table = $element.find('table');
    $scope.quakes = [];

    var quakesStream = quakesService.getQuakesStream();

    var dateFilter = $filter('date');
    var formatDate = function formatDate(quake) {
      return Object.assign({}, quake, {
        time: dateFilter(quake.time, 'MMM dd, yyyy - HH:mm UTCZ', String(quake.tz))
      });
    };

    quakesStream.bufferWithTime(500).filter(function (value) {
      return value.length;
    }).subscribe(function (quakes) {
      // Subsequent data stream will bring in only the new quakes we don't yet
      // have, therefore we concat the new data to the existing ones.
      $scope.quakes = $scope.quakes.concat(quakes.map(formatDate));
      $scope.$apply();

      /* eslint new-cap:0 */
      // Sorts the table by the magnitude column
      $table.DataTable().column('2:visible').order('desc').draw();
    });

    $scope.$on('$destroy', function () {
      quakesStream.dispose();
    });
  }

  return {
    restrict: 'E',
    template: '\n      <div>\n        <table datatable="ng" class="table table-striped table-hover">\n          <thead>\n            <tr>\n              <th>Location</th>\n              <th>Time</th>\n              <th>Magnitude</th>\n              <th></th>\n            </tr>\n          </thead>\n          <tbody>\n            <tr ng-repeat="quake in quakes">\n              <td>{{quake.place}}</td>\n              <td>{{quake.time}}</td>\n              <td>{{quake.mag}}</td>\n              <td><a href="{{quake.url}}" target="_blank">More details</a></td>\n            </tr>\n          </tbody>\n        </table>\n      </div>\n    ',
    scope: scope,
    link: link
  };
}

var FETCH_INTERVAL = 5000; //1800e+3; // every half hour

var QUAKE_URL =
//'//earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson'
'http://localhost:8080/all_day.geojsonp';

/**
* @ngdoc directive
* @name dashboard.directive:metadataInfo
* @description
* Description of the metadataInfo directive.
*/
MetadataInfoController.$inject = ['$timeout', '$interval', '$filter', 'quakesService'];
function MetadataInfoController($timeout, $interval, $filter, quakesService) {
  var _this = this;

  var onMetadataUpdate = void 0;

  this.$onInit = function () {
    var quakeStream = quakesService.getStreamMetadata();
    var dateFilter = $filter('date');
    var countdownPromise = void 0;

    onMetadataUpdate = quakeStream.subscribe(function (metadata) {
      // We must use a $timeout here to hook into the Angular digest cycle
      $timeout(function () {
        _this.lastUpdateTime = dateFilter(metadata.generated, 'MMM dd, yyyy - HH:mm UTCZ');
      });

      if (countdownPromise) {
        _this.updateCountdown = '00:00:00';
        $interval.cancel(countdownPromise);
      }

      countdownPromise = $interval(function (tickValue) {
        //this.updateCountdown = (FETCH_INTERVAL / 1000) - tickValue;
        _this.updateCountdown = dateFilter(FETCH_INTERVAL - tickValue * 1000, 'HH:mm:ss');
      }, 1000);
    });
  };

  this.$onDestroy = function () {
    onMetadataUpdate.dispose();
  };
}

var metadataInfo = {
  template: '\n    <span ng-show="metadataInfo.lastUpdateTime">\n      <strong>Last update: </strong>{{metadataInfo.lastUpdateTime}}\n       - <strong>Next update</strong>: {{metadataInfo.updateCountdown}}\n    </span>\n  ',
  controller: MetadataInfoController,
  controllerAs: 'metadataInfo',
  bindings: {}
};

quakesService.$inject = ['Rx'];
function quakesService(Rx) {

  var jsonStream = function jsonStream() {
    return Rx.DOM.jsonpRequest({
      url: QUAKE_URL,
      jsonpCallback: 'eqfeed_callback'
    });
  };

  var quakeStream = Rx.Observable.interval(FETCH_INTERVAL).startWith(1).flatMap(function () {
    return jsonStream();
  });

  function getStreamMetadata() {
    return quakeStream.flatMap(function (result) {
      return Rx.Observable.return(result.response.metadata);
      //return Rx.Observable.return({ generated: Date.now() });
    });
  }

  function getQuakesStream() {
    return quakeStream.flatMap(function (result) {
      return Rx.Observable.from(result.response.features);
    }).distinct(function (feature) {
      return feature.properties.code;
    }).map(function (feature) {
      return {
        lat: feature.geometry.coordinates[1],
        lng: feature.geometry.coordinates[0],
        mag: feature.properties.mag,
        code: feature.properties.code,
        place: feature.properties.place,
        url: feature.properties.url,
        time: feature.properties.time,
        tz: feature.properties.tz
      };
    }).filter(function (quake) {
      return quake.mag >= 1;
    });
  }

  return {
    getQuakesStream: getQuakesStream,
    getStreamMetadata: getStreamMetadata
  };
}

var dashboard = angular.module('dashboard', ['datatables']).factory('quakesService', quakesService).component('map', mapComponent).component('viewSelector', viewSelector).component('metadataInfo', metadataInfo).directive('datatable', datatable).name;

/**
* @ngdoc overview
* @name shims
* @description
* Description of the shims module.
*/
var shims = angular.module('shims', []).value('leaflet', window.L).value('lodash', window._).value('Rx', window.Rx).value('jquery', window.jQuery).name;

var utils = angular.module('utils', []).name;

var quakemap = angular.module('quakemap', [shims, utils, dashboard]).name;

angular.bootstrap(document, [quakemap]);

return quakemap;

}(angular,Rx));

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjpudWxsLCJzb3VyY2VzIjpbImFwcC9kYXNoYm9hcmQvcmFkaW9GaWx0ZXJTdWJqZWN0LmpzIiwiYXBwL2Rhc2hib2FyZC9tYXAuY29tcG9uZW50LmpzIiwiYXBwL3V0aWxzL3F1YWtlc0RhdGFVdGlscy5qcyIsImFwcC9kYXNoYm9hcmQvdmlldy1zZWxlY3Rvci5jb21wb25lbnQuanMiLCJhcHAvZGFzaGJvYXJkL2RhdGF0YWJsZS5jb21wb25lbnQuanMiLCJhcHAvc2V0dGluZ3MuanMiLCJhcHAvZGFzaGJvYXJkL21ldGFkYXRhLWluZm8uY29tcG9uZW50LmpzIiwiYXBwL2Rhc2hib2FyZC9xdWFrZXMuc2VydmljZS5qcyIsImFwcC9kYXNoYm9hcmQvZGFzaGJvYXJkLmpzIiwiYXBwL3NoaW1zL3NoaW1zLmpzIiwiYXBwL3V0aWxzL3V0aWxzLmpzIiwiYXBwL3F1YWtlbWFwLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJlaGF2aW9yU3ViamVjdCB9IGZyb20gJ3J4JztcblxuZXhwb3J0IGRlZmF1bHQgbmV3IEJlaGF2aW9yU3ViamVjdCgpO1xuIiwiaW1wb3J0IHJhZGlvRmlsdGVyU3ViamVjdCBmcm9tICcuL3JhZGlvRmlsdGVyU3ViamVjdCc7XG5cbi8qKlxuKiBAbmdkb2MgZGlyZWN0aXZlXG4qIEBuYW1lIGRhc2hib2FyZC5kaXJlY3RpdmU6bWFwXG4qIEBkZXNjcmlwdGlvblxuKiBEZXNjcmlwdGlvbiBvZiB0aGUgbWFwIGRpcmVjdGl2ZS5cbiovXG5cbk1hcENvbnRyb2xsZXIuJGluamVjdCA9IFsnbGVhZmxldCcsICdxdWFrZXNTZXJ2aWNlJ107XG5mdW5jdGlvbiBNYXBDb250cm9sbGVyKEwsIHF1YWtlc1NlcnZpY2Upe1xuICBsZXQgcXVha2VzU3RyZWFtO1xuXG4gIHRoaXMuJG9uSW5pdCA9ICgpID0+IHtcbiAgICBsZXQgbWFwID0gTC5tYXAoJ21hcCcpO1xuICAgIGxldCBtYXJrZXJzID0ge307XG4gICAgbGV0IGNpcmNsZXMgPSB7fTtcblxuICAgIGNvbnN0IGRyYXdRdWFrZSA9IChxdWFrZSkgPT4ge1xuICAgICAgY29uc3QgcG9wdXBEYXRhID0gJycgK1xuICAgICAgICAnPGgzPicgKyBxdWFrZS5wbGFjZSArICc8L2gzPicgK1xuICAgICAgICAnPHVsPicgK1xuICAgICAgICAgICc8bGk+PHN0cm9uZz5UaW1lOjwvc3Ryb25nPiAnICtcbiAgICAgICAgICAgIG5ldyBEYXRlKHF1YWtlLnRpbWUpLnRvVVRDU3RyaW5nKCkgK1xuICAgICAgICAgICc8L2xpPicgK1xuICAgICAgICAgICc8bGk+PHN0cm9uZz5NYWduaXR1ZGU6PC9zdHJvbmc+ICcgKyBxdWFrZS5tYWcgKyAnPC9saT4nICtcbiAgICAgICAgJzwvdWw+JztcblxuICAgICAgY2lyY2xlc1txdWFrZS5jb2RlXSA9IEwuY2lyY2xlKFxuICAgICAgICBbcXVha2UubGF0LCBxdWFrZS5sbmddLFxuICAgICAgICBxdWFrZS5tYWcgKiAxMDAwXG4gICAgICApLmFkZFRvKG1hcCk7XG5cbiAgICAgIG1hcmtlcnNbcXVha2UuY29kZV0gPSBMLm1hcmtlcihbcXVha2UubGF0LCBxdWFrZS5sbmddKVxuICAgICAgICAuYWRkVG8obWFwKVxuICAgICAgICAuYmluZFBvcHVwKHBvcHVwRGF0YSk7XG4gICAgfTtcblxuXG4gICAgTC50aWxlTGF5ZXIoJy8ve3N9LnRpbGUub3BlbnN0cmVldG1hcC5vcmcve3p9L3t4fS97eX0ucG5nJywge1xuICAgICAgYXR0cmlidXRpb246IGBcbiAgICAgICAgJmNvcHk7IDxhIGhyZWY9XCJodHRwOi8vb3NtLm9yZy9jb3B5cmlnaHRcIj5PcGVuU3RyZWV0TWFwPC9hPlxuICAgICAgICBjb250cmlidXRvcnNcbiAgICAgIGBcbiAgICB9KS5hZGRUbyhtYXApO1xuXG4gICAgbWFwLnNldFZpZXcoWzAsIDBdLCA3KTtcblxuICAgIHF1YWtlc1N0cmVhbSA9IHF1YWtlc1NlcnZpY2VcbiAgICAgIC5nZXRRdWFrZXNTdHJlYW0oKVxuICAgICAgLnN1YnNjcmliZShkcmF3UXVha2UpO1xuXG4gICAgcmFkaW9GaWx0ZXJTdWJqZWN0LnN1YnNjcmliZSgocXVha2UpID0+IHtcbiAgICAgIGlmIChxdWFrZSl7XG4gICAgICAgIG1hcC5zZXRWaWV3KFtxdWFrZS5sYXQsIHF1YWtlLmxuZ10sIDcpO1xuICAgICAgfVxuICAgIH0pO1xuICB9O1xuXG4gIHRoaXMuJG9uRGVzdHJveSA9ICgpID0+IHtcbiAgICBxdWFrZXNTdHJlYW0uZGlzcG9zZSgpO1xuICB9O1xufVxuXG5jb25zdCBtYXBDb21wb25lbnQgPSB7XG4gIHRlbXBsYXRlOiAnPGRpdiBpZD1cIm1hcFwiPm1hcDwvZGl2PicsXG4gIGNvbnRyb2xsZXI6IE1hcENvbnRyb2xsZXIsXG4gIGNvbnRyb2xsZXJBczogJ21hcCcsXG4gIGJpbmRpbmdzOiB7fVxufTtcblxuZXhwb3J0IGRlZmF1bHQgbWFwQ29tcG9uZW50O1xuXG5cbiIsImV4cG9ydCBjb25zdCBzdHJvbmdlc3RTb0ZhciA9IChhY2MgPSB7IG1hZzogMCB9LCB2YWwpID0+IHtcbiAgcmV0dXJuIHZhbC5tYWcgPiBhY2MubWFnID8gdmFsIDogYWNjO1xufTtcblxuZXhwb3J0IGNvbnN0IGxhdGVzdFNvRmFyID0gKGFjYyA9IDAsIHZhbCkgPT4ge1xuICByZXR1cm4gdmFsLnRpbWUgPiBhY2MudGltZSA/IHZhbCA6IGFjYztcbn07XG4iLCJpbXBvcnQgeyBzdHJvbmdlc3RTb0ZhciwgbGF0ZXN0U29GYXIgfSBmcm9tICcuLi91dGlscy9xdWFrZXNEYXRhVXRpbHMnO1xuaW1wb3J0IHJhZGlvRmlsdGVyU3ViamVjdCBmcm9tICcuL3JhZGlvRmlsdGVyU3ViamVjdCc7XG5cbi8qKlxuKiBAbmdkb2MgZGlyZWN0aXZlXG4qIEBuYW1lIGRhc2hib2FyZC5kaXJlY3RpdmU6dmlld1NlbGVjdG9yXG4qIEBkZXNjcmlwdGlvblxuKiBEZXNjcmlwdGlvbiBvZiB0aGUgdmlld1NlbGVjdG9yIGRpcmVjdGl2ZS5cbiovXG5WaWV3U2VsZWN0b3JDb250cm9sbGVyLiRpbmplY3QgPSBbXG4gICdxdWFrZXNTZXJ2aWNlJyxcbiAgJ2xvZGFzaCcsXG4gICdqcXVlcnknXG5dO1xuZnVuY3Rpb24gVmlld1NlbGVjdG9yQ29udHJvbGxlcihxdWFrZXNTZXJ2aWNlLCBfLCAkKXtcblxuICB0aGlzLiRvbkluaXQgPSAoKSA9PiB7XG4gICAgY29uc3QgcXVha2VzU3RyZWFtID0gcXVha2VzU2VydmljZS5nZXRRdWFrZXNTdHJlYW0oKTtcblxuICAgIGNvbnN0ICRyYWRpb3MgPSAkKCdbbmFtZT1cInNob3ctZmlsdGVyXCJdJyk7XG4gICAgY29uc3QgcmFkaW9DaGFuZ2VzID0gUnguT2JzZXJ2YWJsZS5mcm9tRXZlbnQoJHJhZGlvcywgJ2NoYW5nZScpO1xuXG4gICAgY29uc3QgYnlWYWx1ZSA9IGZ1bmN0aW9uKGV2ZW50KXtcbiAgICAgIC8qIGVzbGludCBuby1pbnZhbGlkLXRoaXM6MCAqL1xuICAgICAgcmV0dXJuIHRoaXMgPT09IGV2ZW50LnRhcmdldC52YWx1ZTtcbiAgICB9O1xuXG4gICAgcmFkaW9DaGFuZ2VzXG4gICAgICAuZmlsdGVyKGJ5VmFsdWUsICdtYWcnKVxuICAgICAgLm1lcmdlKHF1YWtlc1N0cmVhbSlcbiAgICAgIC5zY2FuKHN0cm9uZ2VzdFNvRmFyKVxuICAgICAgLnNhbXBsZSgyNTApXG4gICAgICAuc3Vic2NyaWJlKHJhZGlvRmlsdGVyU3ViamVjdCk7XG5cbiAgICByYWRpb0NoYW5nZXNcbiAgICAgIC5maWx0ZXIoYnlWYWx1ZSwgJ3RpbWUnKVxuICAgICAgLm1lcmdlKHF1YWtlc1N0cmVhbSlcbiAgICAgIC5zY2FuKGxhdGVzdFNvRmFyKVxuICAgICAgLnNhbXBsZSgyNTApXG4gICAgICAvLyBza2lwcyB0aGUgZmlyc3QgdmFsdWUgdG8gbGV0IHRoZSBtYWcgb2JzZXJ2ZXIgdmFsdWUgb25seSB0byBnbyB0aHJvdWdoXG4gICAgICAuc2tpcCgxKVxuICAgICAgLnN1YnNjcmliZShyYWRpb0ZpbHRlclN1YmplY3QpO1xuICB9O1xuXG4gIHRoaXMuJG9uRGVzdHJveSA9ICgpID0+IHt9O1xufVxuXG5jb25zdCB2aWV3U2VsZWN0b3IgPSB7XG4gIHRlbXBsYXRlOiBgXG4gICAgPGRpdiBjbGFzcz1cInNob3ctZmlsdGVyXCI+XG4gICAgICA8Zm9ybT5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJmaWx0ZXItdGl0bGVcIj48c3Ryb25nPlNob3c8L3N0cm9uZz48L3NwYW4+XG4gICAgICAgIDxsYWJlbCBjbGFzcz1cInJhZGlvLWlubGluZVwiPlxuICAgICAgICAgIDxpbnB1dCBjaGVja2VkPVwidHJ1ZVwiXG4gICAgICAgICAgICB0eXBlPVwicmFkaW9cIlxuICAgICAgICAgICAgbmFtZT1cInNob3ctZmlsdGVyXCJcbiAgICAgICAgICAgIHZhbHVlPVwibWFnXCI+IFN0cm9uZ2VzdFxuICAgICAgICA8L2xhYmVsPlxuICAgICAgICA8bGFiZWwgY2xhc3M9XCJyYWRpby1pbmxpbmVcIj5cbiAgICAgICAgICA8aW5wdXQgdHlwZT1cInJhZGlvXCIgbmFtZT1cInNob3ctZmlsdGVyXCIgdmFsdWU9XCJ0aW1lXCI+IExhdGVzdFxuICAgICAgICA8L2xhYmVsPlxuICAgICAgPC9mb3JtPlxuICAgIDwvZGl2PlxuICBgLFxuICBjb250cm9sbGVyOiBWaWV3U2VsZWN0b3JDb250cm9sbGVyLFxuICBjb250cm9sbGVyQXM6ICd2aWV3U2VsZWN0b3InLFxuICBiaW5kaW5nczoge31cbn07XG5cbmV4cG9ydCBkZWZhdWx0IHZpZXdTZWxlY3RvcjtcbiIsIi8qKlxuKiBAbmdkb2MgZGlyZWN0aXZlXG4qIEBuYW1lIGRhc2hib2FyZC5kaXJlY3RpdmU6ZGF0YXRhYmxlXG4qIEBkZXNjcmlwdGlvblxuKiBEZXNjcmlwdGlvbiBvZiB0aGUgZGF0YXRhYmxlIGRpcmVjdGl2ZS5cbiovXG5kYXRhdGFibGUuJGluamVjdCA9IFsnJHRpbWVvdXQnLCAnJGZpbHRlcicsICdxdWFrZXNTZXJ2aWNlJ107XG5mdW5jdGlvbiBkYXRhdGFibGUoJHRpbWVvdXQsICRmaWx0ZXIsIHF1YWtlc1NlcnZpY2Upe1xuXG4gIGNvbnN0IHNjb3BlID0ge307XG5cbiAgZnVuY3Rpb24gbGluaygkc2NvcGUsICRlbGVtZW50KXtcbiAgICBjb25zdCAkdGFibGUgPSAkZWxlbWVudC5maW5kKCd0YWJsZScpO1xuICAgICRzY29wZS5xdWFrZXMgPSBbXTtcblxuICAgIGNvbnN0IHF1YWtlc1N0cmVhbSA9IHF1YWtlc1NlcnZpY2UuZ2V0UXVha2VzU3RyZWFtKCk7XG5cbiAgICBjb25zdCBkYXRlRmlsdGVyID0gJGZpbHRlcignZGF0ZScpO1xuICAgIGNvbnN0IGZvcm1hdERhdGUgPSAocXVha2UpID0+IHtcbiAgICAgIHJldHVybiBPYmplY3QuYXNzaWduKHt9LCBxdWFrZSwge1xuICAgICAgICB0aW1lOiBkYXRlRmlsdGVyKFxuICAgICAgICAgIHF1YWtlLnRpbWUsXG4gICAgICAgICAgJ01NTSBkZCwgeXl5eSAtIEhIOm1tIFVUQ1onLFxuICAgICAgICAgIFN0cmluZyhxdWFrZS50eilcbiAgICAgICAgKVxuICAgICAgfSk7XG4gICAgfTtcblxuICAgIHF1YWtlc1N0cmVhbVxuICAgICAgLmJ1ZmZlcldpdGhUaW1lKDUwMClcbiAgICAgIC5maWx0ZXIoKHZhbHVlKSA9PiB2YWx1ZS5sZW5ndGgpXG4gICAgICAuc3Vic2NyaWJlKChxdWFrZXMpID0+IHtcbiAgICAgICAgLy8gU3Vic2VxdWVudCBkYXRhIHN0cmVhbSB3aWxsIGJyaW5nIGluIG9ubHkgdGhlIG5ldyBxdWFrZXMgd2UgZG9uJ3QgeWV0XG4gICAgICAgIC8vIGhhdmUsIHRoZXJlZm9yZSB3ZSBjb25jYXQgdGhlIG5ldyBkYXRhIHRvIHRoZSBleGlzdGluZyBvbmVzLlxuICAgICAgICAkc2NvcGUucXVha2VzID0gJHNjb3BlLnF1YWtlcy5jb25jYXQocXVha2VzLm1hcChmb3JtYXREYXRlKSk7XG4gICAgICAgICRzY29wZS4kYXBwbHkoKTtcblxuICAgICAgICAvKiBlc2xpbnQgbmV3LWNhcDowICovXG4gICAgICAgIC8vIFNvcnRzIHRoZSB0YWJsZSBieSB0aGUgbWFnbml0dWRlIGNvbHVtblxuICAgICAgICAkdGFibGUuRGF0YVRhYmxlKClcbiAgICAgICAgICAuY29sdW1uKCcyOnZpc2libGUnKVxuICAgICAgICAgIC5vcmRlcignZGVzYycpXG4gICAgICAgICAgLmRyYXcoKTtcbiAgICAgIH0pO1xuXG4gICAgJHNjb3BlLiRvbignJGRlc3Ryb3knLCAoKSA9PiB7XG4gICAgICBxdWFrZXNTdHJlYW0uZGlzcG9zZSgpO1xuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICByZXN0cmljdDogJ0UnLFxuICAgIHRlbXBsYXRlOiBgXG4gICAgICA8ZGl2PlxuICAgICAgICA8dGFibGUgZGF0YXRhYmxlPVwibmdcIiBjbGFzcz1cInRhYmxlIHRhYmxlLXN0cmlwZWQgdGFibGUtaG92ZXJcIj5cbiAgICAgICAgICA8dGhlYWQ+XG4gICAgICAgICAgICA8dHI+XG4gICAgICAgICAgICAgIDx0aD5Mb2NhdGlvbjwvdGg+XG4gICAgICAgICAgICAgIDx0aD5UaW1lPC90aD5cbiAgICAgICAgICAgICAgPHRoPk1hZ25pdHVkZTwvdGg+XG4gICAgICAgICAgICAgIDx0aD48L3RoPlxuICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICA8L3RoZWFkPlxuICAgICAgICAgIDx0Ym9keT5cbiAgICAgICAgICAgIDx0ciBuZy1yZXBlYXQ9XCJxdWFrZSBpbiBxdWFrZXNcIj5cbiAgICAgICAgICAgICAgPHRkPnt7cXVha2UucGxhY2V9fTwvdGQ+XG4gICAgICAgICAgICAgIDx0ZD57e3F1YWtlLnRpbWV9fTwvdGQ+XG4gICAgICAgICAgICAgIDx0ZD57e3F1YWtlLm1hZ319PC90ZD5cbiAgICAgICAgICAgICAgPHRkPjxhIGhyZWY9XCJ7e3F1YWtlLnVybH19XCIgdGFyZ2V0PVwiX2JsYW5rXCI+TW9yZSBkZXRhaWxzPC9hPjwvdGQ+XG4gICAgICAgICAgICA8L3RyPlxuICAgICAgICAgIDwvdGJvZHk+XG4gICAgICAgIDwvdGFibGU+XG4gICAgICA8L2Rpdj5cbiAgICBgLFxuICAgIHNjb3BlOiBzY29wZSxcbiAgICBsaW5rOiBsaW5rXG4gIH07XG59XG5cbmV4cG9ydCBkZWZhdWx0IGRhdGF0YWJsZTtcbiIsImV4cG9ydCBjb25zdCBGRVRDSF9JTlRFUlZBTCA9IDUwMDA7IC8vMTgwMGUrMzsgLy8gZXZlcnkgaGFsZiBob3VyXG5cbmV4cG9ydCBjb25zdCBRVUFLRV9VUkwgPSAoXG4gIC8vJy8vZWFydGhxdWFrZS51c2dzLmdvdi9lYXJ0aHF1YWtlcy9mZWVkL3YxLjAvc3VtbWFyeS9hbGxfZGF5Lmdlb2pzb24nXG4gICdodHRwOi8vbG9jYWxob3N0OjgwODAvYWxsX2RheS5nZW9qc29ucCdcbik7XG4iLCJpbXBvcnQgeyBGRVRDSF9JTlRFUlZBTCB9IGZyb20gJy4uL3NldHRpbmdzJztcblxuLyoqXG4qIEBuZ2RvYyBkaXJlY3RpdmVcbiogQG5hbWUgZGFzaGJvYXJkLmRpcmVjdGl2ZTptZXRhZGF0YUluZm9cbiogQGRlc2NyaXB0aW9uXG4qIERlc2NyaXB0aW9uIG9mIHRoZSBtZXRhZGF0YUluZm8gZGlyZWN0aXZlLlxuKi9cbk1ldGFkYXRhSW5mb0NvbnRyb2xsZXIuJGluamVjdCA9IFtcbiAgJyR0aW1lb3V0JyxcbiAgJyRpbnRlcnZhbCcsXG4gICckZmlsdGVyJyxcbiAgJ3F1YWtlc1NlcnZpY2UnXG5dO1xuZnVuY3Rpb24gTWV0YWRhdGFJbmZvQ29udHJvbGxlcigkdGltZW91dCwgJGludGVydmFsLCAkZmlsdGVyLCBxdWFrZXNTZXJ2aWNlKXtcbiAgbGV0IG9uTWV0YWRhdGFVcGRhdGU7XG5cbiAgdGhpcy4kb25Jbml0ID0gKCkgPT4ge1xuICAgIGNvbnN0IHF1YWtlU3RyZWFtID0gcXVha2VzU2VydmljZS5nZXRTdHJlYW1NZXRhZGF0YSgpO1xuICAgIGNvbnN0IGRhdGVGaWx0ZXIgPSAkZmlsdGVyKCdkYXRlJyk7XG4gICAgbGV0IGNvdW50ZG93blByb21pc2U7XG5cbiAgICBvbk1ldGFkYXRhVXBkYXRlID0gcXVha2VTdHJlYW0uc3Vic2NyaWJlKChtZXRhZGF0YSkgPT4ge1xuICAgICAgLy8gV2UgbXVzdCB1c2UgYSAkdGltZW91dCBoZXJlIHRvIGhvb2sgaW50byB0aGUgQW5ndWxhciBkaWdlc3QgY3ljbGVcbiAgICAgICR0aW1lb3V0KCgpID0+IHtcbiAgICAgICAgdGhpcy5sYXN0VXBkYXRlVGltZSA9IGRhdGVGaWx0ZXIoXG4gICAgICAgICAgbWV0YWRhdGEuZ2VuZXJhdGVkLFxuICAgICAgICAgICdNTU0gZGQsIHl5eXkgLSBISDptbSBVVENaJ1xuICAgICAgICApO1xuICAgICAgfSk7XG5cbiAgICAgIGlmIChjb3VudGRvd25Qcm9taXNlKXtcbiAgICAgICAgdGhpcy51cGRhdGVDb3VudGRvd24gPSAnMDA6MDA6MDAnO1xuICAgICAgICAkaW50ZXJ2YWwuY2FuY2VsKGNvdW50ZG93blByb21pc2UpO1xuICAgICAgfVxuXG4gICAgICBjb3VudGRvd25Qcm9taXNlID0gJGludGVydmFsKCh0aWNrVmFsdWUpID0+IHtcbiAgICAgICAgLy90aGlzLnVwZGF0ZUNvdW50ZG93biA9IChGRVRDSF9JTlRFUlZBTCAvIDEwMDApIC0gdGlja1ZhbHVlO1xuICAgICAgICB0aGlzLnVwZGF0ZUNvdW50ZG93biA9IGRhdGVGaWx0ZXIoXG4gICAgICAgICAgRkVUQ0hfSU5URVJWQUwgLSB0aWNrVmFsdWUgKiAxMDAwLFxuICAgICAgICAgICdISDptbTpzcydcbiAgICAgICAgKTtcbiAgICAgIH0sIDEwMDApO1xuXG4gICAgfSk7XG4gIH07XG5cbiAgdGhpcy4kb25EZXN0cm95ID0gKCkgPT4ge1xuICAgIG9uTWV0YWRhdGFVcGRhdGUuZGlzcG9zZSgpO1xuICB9O1xufVxuXG5jb25zdCBtZXRhZGF0YUluZm8gPSB7XG4gIHRlbXBsYXRlOiBgXG4gICAgPHNwYW4gbmctc2hvdz1cIm1ldGFkYXRhSW5mby5sYXN0VXBkYXRlVGltZVwiPlxuICAgICAgPHN0cm9uZz5MYXN0IHVwZGF0ZTogPC9zdHJvbmc+e3ttZXRhZGF0YUluZm8ubGFzdFVwZGF0ZVRpbWV9fVxuICAgICAgIC0gPHN0cm9uZz5OZXh0IHVwZGF0ZTwvc3Ryb25nPjoge3ttZXRhZGF0YUluZm8udXBkYXRlQ291bnRkb3dufX1cbiAgICA8L3NwYW4+XG4gIGAsXG4gIGNvbnRyb2xsZXI6IE1ldGFkYXRhSW5mb0NvbnRyb2xsZXIsXG4gIGNvbnRyb2xsZXJBczogJ21ldGFkYXRhSW5mbycsXG4gIGJpbmRpbmdzOiB7fVxufTtcblxuZXhwb3J0IGRlZmF1bHQgbWV0YWRhdGFJbmZvO1xuIiwiaW1wb3J0IHsgRkVUQ0hfSU5URVJWQUwsIFFVQUtFX1VSTCB9IGZyb20gJy4uL3NldHRpbmdzJztcblxucXVha2VzU2VydmljZS4kaW5qZWN0ID0gWydSeCddO1xuZnVuY3Rpb24gcXVha2VzU2VydmljZShSeCl7XG5cbiAgY29uc3QganNvblN0cmVhbSA9ICgpID0+IHtcbiAgICByZXR1cm4gUnguRE9NLmpzb25wUmVxdWVzdCh7XG4gICAgICB1cmw6IFFVQUtFX1VSTCxcbiAgICAgIGpzb25wQ2FsbGJhY2s6ICdlcWZlZWRfY2FsbGJhY2snXG4gICAgfSk7XG4gIH07XG5cbiAgY29uc3QgcXVha2VTdHJlYW0gPSBSeC5PYnNlcnZhYmxlXG4gICAgICAuaW50ZXJ2YWwoRkVUQ0hfSU5URVJWQUwpXG4gICAgICAuc3RhcnRXaXRoKDEpXG4gICAgICAuZmxhdE1hcCgoKSA9PiBqc29uU3RyZWFtKCkpO1xuXG4gIGZ1bmN0aW9uIGdldFN0cmVhbU1ldGFkYXRhKCl7XG4gICAgcmV0dXJuIHF1YWtlU3RyZWFtXG4gICAgICAuZmxhdE1hcCgocmVzdWx0KSA9PiB7XG4gICAgICAgIHJldHVybiBSeC5PYnNlcnZhYmxlLnJldHVybihyZXN1bHQucmVzcG9uc2UubWV0YWRhdGEpO1xuICAgICAgICAvL3JldHVybiBSeC5PYnNlcnZhYmxlLnJldHVybih7IGdlbmVyYXRlZDogRGF0ZS5ub3coKSB9KTtcbiAgICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0UXVha2VzU3RyZWFtKCl7XG4gICAgcmV0dXJuIHF1YWtlU3RyZWFtXG4gICAgICAuZmxhdE1hcCgocmVzdWx0KSA9PiB7XG4gICAgICAgIHJldHVybiBSeC5PYnNlcnZhYmxlLmZyb20ocmVzdWx0LnJlc3BvbnNlLmZlYXR1cmVzKTtcbiAgICAgIH0pXG4gICAgICAuZGlzdGluY3QoKGZlYXR1cmUpID0+IHtcbiAgICAgICAgcmV0dXJuIGZlYXR1cmUucHJvcGVydGllcy5jb2RlO1xuICAgICAgfSlcbiAgICAgIC5tYXAoKGZlYXR1cmUpID0+IHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBsYXQ6IGZlYXR1cmUuZ2VvbWV0cnkuY29vcmRpbmF0ZXNbMV0sXG4gICAgICAgICAgbG5nOiBmZWF0dXJlLmdlb21ldHJ5LmNvb3JkaW5hdGVzWzBdLFxuICAgICAgICAgIG1hZzogZmVhdHVyZS5wcm9wZXJ0aWVzLm1hZyxcbiAgICAgICAgICBjb2RlOiBmZWF0dXJlLnByb3BlcnRpZXMuY29kZSxcbiAgICAgICAgICBwbGFjZTogZmVhdHVyZS5wcm9wZXJ0aWVzLnBsYWNlLFxuICAgICAgICAgIHVybDogZmVhdHVyZS5wcm9wZXJ0aWVzLnVybCxcbiAgICAgICAgICB0aW1lOiBmZWF0dXJlLnByb3BlcnRpZXMudGltZSxcbiAgICAgICAgICB0ejogZmVhdHVyZS5wcm9wZXJ0aWVzLnR6XG4gICAgICAgIH07XG4gICAgICB9KVxuICAgICAgLmZpbHRlcigocXVha2UpID0+IHtcbiAgICAgICAgcmV0dXJuIHF1YWtlLm1hZyA+PSAxO1xuICAgICAgfSk7XG4gIH07XG5cbiAgcmV0dXJuIHtcbiAgICBnZXRRdWFrZXNTdHJlYW0sXG4gICAgZ2V0U3RyZWFtTWV0YWRhdGFcbiAgfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgcXVha2VzU2VydmljZTtcbiIsImltcG9ydCBhbmd1bGFyIGZyb20gJ2FuZ3VsYXInO1xuXG5pbXBvcnQgbWFwQ29tcG9uZW50IGZyb20gJy4vbWFwLmNvbXBvbmVudCc7XG5pbXBvcnQgdmlld1NlbGVjdG9yIGZyb20gJy4vdmlldy1zZWxlY3Rvci5jb21wb25lbnQnO1xuaW1wb3J0IGRhdGF0YWJsZSBmcm9tICcuL2RhdGF0YWJsZS5jb21wb25lbnQnO1xuaW1wb3J0IG1ldGFkYXRhSW5mbyBmcm9tICcuL21ldGFkYXRhLWluZm8uY29tcG9uZW50JztcbmltcG9ydCBxdWFrZXNTZXJ2aWNlIGZyb20gJy4vcXVha2VzLnNlcnZpY2UnO1xuXG5jb25zdCBkYXNoYm9hcmQgPSBhbmd1bGFyLm1vZHVsZSgnZGFzaGJvYXJkJywgWydkYXRhdGFibGVzJ10pXG4gIC5mYWN0b3J5KCdxdWFrZXNTZXJ2aWNlJywgcXVha2VzU2VydmljZSlcbiAgLmNvbXBvbmVudCgnbWFwJywgbWFwQ29tcG9uZW50KVxuICAuY29tcG9uZW50KCd2aWV3U2VsZWN0b3InLCB2aWV3U2VsZWN0b3IpXG4gIC5jb21wb25lbnQoJ21ldGFkYXRhSW5mbycsIG1ldGFkYXRhSW5mbylcbiAgLmRpcmVjdGl2ZSgnZGF0YXRhYmxlJywgZGF0YXRhYmxlKVxuICAubmFtZTtcblxuZXhwb3J0IGRlZmF1bHQgZGFzaGJvYXJkO1xuIiwiaW1wb3J0IGFuZ3VsYXIgZnJvbSAnYW5ndWxhcic7XG5cbi8qKlxuKiBAbmdkb2Mgb3ZlcnZpZXdcbiogQG5hbWUgc2hpbXNcbiogQGRlc2NyaXB0aW9uXG4qIERlc2NyaXB0aW9uIG9mIHRoZSBzaGltcyBtb2R1bGUuXG4qL1xuY29uc3Qgc2hpbXMgPSBhbmd1bGFyLm1vZHVsZSgnc2hpbXMnLCBbXSlcbiAgLnZhbHVlKCdsZWFmbGV0Jywgd2luZG93LkwpXG4gIC52YWx1ZSgnbG9kYXNoJywgd2luZG93Ll8pXG4gIC52YWx1ZSgnUngnLCB3aW5kb3cuUngpXG4gIC52YWx1ZSgnanF1ZXJ5Jywgd2luZG93LmpRdWVyeSlcbiAgLm5hbWU7XG5cbmV4cG9ydCBkZWZhdWx0IHNoaW1zO1xuIiwiaW1wb3J0IGFuZ3VsYXIgZnJvbSAnYW5ndWxhcic7XG5cbmNvbnN0IHV0aWxzID0gYW5ndWxhci5tb2R1bGUoJ3V0aWxzJywgW10pXG4gIC5uYW1lO1xuXG5leHBvcnQgZGVmYXVsdCB1dGlscztcbiIsImltcG9ydCBhbmd1bGFyIGZyb20gJ2FuZ3VsYXInO1xuXG5pbXBvcnQgZGFzaGJvYXJkIGZyb20gJy4vZGFzaGJvYXJkL2Rhc2hib2FyZCc7XG5pbXBvcnQgc2hpbXMgZnJvbSAnLi9zaGltcy9zaGltcyc7XG5pbXBvcnQgdXRpbHMgZnJvbSAnLi91dGlscy91dGlscyc7XG5cbmNvbnN0IHF1YWtlbWFwID0gYW5ndWxhci5tb2R1bGUoJ3F1YWtlbWFwJywgW1xuICAgIHNoaW1zLFxuICAgIHV0aWxzLFxuICAgIGRhc2hib2FyZFxuICBdKVxuICAubmFtZTtcblxuYW5ndWxhci5ib290c3RyYXAoZG9jdW1lbnQsIFtxdWFrZW1hcF0pO1xuXG5leHBvcnQgZGVmYXVsdCBxdWFrZW1hcDtcbiJdLCJuYW1lcyI6WyJCZWhhdmlvclN1YmplY3QiLCJNYXBDb250cm9sbGVyIiwiJGluamVjdCIsIkwiLCJxdWFrZXNTZXJ2aWNlIiwicXVha2VzU3RyZWFtIiwiJG9uSW5pdCIsIm1hcCIsIm1hcmtlcnMiLCJjaXJjbGVzIiwiZHJhd1F1YWtlIiwicXVha2UiLCJwb3B1cERhdGEiLCJwbGFjZSIsIkRhdGUiLCJ0aW1lIiwidG9VVENTdHJpbmciLCJtYWciLCJjb2RlIiwiY2lyY2xlIiwibGF0IiwibG5nIiwiYWRkVG8iLCJtYXJrZXIiLCJiaW5kUG9wdXAiLCJ0aWxlTGF5ZXIiLCJzZXRWaWV3IiwiZ2V0UXVha2VzU3RyZWFtIiwic3Vic2NyaWJlIiwiJG9uRGVzdHJveSIsImRpc3Bvc2UiLCJtYXBDb21wb25lbnQiLCJzdHJvbmdlc3RTb0ZhciIsImFjYyIsInZhbCIsImxhdGVzdFNvRmFyIiwiVmlld1NlbGVjdG9yQ29udHJvbGxlciIsIl8iLCIkIiwiJHJhZGlvcyIsInJhZGlvQ2hhbmdlcyIsIlJ4IiwiT2JzZXJ2YWJsZSIsImZyb21FdmVudCIsImJ5VmFsdWUiLCJldmVudCIsInRhcmdldCIsInZhbHVlIiwiZmlsdGVyIiwibWVyZ2UiLCJzY2FuIiwic2FtcGxlIiwicmFkaW9GaWx0ZXJTdWJqZWN0Iiwic2tpcCIsInZpZXdTZWxlY3RvciIsImRhdGF0YWJsZSIsIiR0aW1lb3V0IiwiJGZpbHRlciIsInNjb3BlIiwibGluayIsIiRzY29wZSIsIiRlbGVtZW50IiwiJHRhYmxlIiwiZmluZCIsInF1YWtlcyIsImRhdGVGaWx0ZXIiLCJmb3JtYXREYXRlIiwiT2JqZWN0IiwiYXNzaWduIiwiU3RyaW5nIiwidHoiLCJidWZmZXJXaXRoVGltZSIsImxlbmd0aCIsImNvbmNhdCIsIiRhcHBseSIsIkRhdGFUYWJsZSIsImNvbHVtbiIsIm9yZGVyIiwiZHJhdyIsIiRvbiIsIkZFVENIX0lOVEVSVkFMIiwiUVVBS0VfVVJMIiwiTWV0YWRhdGFJbmZvQ29udHJvbGxlciIsIiRpbnRlcnZhbCIsIm9uTWV0YWRhdGFVcGRhdGUiLCJxdWFrZVN0cmVhbSIsImdldFN0cmVhbU1ldGFkYXRhIiwiY291bnRkb3duUHJvbWlzZSIsIm1ldGFkYXRhIiwibGFzdFVwZGF0ZVRpbWUiLCJnZW5lcmF0ZWQiLCJ1cGRhdGVDb3VudGRvd24iLCJjYW5jZWwiLCJ0aWNrVmFsdWUiLCJtZXRhZGF0YUluZm8iLCJqc29uU3RyZWFtIiwiRE9NIiwianNvbnBSZXF1ZXN0IiwiaW50ZXJ2YWwiLCJzdGFydFdpdGgiLCJmbGF0TWFwIiwicmVzdWx0IiwicmV0dXJuIiwicmVzcG9uc2UiLCJmcm9tIiwiZmVhdHVyZXMiLCJkaXN0aW5jdCIsImZlYXR1cmUiLCJwcm9wZXJ0aWVzIiwiZ2VvbWV0cnkiLCJjb29yZGluYXRlcyIsInVybCIsImRhc2hib2FyZCIsImFuZ3VsYXIiLCJtb2R1bGUiLCJmYWN0b3J5IiwiY29tcG9uZW50IiwiZGlyZWN0aXZlIiwibmFtZSIsInNoaW1zIiwid2luZG93IiwialF1ZXJ5IiwidXRpbHMiLCJxdWFrZW1hcCIsImJvb3RzdHJhcCIsImRvY3VtZW50Il0sIm1hcHBpbmdzIjoiOzs7OztBQUVBLHlCQUFlLElBQUlBLGtCQUFKLEVBQWY7O0FDQUE7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