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
ViewSelectorController.$inject = ['quakesService', 'jquery'];
function ViewSelectorController(quakesService, $) {

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

var FETCH_INTERVAL = 1800e+3; // every half hour

var QUAKE_URL = '//earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojsonp';

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
        _this.updateCountdown = dateFilter(FETCH_INTERVAL - tickValue * 1000, 'HH:mm:ss', '+000');
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
var shims = angular.module('shims', []).value('leaflet', window.L).value('Rx', window.Rx).value('jquery', window.jQuery).name;

var utils = angular.module('utils', []).name;

var quakemap = angular.module('quakemap', [shims, utils, dashboard]).name;

angular.bootstrap(document, [quakemap]);

return quakemap;

}(angular,Rx));

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjpudWxsLCJzb3VyY2VzIjpbImFwcC9kYXNoYm9hcmQvcmFkaW9GaWx0ZXJTdWJqZWN0LmpzIiwiYXBwL2Rhc2hib2FyZC9tYXAuY29tcG9uZW50LmpzIiwiYXBwL3V0aWxzL3F1YWtlc0RhdGFVdGlscy5qcyIsImFwcC9kYXNoYm9hcmQvdmlldy1zZWxlY3Rvci5jb21wb25lbnQuanMiLCJhcHAvZGFzaGJvYXJkL2RhdGF0YWJsZS5jb21wb25lbnQuanMiLCJhcHAvc2V0dGluZ3MuanMiLCJhcHAvZGFzaGJvYXJkL21ldGFkYXRhLWluZm8uY29tcG9uZW50LmpzIiwiYXBwL2Rhc2hib2FyZC9xdWFrZXMuc2VydmljZS5qcyIsImFwcC9kYXNoYm9hcmQvZGFzaGJvYXJkLmpzIiwiYXBwL3NoaW1zL3NoaW1zLmpzIiwiYXBwL3V0aWxzL3V0aWxzLmpzIiwiYXBwL3F1YWtlbWFwLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJlaGF2aW9yU3ViamVjdCB9IGZyb20gJ3J4JztcblxuZXhwb3J0IGRlZmF1bHQgbmV3IEJlaGF2aW9yU3ViamVjdCgpO1xuIiwiaW1wb3J0IHJhZGlvRmlsdGVyU3ViamVjdCBmcm9tICcuL3JhZGlvRmlsdGVyU3ViamVjdCc7XG5cbi8qKlxuKiBAbmdkb2MgZGlyZWN0aXZlXG4qIEBuYW1lIGRhc2hib2FyZC5kaXJlY3RpdmU6bWFwXG4qIEBkZXNjcmlwdGlvblxuKiBEZXNjcmlwdGlvbiBvZiB0aGUgbWFwIGRpcmVjdGl2ZS5cbiovXG5cbk1hcENvbnRyb2xsZXIuJGluamVjdCA9IFsnbGVhZmxldCcsICdxdWFrZXNTZXJ2aWNlJ107XG5mdW5jdGlvbiBNYXBDb250cm9sbGVyKEwsIHF1YWtlc1NlcnZpY2Upe1xuICBsZXQgcXVha2VzU3RyZWFtO1xuXG4gIHRoaXMuJG9uSW5pdCA9ICgpID0+IHtcbiAgICBsZXQgbWFwID0gTC5tYXAoJ21hcCcpO1xuICAgIGxldCBtYXJrZXJzID0ge307XG4gICAgbGV0IGNpcmNsZXMgPSB7fTtcblxuICAgIGNvbnN0IGRyYXdRdWFrZSA9IChxdWFrZSkgPT4ge1xuICAgICAgY29uc3QgcG9wdXBEYXRhID0gJycgK1xuICAgICAgICAnPGgzPicgKyBxdWFrZS5wbGFjZSArICc8L2gzPicgK1xuICAgICAgICAnPHVsPicgK1xuICAgICAgICAgICc8bGk+PHN0cm9uZz5UaW1lOjwvc3Ryb25nPiAnICtcbiAgICAgICAgICAgIG5ldyBEYXRlKHF1YWtlLnRpbWUpLnRvVVRDU3RyaW5nKCkgK1xuICAgICAgICAgICc8L2xpPicgK1xuICAgICAgICAgICc8bGk+PHN0cm9uZz5NYWduaXR1ZGU6PC9zdHJvbmc+ICcgKyBxdWFrZS5tYWcgKyAnPC9saT4nICtcbiAgICAgICAgJzwvdWw+JztcblxuICAgICAgY2lyY2xlc1txdWFrZS5jb2RlXSA9IEwuY2lyY2xlKFxuICAgICAgICBbcXVha2UubGF0LCBxdWFrZS5sbmddLFxuICAgICAgICBxdWFrZS5tYWcgKiAxMDAwXG4gICAgICApLmFkZFRvKG1hcCk7XG5cbiAgICAgIG1hcmtlcnNbcXVha2UuY29kZV0gPSBMLm1hcmtlcihbcXVha2UubGF0LCBxdWFrZS5sbmddKVxuICAgICAgICAuYWRkVG8obWFwKVxuICAgICAgICAuYmluZFBvcHVwKHBvcHVwRGF0YSk7XG4gICAgfTtcblxuXG4gICAgTC50aWxlTGF5ZXIoJy8ve3N9LnRpbGUub3BlbnN0cmVldG1hcC5vcmcve3p9L3t4fS97eX0ucG5nJywge1xuICAgICAgYXR0cmlidXRpb246IGBcbiAgICAgICAgJmNvcHk7IDxhIGhyZWY9XCJodHRwOi8vb3NtLm9yZy9jb3B5cmlnaHRcIj5PcGVuU3RyZWV0TWFwPC9hPlxuICAgICAgICBjb250cmlidXRvcnNcbiAgICAgIGBcbiAgICB9KS5hZGRUbyhtYXApO1xuXG4gICAgbWFwLnNldFZpZXcoWzAsIDBdLCA3KTtcblxuICAgIHF1YWtlc1N0cmVhbSA9IHF1YWtlc1NlcnZpY2VcbiAgICAgIC5nZXRRdWFrZXNTdHJlYW0oKVxuICAgICAgLnN1YnNjcmliZShkcmF3UXVha2UpO1xuXG4gICAgcmFkaW9GaWx0ZXJTdWJqZWN0LnN1YnNjcmliZSgocXVha2UpID0+IHtcbiAgICAgIGlmIChxdWFrZSl7XG4gICAgICAgIG1hcC5zZXRWaWV3KFtxdWFrZS5sYXQsIHF1YWtlLmxuZ10sIDcpO1xuICAgICAgfVxuICAgIH0pO1xuICB9O1xuXG4gIHRoaXMuJG9uRGVzdHJveSA9ICgpID0+IHtcbiAgICBxdWFrZXNTdHJlYW0uZGlzcG9zZSgpO1xuICB9O1xufVxuXG5jb25zdCBtYXBDb21wb25lbnQgPSB7XG4gIHRlbXBsYXRlOiAnPGRpdiBpZD1cIm1hcFwiPm1hcDwvZGl2PicsXG4gIGNvbnRyb2xsZXI6IE1hcENvbnRyb2xsZXIsXG4gIGNvbnRyb2xsZXJBczogJ21hcCcsXG4gIGJpbmRpbmdzOiB7fVxufTtcblxuZXhwb3J0IGRlZmF1bHQgbWFwQ29tcG9uZW50O1xuXG5cbiIsImV4cG9ydCBjb25zdCBzdHJvbmdlc3RTb0ZhciA9IChhY2MgPSB7IG1hZzogMCB9LCB2YWwpID0+IHtcbiAgcmV0dXJuIHZhbC5tYWcgPiBhY2MubWFnID8gdmFsIDogYWNjO1xufTtcblxuZXhwb3J0IGNvbnN0IGxhdGVzdFNvRmFyID0gKGFjYyA9IDAsIHZhbCkgPT4ge1xuICByZXR1cm4gdmFsLnRpbWUgPiBhY2MudGltZSA/IHZhbCA6IGFjYztcbn07XG4iLCJpbXBvcnQgeyBzdHJvbmdlc3RTb0ZhciwgbGF0ZXN0U29GYXIgfSBmcm9tICcuLi91dGlscy9xdWFrZXNEYXRhVXRpbHMnO1xuaW1wb3J0IHJhZGlvRmlsdGVyU3ViamVjdCBmcm9tICcuL3JhZGlvRmlsdGVyU3ViamVjdCc7XG5cbi8qKlxuKiBAbmdkb2MgZGlyZWN0aXZlXG4qIEBuYW1lIGRhc2hib2FyZC5kaXJlY3RpdmU6dmlld1NlbGVjdG9yXG4qIEBkZXNjcmlwdGlvblxuKiBEZXNjcmlwdGlvbiBvZiB0aGUgdmlld1NlbGVjdG9yIGRpcmVjdGl2ZS5cbiovXG5WaWV3U2VsZWN0b3JDb250cm9sbGVyLiRpbmplY3QgPSBbXG4gICdxdWFrZXNTZXJ2aWNlJyxcbiAgJ2pxdWVyeSdcbl07XG5mdW5jdGlvbiBWaWV3U2VsZWN0b3JDb250cm9sbGVyKHF1YWtlc1NlcnZpY2UsICQpe1xuXG4gIHRoaXMuJG9uSW5pdCA9ICgpID0+IHtcbiAgICBjb25zdCBxdWFrZXNTdHJlYW0gPSBxdWFrZXNTZXJ2aWNlLmdldFF1YWtlc1N0cmVhbSgpO1xuXG4gICAgY29uc3QgJHJhZGlvcyA9ICQoJ1tuYW1lPVwic2hvdy1maWx0ZXJcIl0nKTtcbiAgICBjb25zdCByYWRpb0NoYW5nZXMgPSBSeC5PYnNlcnZhYmxlLmZyb21FdmVudCgkcmFkaW9zLCAnY2hhbmdlJyk7XG5cbiAgICBjb25zdCBieVZhbHVlID0gZnVuY3Rpb24oZXZlbnQpe1xuICAgICAgLyogZXNsaW50IG5vLWludmFsaWQtdGhpczowICovXG4gICAgICByZXR1cm4gdGhpcyA9PT0gZXZlbnQudGFyZ2V0LnZhbHVlO1xuICAgIH07XG5cbiAgICByYWRpb0NoYW5nZXNcbiAgICAgIC5maWx0ZXIoYnlWYWx1ZSwgJ21hZycpXG4gICAgICAubWVyZ2UocXVha2VzU3RyZWFtKVxuICAgICAgLnNjYW4oc3Ryb25nZXN0U29GYXIpXG4gICAgICAuc2FtcGxlKDI1MClcbiAgICAgIC5zdWJzY3JpYmUocmFkaW9GaWx0ZXJTdWJqZWN0KTtcblxuICAgIHJhZGlvQ2hhbmdlc1xuICAgICAgLmZpbHRlcihieVZhbHVlLCAndGltZScpXG4gICAgICAubWVyZ2UocXVha2VzU3RyZWFtKVxuICAgICAgLnNjYW4obGF0ZXN0U29GYXIpXG4gICAgICAuc2FtcGxlKDI1MClcbiAgICAgIC8vIHNraXBzIHRoZSBmaXJzdCB2YWx1ZSB0byBsZXQgdGhlIG1hZyBvYnNlcnZlciB2YWx1ZSBvbmx5IHRvIGdvIHRocm91Z2hcbiAgICAgIC5za2lwKDEpXG4gICAgICAuc3Vic2NyaWJlKHJhZGlvRmlsdGVyU3ViamVjdCk7XG4gIH07XG5cbiAgdGhpcy4kb25EZXN0cm95ID0gKCkgPT4ge307XG59XG5cbmNvbnN0IHZpZXdTZWxlY3RvciA9IHtcbiAgdGVtcGxhdGU6IGBcbiAgICA8ZGl2IGNsYXNzPVwic2hvdy1maWx0ZXJcIj5cbiAgICAgIDxmb3JtPlxuICAgICAgICA8c3BhbiBjbGFzcz1cImZpbHRlci10aXRsZVwiPjxzdHJvbmc+U2hvdzwvc3Ryb25nPjwvc3Bhbj5cbiAgICAgICAgPGxhYmVsIGNsYXNzPVwicmFkaW8taW5saW5lXCI+XG4gICAgICAgICAgPGlucHV0IGNoZWNrZWQ9XCJ0cnVlXCJcbiAgICAgICAgICAgIHR5cGU9XCJyYWRpb1wiXG4gICAgICAgICAgICBuYW1lPVwic2hvdy1maWx0ZXJcIlxuICAgICAgICAgICAgdmFsdWU9XCJtYWdcIj4gU3Ryb25nZXN0XG4gICAgICAgIDwvbGFiZWw+XG4gICAgICAgIDxsYWJlbCBjbGFzcz1cInJhZGlvLWlubGluZVwiPlxuICAgICAgICAgIDxpbnB1dCB0eXBlPVwicmFkaW9cIiBuYW1lPVwic2hvdy1maWx0ZXJcIiB2YWx1ZT1cInRpbWVcIj4gTGF0ZXN0XG4gICAgICAgIDwvbGFiZWw+XG4gICAgICA8L2Zvcm0+XG4gICAgPC9kaXY+XG4gIGAsXG4gIGNvbnRyb2xsZXI6IFZpZXdTZWxlY3RvckNvbnRyb2xsZXIsXG4gIGNvbnRyb2xsZXJBczogJ3ZpZXdTZWxlY3RvcicsXG4gIGJpbmRpbmdzOiB7fVxufTtcblxuZXhwb3J0IGRlZmF1bHQgdmlld1NlbGVjdG9yO1xuIiwiLyoqXG4qIEBuZ2RvYyBkaXJlY3RpdmVcbiogQG5hbWUgZGFzaGJvYXJkLmRpcmVjdGl2ZTpkYXRhdGFibGVcbiogQGRlc2NyaXB0aW9uXG4qIERlc2NyaXB0aW9uIG9mIHRoZSBkYXRhdGFibGUgZGlyZWN0aXZlLlxuKi9cbmRhdGF0YWJsZS4kaW5qZWN0ID0gWyckdGltZW91dCcsICckZmlsdGVyJywgJ3F1YWtlc1NlcnZpY2UnXTtcbmZ1bmN0aW9uIGRhdGF0YWJsZSgkdGltZW91dCwgJGZpbHRlciwgcXVha2VzU2VydmljZSl7XG5cbiAgY29uc3Qgc2NvcGUgPSB7fTtcblxuICBmdW5jdGlvbiBsaW5rKCRzY29wZSwgJGVsZW1lbnQpe1xuICAgIGNvbnN0ICR0YWJsZSA9ICRlbGVtZW50LmZpbmQoJ3RhYmxlJyk7XG4gICAgJHNjb3BlLnF1YWtlcyA9IFtdO1xuXG4gICAgY29uc3QgcXVha2VzU3RyZWFtID0gcXVha2VzU2VydmljZS5nZXRRdWFrZXNTdHJlYW0oKTtcblxuICAgIGNvbnN0IGRhdGVGaWx0ZXIgPSAkZmlsdGVyKCdkYXRlJyk7XG4gICAgY29uc3QgZm9ybWF0RGF0ZSA9IChxdWFrZSkgPT4ge1xuICAgICAgcmV0dXJuIE9iamVjdC5hc3NpZ24oe30sIHF1YWtlLCB7XG4gICAgICAgIHRpbWU6IGRhdGVGaWx0ZXIoXG4gICAgICAgICAgcXVha2UudGltZSxcbiAgICAgICAgICAnTU1NIGRkLCB5eXl5IC0gSEg6bW0gVVRDWicsXG4gICAgICAgICAgU3RyaW5nKHF1YWtlLnR6KVxuICAgICAgICApXG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgcXVha2VzU3RyZWFtXG4gICAgICAuYnVmZmVyV2l0aFRpbWUoNTAwKVxuICAgICAgLmZpbHRlcigodmFsdWUpID0+IHZhbHVlLmxlbmd0aClcbiAgICAgIC5zdWJzY3JpYmUoKHF1YWtlcykgPT4ge1xuICAgICAgICAvLyBTdWJzZXF1ZW50IGRhdGEgc3RyZWFtIHdpbGwgYnJpbmcgaW4gb25seSB0aGUgbmV3IHF1YWtlcyB3ZSBkb24ndCB5ZXRcbiAgICAgICAgLy8gaGF2ZSwgdGhlcmVmb3JlIHdlIGNvbmNhdCB0aGUgbmV3IGRhdGEgdG8gdGhlIGV4aXN0aW5nIG9uZXMuXG4gICAgICAgICRzY29wZS5xdWFrZXMgPSAkc2NvcGUucXVha2VzLmNvbmNhdChxdWFrZXMubWFwKGZvcm1hdERhdGUpKTtcbiAgICAgICAgJHNjb3BlLiRhcHBseSgpO1xuXG4gICAgICAgIC8qIGVzbGludCBuZXctY2FwOjAgKi9cbiAgICAgICAgLy8gU29ydHMgdGhlIHRhYmxlIGJ5IHRoZSBtYWduaXR1ZGUgY29sdW1uXG4gICAgICAgICR0YWJsZS5EYXRhVGFibGUoKVxuICAgICAgICAgIC5jb2x1bW4oJzI6dmlzaWJsZScpXG4gICAgICAgICAgLm9yZGVyKCdkZXNjJylcbiAgICAgICAgICAuZHJhdygpO1xuICAgICAgfSk7XG5cbiAgICAkc2NvcGUuJG9uKCckZGVzdHJveScsICgpID0+IHtcbiAgICAgIHF1YWtlc1N0cmVhbS5kaXNwb3NlKCk7XG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIHJlc3RyaWN0OiAnRScsXG4gICAgdGVtcGxhdGU6IGBcbiAgICAgIDxkaXY+XG4gICAgICAgIDx0YWJsZSBkYXRhdGFibGU9XCJuZ1wiIGNsYXNzPVwidGFibGUgdGFibGUtc3RyaXBlZCB0YWJsZS1ob3ZlclwiPlxuICAgICAgICAgIDx0aGVhZD5cbiAgICAgICAgICAgIDx0cj5cbiAgICAgICAgICAgICAgPHRoPkxvY2F0aW9uPC90aD5cbiAgICAgICAgICAgICAgPHRoPlRpbWU8L3RoPlxuICAgICAgICAgICAgICA8dGg+TWFnbml0dWRlPC90aD5cbiAgICAgICAgICAgICAgPHRoPjwvdGg+XG4gICAgICAgICAgICA8L3RyPlxuICAgICAgICAgIDwvdGhlYWQ+XG4gICAgICAgICAgPHRib2R5PlxuICAgICAgICAgICAgPHRyIG5nLXJlcGVhdD1cInF1YWtlIGluIHF1YWtlc1wiPlxuICAgICAgICAgICAgICA8dGQ+e3txdWFrZS5wbGFjZX19PC90ZD5cbiAgICAgICAgICAgICAgPHRkPnt7cXVha2UudGltZX19PC90ZD5cbiAgICAgICAgICAgICAgPHRkPnt7cXVha2UubWFnfX08L3RkPlxuICAgICAgICAgICAgICA8dGQ+PGEgaHJlZj1cInt7cXVha2UudXJsfX1cIiB0YXJnZXQ9XCJfYmxhbmtcIj5Nb3JlIGRldGFpbHM8L2E+PC90ZD5cbiAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgPC90Ym9keT5cbiAgICAgICAgPC90YWJsZT5cbiAgICAgIDwvZGl2PlxuICAgIGAsXG4gICAgc2NvcGU6IHNjb3BlLFxuICAgIGxpbms6IGxpbmtcbiAgfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZGF0YXRhYmxlO1xuIiwiZXhwb3J0IGNvbnN0IEZFVENIX0lOVEVSVkFMID0gMTgwMGUrMzsgLy8gZXZlcnkgaGFsZiBob3VyXG5cbmV4cG9ydCBjb25zdCBRVUFLRV9VUkwgPSAoXG4gICcvL2VhcnRocXVha2UudXNncy5nb3YvZWFydGhxdWFrZXMvZmVlZC92MS4wL3N1bW1hcnkvYWxsX2RheS5nZW9qc29ucCdcbik7XG4iLCJpbXBvcnQgeyBGRVRDSF9JTlRFUlZBTCB9IGZyb20gJy4uL3NldHRpbmdzJztcblxuLyoqXG4qIEBuZ2RvYyBkaXJlY3RpdmVcbiogQG5hbWUgZGFzaGJvYXJkLmRpcmVjdGl2ZTptZXRhZGF0YUluZm9cbiogQGRlc2NyaXB0aW9uXG4qIERlc2NyaXB0aW9uIG9mIHRoZSBtZXRhZGF0YUluZm8gZGlyZWN0aXZlLlxuKi9cbk1ldGFkYXRhSW5mb0NvbnRyb2xsZXIuJGluamVjdCA9IFtcbiAgJyR0aW1lb3V0JyxcbiAgJyRpbnRlcnZhbCcsXG4gICckZmlsdGVyJyxcbiAgJ3F1YWtlc1NlcnZpY2UnXG5dO1xuZnVuY3Rpb24gTWV0YWRhdGFJbmZvQ29udHJvbGxlcigkdGltZW91dCwgJGludGVydmFsLCAkZmlsdGVyLCBxdWFrZXNTZXJ2aWNlKXtcbiAgbGV0IG9uTWV0YWRhdGFVcGRhdGU7XG5cbiAgdGhpcy4kb25Jbml0ID0gKCkgPT4ge1xuICAgIGNvbnN0IHF1YWtlU3RyZWFtID0gcXVha2VzU2VydmljZS5nZXRTdHJlYW1NZXRhZGF0YSgpO1xuICAgIGNvbnN0IGRhdGVGaWx0ZXIgPSAkZmlsdGVyKCdkYXRlJyk7XG4gICAgbGV0IGNvdW50ZG93blByb21pc2U7XG5cbiAgICBvbk1ldGFkYXRhVXBkYXRlID0gcXVha2VTdHJlYW0uc3Vic2NyaWJlKChtZXRhZGF0YSkgPT4ge1xuICAgICAgLy8gV2UgbXVzdCB1c2UgYSAkdGltZW91dCBoZXJlIHRvIGhvb2sgaW50byB0aGUgQW5ndWxhciBkaWdlc3QgY3ljbGVcbiAgICAgICR0aW1lb3V0KCgpID0+IHtcbiAgICAgICAgdGhpcy5sYXN0VXBkYXRlVGltZSA9IGRhdGVGaWx0ZXIoXG4gICAgICAgICAgbWV0YWRhdGEuZ2VuZXJhdGVkLFxuICAgICAgICAgICdNTU0gZGQsIHl5eXkgLSBISDptbSBVVENaJ1xuICAgICAgICApO1xuICAgICAgfSk7XG5cbiAgICAgIGlmIChjb3VudGRvd25Qcm9taXNlKXtcbiAgICAgICAgdGhpcy51cGRhdGVDb3VudGRvd24gPSAnMDA6MDA6MDAnO1xuICAgICAgICAkaW50ZXJ2YWwuY2FuY2VsKGNvdW50ZG93blByb21pc2UpO1xuICAgICAgfVxuXG4gICAgICBjb3VudGRvd25Qcm9taXNlID0gJGludGVydmFsKCh0aWNrVmFsdWUpID0+IHtcbiAgICAgICAgLy90aGlzLnVwZGF0ZUNvdW50ZG93biA9IChGRVRDSF9JTlRFUlZBTCAvIDEwMDApIC0gdGlja1ZhbHVlO1xuICAgICAgICB0aGlzLnVwZGF0ZUNvdW50ZG93biA9IGRhdGVGaWx0ZXIoXG4gICAgICAgICAgRkVUQ0hfSU5URVJWQUwgLSB0aWNrVmFsdWUgKiAxMDAwLFxuICAgICAgICAgICdISDptbTpzcycsXG4gICAgICAgICAgJyswMDAnXG4gICAgICAgICk7XG4gICAgICB9LCAxMDAwKTtcblxuICAgIH0pO1xuICB9O1xuXG4gIHRoaXMuJG9uRGVzdHJveSA9ICgpID0+IHtcbiAgICBvbk1ldGFkYXRhVXBkYXRlLmRpc3Bvc2UoKTtcbiAgfTtcbn1cblxuY29uc3QgbWV0YWRhdGFJbmZvID0ge1xuICB0ZW1wbGF0ZTogYFxuICAgIDxzcGFuIG5nLXNob3c9XCJtZXRhZGF0YUluZm8ubGFzdFVwZGF0ZVRpbWVcIj5cbiAgICAgIDxzdHJvbmc+TGFzdCB1cGRhdGU6IDwvc3Ryb25nPnt7bWV0YWRhdGFJbmZvLmxhc3RVcGRhdGVUaW1lfX1cbiAgICAgICAtIDxzdHJvbmc+TmV4dCB1cGRhdGU8L3N0cm9uZz46IHt7bWV0YWRhdGFJbmZvLnVwZGF0ZUNvdW50ZG93bn19XG4gICAgPC9zcGFuPlxuICBgLFxuICBjb250cm9sbGVyOiBNZXRhZGF0YUluZm9Db250cm9sbGVyLFxuICBjb250cm9sbGVyQXM6ICdtZXRhZGF0YUluZm8nLFxuICBiaW5kaW5nczoge31cbn07XG5cbmV4cG9ydCBkZWZhdWx0IG1ldGFkYXRhSW5mbztcbiIsImltcG9ydCB7IEZFVENIX0lOVEVSVkFMLCBRVUFLRV9VUkwgfSBmcm9tICcuLi9zZXR0aW5ncyc7XG5cbnF1YWtlc1NlcnZpY2UuJGluamVjdCA9IFsnUngnXTtcbmZ1bmN0aW9uIHF1YWtlc1NlcnZpY2UoUngpe1xuXG4gIGNvbnN0IGpzb25TdHJlYW0gPSAoKSA9PiB7XG4gICAgcmV0dXJuIFJ4LkRPTS5qc29ucFJlcXVlc3Qoe1xuICAgICAgdXJsOiBRVUFLRV9VUkwsXG4gICAgICBqc29ucENhbGxiYWNrOiAnZXFmZWVkX2NhbGxiYWNrJ1xuICAgIH0pO1xuICB9O1xuXG4gIGNvbnN0IHF1YWtlU3RyZWFtID0gUnguT2JzZXJ2YWJsZVxuICAgICAgLmludGVydmFsKEZFVENIX0lOVEVSVkFMKVxuICAgICAgLnN0YXJ0V2l0aCgxKVxuICAgICAgLmZsYXRNYXAoKCkgPT4ganNvblN0cmVhbSgpKTtcblxuICBmdW5jdGlvbiBnZXRTdHJlYW1NZXRhZGF0YSgpe1xuICAgIHJldHVybiBxdWFrZVN0cmVhbVxuICAgICAgLmZsYXRNYXAoKHJlc3VsdCkgPT4ge1xuICAgICAgICByZXR1cm4gUnguT2JzZXJ2YWJsZS5yZXR1cm4ocmVzdWx0LnJlc3BvbnNlLm1ldGFkYXRhKTtcbiAgICAgICAgLy9yZXR1cm4gUnguT2JzZXJ2YWJsZS5yZXR1cm4oeyBnZW5lcmF0ZWQ6IERhdGUubm93KCkgfSk7XG4gICAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldFF1YWtlc1N0cmVhbSgpe1xuICAgIHJldHVybiBxdWFrZVN0cmVhbVxuICAgICAgLmZsYXRNYXAoKHJlc3VsdCkgPT4ge1xuICAgICAgICByZXR1cm4gUnguT2JzZXJ2YWJsZS5mcm9tKHJlc3VsdC5yZXNwb25zZS5mZWF0dXJlcyk7XG4gICAgICB9KVxuICAgICAgLmRpc3RpbmN0KChmZWF0dXJlKSA9PiB7XG4gICAgICAgIHJldHVybiBmZWF0dXJlLnByb3BlcnRpZXMuY29kZTtcbiAgICAgIH0pXG4gICAgICAubWFwKChmZWF0dXJlKSA9PiB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgbGF0OiBmZWF0dXJlLmdlb21ldHJ5LmNvb3JkaW5hdGVzWzFdLFxuICAgICAgICAgIGxuZzogZmVhdHVyZS5nZW9tZXRyeS5jb29yZGluYXRlc1swXSxcbiAgICAgICAgICBtYWc6IGZlYXR1cmUucHJvcGVydGllcy5tYWcsXG4gICAgICAgICAgY29kZTogZmVhdHVyZS5wcm9wZXJ0aWVzLmNvZGUsXG4gICAgICAgICAgcGxhY2U6IGZlYXR1cmUucHJvcGVydGllcy5wbGFjZSxcbiAgICAgICAgICB1cmw6IGZlYXR1cmUucHJvcGVydGllcy51cmwsXG4gICAgICAgICAgdGltZTogZmVhdHVyZS5wcm9wZXJ0aWVzLnRpbWUsXG4gICAgICAgICAgdHo6IGZlYXR1cmUucHJvcGVydGllcy50elxuICAgICAgICB9O1xuICAgICAgfSlcbiAgICAgIC5maWx0ZXIoKHF1YWtlKSA9PiB7XG4gICAgICAgIHJldHVybiBxdWFrZS5tYWcgPj0gMTtcbiAgICAgIH0pO1xuICB9O1xuXG4gIHJldHVybiB7XG4gICAgZ2V0UXVha2VzU3RyZWFtLFxuICAgIGdldFN0cmVhbU1ldGFkYXRhXG4gIH07XG59XG5cbmV4cG9ydCBkZWZhdWx0IHF1YWtlc1NlcnZpY2U7XG4iLCJpbXBvcnQgYW5ndWxhciBmcm9tICdhbmd1bGFyJztcblxuaW1wb3J0IG1hcENvbXBvbmVudCBmcm9tICcuL21hcC5jb21wb25lbnQnO1xuaW1wb3J0IHZpZXdTZWxlY3RvciBmcm9tICcuL3ZpZXctc2VsZWN0b3IuY29tcG9uZW50JztcbmltcG9ydCBkYXRhdGFibGUgZnJvbSAnLi9kYXRhdGFibGUuY29tcG9uZW50JztcbmltcG9ydCBtZXRhZGF0YUluZm8gZnJvbSAnLi9tZXRhZGF0YS1pbmZvLmNvbXBvbmVudCc7XG5pbXBvcnQgcXVha2VzU2VydmljZSBmcm9tICcuL3F1YWtlcy5zZXJ2aWNlJztcblxuY29uc3QgZGFzaGJvYXJkID0gYW5ndWxhci5tb2R1bGUoJ2Rhc2hib2FyZCcsIFsnZGF0YXRhYmxlcyddKVxuICAuZmFjdG9yeSgncXVha2VzU2VydmljZScsIHF1YWtlc1NlcnZpY2UpXG4gIC5jb21wb25lbnQoJ21hcCcsIG1hcENvbXBvbmVudClcbiAgLmNvbXBvbmVudCgndmlld1NlbGVjdG9yJywgdmlld1NlbGVjdG9yKVxuICAuY29tcG9uZW50KCdtZXRhZGF0YUluZm8nLCBtZXRhZGF0YUluZm8pXG4gIC5kaXJlY3RpdmUoJ2RhdGF0YWJsZScsIGRhdGF0YWJsZSlcbiAgLm5hbWU7XG5cbmV4cG9ydCBkZWZhdWx0IGRhc2hib2FyZDtcbiIsImltcG9ydCBhbmd1bGFyIGZyb20gJ2FuZ3VsYXInO1xuXG4vKipcbiogQG5nZG9jIG92ZXJ2aWV3XG4qIEBuYW1lIHNoaW1zXG4qIEBkZXNjcmlwdGlvblxuKiBEZXNjcmlwdGlvbiBvZiB0aGUgc2hpbXMgbW9kdWxlLlxuKi9cbmNvbnN0IHNoaW1zID0gYW5ndWxhci5tb2R1bGUoJ3NoaW1zJywgW10pXG4gIC52YWx1ZSgnbGVhZmxldCcsIHdpbmRvdy5MKVxuICAudmFsdWUoJ1J4Jywgd2luZG93LlJ4KVxuICAudmFsdWUoJ2pxdWVyeScsIHdpbmRvdy5qUXVlcnkpXG4gIC5uYW1lO1xuXG5leHBvcnQgZGVmYXVsdCBzaGltcztcbiIsImltcG9ydCBhbmd1bGFyIGZyb20gJ2FuZ3VsYXInO1xuXG5jb25zdCB1dGlscyA9IGFuZ3VsYXIubW9kdWxlKCd1dGlscycsIFtdKVxuICAubmFtZTtcblxuZXhwb3J0IGRlZmF1bHQgdXRpbHM7XG4iLCJpbXBvcnQgYW5ndWxhciBmcm9tICdhbmd1bGFyJztcblxuaW1wb3J0IGRhc2hib2FyZCBmcm9tICcuL2Rhc2hib2FyZC9kYXNoYm9hcmQnO1xuaW1wb3J0IHNoaW1zIGZyb20gJy4vc2hpbXMvc2hpbXMnO1xuaW1wb3J0IHV0aWxzIGZyb20gJy4vdXRpbHMvdXRpbHMnO1xuXG5jb25zdCBxdWFrZW1hcCA9IGFuZ3VsYXIubW9kdWxlKCdxdWFrZW1hcCcsIFtcbiAgICBzaGltcyxcbiAgICB1dGlscyxcbiAgICBkYXNoYm9hcmRcbiAgXSlcbiAgLm5hbWU7XG5cbmFuZ3VsYXIuYm9vdHN0cmFwKGRvY3VtZW50LCBbcXVha2VtYXBdKTtcblxuZXhwb3J0IGRlZmF1bHQgcXVha2VtYXA7XG4iXSwibmFtZXMiOlsiQmVoYXZpb3JTdWJqZWN0IiwiTWFwQ29udHJvbGxlciIsIiRpbmplY3QiLCJMIiwicXVha2VzU2VydmljZSIsInF1YWtlc1N0cmVhbSIsIiRvbkluaXQiLCJtYXAiLCJtYXJrZXJzIiwiY2lyY2xlcyIsImRyYXdRdWFrZSIsInF1YWtlIiwicG9wdXBEYXRhIiwicGxhY2UiLCJEYXRlIiwidGltZSIsInRvVVRDU3RyaW5nIiwibWFnIiwiY29kZSIsImNpcmNsZSIsImxhdCIsImxuZyIsImFkZFRvIiwibWFya2VyIiwiYmluZFBvcHVwIiwidGlsZUxheWVyIiwic2V0VmlldyIsImdldFF1YWtlc1N0cmVhbSIsInN1YnNjcmliZSIsIiRvbkRlc3Ryb3kiLCJkaXNwb3NlIiwibWFwQ29tcG9uZW50Iiwic3Ryb25nZXN0U29GYXIiLCJhY2MiLCJ2YWwiLCJsYXRlc3RTb0ZhciIsIlZpZXdTZWxlY3RvckNvbnRyb2xsZXIiLCIkIiwiJHJhZGlvcyIsInJhZGlvQ2hhbmdlcyIsIlJ4IiwiT2JzZXJ2YWJsZSIsImZyb21FdmVudCIsImJ5VmFsdWUiLCJldmVudCIsInRhcmdldCIsInZhbHVlIiwiZmlsdGVyIiwibWVyZ2UiLCJzY2FuIiwic2FtcGxlIiwicmFkaW9GaWx0ZXJTdWJqZWN0Iiwic2tpcCIsInZpZXdTZWxlY3RvciIsImRhdGF0YWJsZSIsIiR0aW1lb3V0IiwiJGZpbHRlciIsInNjb3BlIiwibGluayIsIiRzY29wZSIsIiRlbGVtZW50IiwiJHRhYmxlIiwiZmluZCIsInF1YWtlcyIsImRhdGVGaWx0ZXIiLCJmb3JtYXREYXRlIiwiT2JqZWN0IiwiYXNzaWduIiwiU3RyaW5nIiwidHoiLCJidWZmZXJXaXRoVGltZSIsImxlbmd0aCIsImNvbmNhdCIsIiRhcHBseSIsIkRhdGFUYWJsZSIsImNvbHVtbiIsIm9yZGVyIiwiZHJhdyIsIiRvbiIsIkZFVENIX0lOVEVSVkFMIiwiUVVBS0VfVVJMIiwiTWV0YWRhdGFJbmZvQ29udHJvbGxlciIsIiRpbnRlcnZhbCIsIm9uTWV0YWRhdGFVcGRhdGUiLCJxdWFrZVN0cmVhbSIsImdldFN0cmVhbU1ldGFkYXRhIiwiY291bnRkb3duUHJvbWlzZSIsIm1ldGFkYXRhIiwibGFzdFVwZGF0ZVRpbWUiLCJnZW5lcmF0ZWQiLCJ1cGRhdGVDb3VudGRvd24iLCJjYW5jZWwiLCJ0aWNrVmFsdWUiLCJtZXRhZGF0YUluZm8iLCJqc29uU3RyZWFtIiwiRE9NIiwianNvbnBSZXF1ZXN0IiwiaW50ZXJ2YWwiLCJzdGFydFdpdGgiLCJmbGF0TWFwIiwicmVzdWx0IiwicmV0dXJuIiwicmVzcG9uc2UiLCJmcm9tIiwiZmVhdHVyZXMiLCJkaXN0aW5jdCIsImZlYXR1cmUiLCJwcm9wZXJ0aWVzIiwiZ2VvbWV0cnkiLCJjb29yZGluYXRlcyIsInVybCIsImRhc2hib2FyZCIsImFuZ3VsYXIiLCJtb2R1bGUiLCJmYWN0b3J5IiwiY29tcG9uZW50IiwiZGlyZWN0aXZlIiwibmFtZSIsInNoaW1zIiwid2luZG93IiwialF1ZXJ5IiwidXRpbHMiLCJxdWFrZW1hcCIsImJvb3RzdHJhcCIsImRvY3VtZW50Il0sIm1hcHBpbmdzIjoiOzs7OztBQUVBLHlCQUFlLElBQUlBLGtCQUFKLEVBQWY7O0FDQUE7Ozs7Ozs7QUFPQUMsY0FBY0MsT0FBZCxHQUF3QixDQUFDLFNBQUQsRUFBWSxlQUFaLENBQXhCO0FBQ0EsU0FBU0QsYUFBVCxDQUF1QkUsQ0FBdkIs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