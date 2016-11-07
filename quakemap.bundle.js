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

var FETCH_INTERVAL = 5000; //1800e+3; // every half hour

var QUAKE_URL =
//'//earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson'
'all_day.geojsonp';

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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjpudWxsLCJzb3VyY2VzIjpbImFwcC9kYXNoYm9hcmQvcmFkaW9GaWx0ZXJTdWJqZWN0LmpzIiwiYXBwL2Rhc2hib2FyZC9tYXAuY29tcG9uZW50LmpzIiwiYXBwL3V0aWxzL3F1YWtlc0RhdGFVdGlscy5qcyIsImFwcC9kYXNoYm9hcmQvdmlldy1zZWxlY3Rvci5jb21wb25lbnQuanMiLCJhcHAvZGFzaGJvYXJkL2RhdGF0YWJsZS5jb21wb25lbnQuanMiLCJhcHAvc2V0dGluZ3MuanMiLCJhcHAvZGFzaGJvYXJkL21ldGFkYXRhLWluZm8uY29tcG9uZW50LmpzIiwiYXBwL2Rhc2hib2FyZC9xdWFrZXMuc2VydmljZS5qcyIsImFwcC9kYXNoYm9hcmQvZGFzaGJvYXJkLmpzIiwiYXBwL3NoaW1zL3NoaW1zLmpzIiwiYXBwL3V0aWxzL3V0aWxzLmpzIiwiYXBwL3F1YWtlbWFwLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJlaGF2aW9yU3ViamVjdCB9IGZyb20gJ3J4JztcblxuZXhwb3J0IGRlZmF1bHQgbmV3IEJlaGF2aW9yU3ViamVjdCgpO1xuIiwiaW1wb3J0IHJhZGlvRmlsdGVyU3ViamVjdCBmcm9tICcuL3JhZGlvRmlsdGVyU3ViamVjdCc7XG5cbi8qKlxuKiBAbmdkb2MgZGlyZWN0aXZlXG4qIEBuYW1lIGRhc2hib2FyZC5kaXJlY3RpdmU6bWFwXG4qIEBkZXNjcmlwdGlvblxuKiBEZXNjcmlwdGlvbiBvZiB0aGUgbWFwIGRpcmVjdGl2ZS5cbiovXG5cbk1hcENvbnRyb2xsZXIuJGluamVjdCA9IFsnbGVhZmxldCcsICdxdWFrZXNTZXJ2aWNlJ107XG5mdW5jdGlvbiBNYXBDb250cm9sbGVyKEwsIHF1YWtlc1NlcnZpY2Upe1xuICBsZXQgcXVha2VzU3RyZWFtO1xuXG4gIHRoaXMuJG9uSW5pdCA9ICgpID0+IHtcbiAgICBsZXQgbWFwID0gTC5tYXAoJ21hcCcpO1xuICAgIGxldCBtYXJrZXJzID0ge307XG4gICAgbGV0IGNpcmNsZXMgPSB7fTtcblxuICAgIGNvbnN0IGRyYXdRdWFrZSA9IChxdWFrZSkgPT4ge1xuICAgICAgY29uc3QgcG9wdXBEYXRhID0gJycgK1xuICAgICAgICAnPGgzPicgKyBxdWFrZS5wbGFjZSArICc8L2gzPicgK1xuICAgICAgICAnPHVsPicgK1xuICAgICAgICAgICc8bGk+PHN0cm9uZz5UaW1lOjwvc3Ryb25nPiAnICtcbiAgICAgICAgICAgIG5ldyBEYXRlKHF1YWtlLnRpbWUpLnRvVVRDU3RyaW5nKCkgK1xuICAgICAgICAgICc8L2xpPicgK1xuICAgICAgICAgICc8bGk+PHN0cm9uZz5NYWduaXR1ZGU6PC9zdHJvbmc+ICcgKyBxdWFrZS5tYWcgKyAnPC9saT4nICtcbiAgICAgICAgJzwvdWw+JztcblxuICAgICAgY2lyY2xlc1txdWFrZS5jb2RlXSA9IEwuY2lyY2xlKFxuICAgICAgICBbcXVha2UubGF0LCBxdWFrZS5sbmddLFxuICAgICAgICBxdWFrZS5tYWcgKiAxMDAwXG4gICAgICApLmFkZFRvKG1hcCk7XG5cbiAgICAgIG1hcmtlcnNbcXVha2UuY29kZV0gPSBMLm1hcmtlcihbcXVha2UubGF0LCBxdWFrZS5sbmddKVxuICAgICAgICAuYWRkVG8obWFwKVxuICAgICAgICAuYmluZFBvcHVwKHBvcHVwRGF0YSk7XG4gICAgfTtcblxuXG4gICAgTC50aWxlTGF5ZXIoJy8ve3N9LnRpbGUub3BlbnN0cmVldG1hcC5vcmcve3p9L3t4fS97eX0ucG5nJywge1xuICAgICAgYXR0cmlidXRpb246IGBcbiAgICAgICAgJmNvcHk7IDxhIGhyZWY9XCJodHRwOi8vb3NtLm9yZy9jb3B5cmlnaHRcIj5PcGVuU3RyZWV0TWFwPC9hPlxuICAgICAgICBjb250cmlidXRvcnNcbiAgICAgIGBcbiAgICB9KS5hZGRUbyhtYXApO1xuXG4gICAgbWFwLnNldFZpZXcoWzAsIDBdLCA3KTtcblxuICAgIHF1YWtlc1N0cmVhbSA9IHF1YWtlc1NlcnZpY2VcbiAgICAgIC5nZXRRdWFrZXNTdHJlYW0oKVxuICAgICAgLnN1YnNjcmliZShkcmF3UXVha2UpO1xuXG4gICAgcmFkaW9GaWx0ZXJTdWJqZWN0LnN1YnNjcmliZSgocXVha2UpID0+IHtcbiAgICAgIGlmIChxdWFrZSl7XG4gICAgICAgIG1hcC5zZXRWaWV3KFtxdWFrZS5sYXQsIHF1YWtlLmxuZ10sIDcpO1xuICAgICAgfVxuICAgIH0pO1xuICB9O1xuXG4gIHRoaXMuJG9uRGVzdHJveSA9ICgpID0+IHtcbiAgICBxdWFrZXNTdHJlYW0uZGlzcG9zZSgpO1xuICB9O1xufVxuXG5jb25zdCBtYXBDb21wb25lbnQgPSB7XG4gIHRlbXBsYXRlOiAnPGRpdiBpZD1cIm1hcFwiPm1hcDwvZGl2PicsXG4gIGNvbnRyb2xsZXI6IE1hcENvbnRyb2xsZXIsXG4gIGNvbnRyb2xsZXJBczogJ21hcCcsXG4gIGJpbmRpbmdzOiB7fVxufTtcblxuZXhwb3J0IGRlZmF1bHQgbWFwQ29tcG9uZW50O1xuXG5cbiIsImV4cG9ydCBjb25zdCBzdHJvbmdlc3RTb0ZhciA9IChhY2MgPSB7IG1hZzogMCB9LCB2YWwpID0+IHtcbiAgcmV0dXJuIHZhbC5tYWcgPiBhY2MubWFnID8gdmFsIDogYWNjO1xufTtcblxuZXhwb3J0IGNvbnN0IGxhdGVzdFNvRmFyID0gKGFjYyA9IDAsIHZhbCkgPT4ge1xuICByZXR1cm4gdmFsLnRpbWUgPiBhY2MudGltZSA/IHZhbCA6IGFjYztcbn07XG4iLCJpbXBvcnQgeyBzdHJvbmdlc3RTb0ZhciwgbGF0ZXN0U29GYXIgfSBmcm9tICcuLi91dGlscy9xdWFrZXNEYXRhVXRpbHMnO1xuaW1wb3J0IHJhZGlvRmlsdGVyU3ViamVjdCBmcm9tICcuL3JhZGlvRmlsdGVyU3ViamVjdCc7XG5cbi8qKlxuKiBAbmdkb2MgZGlyZWN0aXZlXG4qIEBuYW1lIGRhc2hib2FyZC5kaXJlY3RpdmU6dmlld1NlbGVjdG9yXG4qIEBkZXNjcmlwdGlvblxuKiBEZXNjcmlwdGlvbiBvZiB0aGUgdmlld1NlbGVjdG9yIGRpcmVjdGl2ZS5cbiovXG5WaWV3U2VsZWN0b3JDb250cm9sbGVyLiRpbmplY3QgPSBbXG4gICdxdWFrZXNTZXJ2aWNlJyxcbiAgJ2pxdWVyeSdcbl07XG5mdW5jdGlvbiBWaWV3U2VsZWN0b3JDb250cm9sbGVyKHF1YWtlc1NlcnZpY2UsICQpe1xuXG4gIHRoaXMuJG9uSW5pdCA9ICgpID0+IHtcbiAgICBjb25zdCBxdWFrZXNTdHJlYW0gPSBxdWFrZXNTZXJ2aWNlLmdldFF1YWtlc1N0cmVhbSgpO1xuXG4gICAgY29uc3QgJHJhZGlvcyA9ICQoJ1tuYW1lPVwic2hvdy1maWx0ZXJcIl0nKTtcbiAgICBjb25zdCByYWRpb0NoYW5nZXMgPSBSeC5PYnNlcnZhYmxlLmZyb21FdmVudCgkcmFkaW9zLCAnY2hhbmdlJyk7XG5cbiAgICBjb25zdCBieVZhbHVlID0gZnVuY3Rpb24oZXZlbnQpe1xuICAgICAgLyogZXNsaW50IG5vLWludmFsaWQtdGhpczowICovXG4gICAgICByZXR1cm4gdGhpcyA9PT0gZXZlbnQudGFyZ2V0LnZhbHVlO1xuICAgIH07XG5cbiAgICByYWRpb0NoYW5nZXNcbiAgICAgIC5maWx0ZXIoYnlWYWx1ZSwgJ21hZycpXG4gICAgICAubWVyZ2UocXVha2VzU3RyZWFtKVxuICAgICAgLnNjYW4oc3Ryb25nZXN0U29GYXIpXG4gICAgICAuc2FtcGxlKDI1MClcbiAgICAgIC5zdWJzY3JpYmUocmFkaW9GaWx0ZXJTdWJqZWN0KTtcblxuICAgIHJhZGlvQ2hhbmdlc1xuICAgICAgLmZpbHRlcihieVZhbHVlLCAndGltZScpXG4gICAgICAubWVyZ2UocXVha2VzU3RyZWFtKVxuICAgICAgLnNjYW4obGF0ZXN0U29GYXIpXG4gICAgICAuc2FtcGxlKDI1MClcbiAgICAgIC8vIHNraXBzIHRoZSBmaXJzdCB2YWx1ZSB0byBsZXQgdGhlIG1hZyBvYnNlcnZlciB2YWx1ZSBvbmx5IHRvIGdvIHRocm91Z2hcbiAgICAgIC5za2lwKDEpXG4gICAgICAuc3Vic2NyaWJlKHJhZGlvRmlsdGVyU3ViamVjdCk7XG4gIH07XG5cbiAgdGhpcy4kb25EZXN0cm95ID0gKCkgPT4ge307XG59XG5cbmNvbnN0IHZpZXdTZWxlY3RvciA9IHtcbiAgdGVtcGxhdGU6IGBcbiAgICA8ZGl2IGNsYXNzPVwic2hvdy1maWx0ZXJcIj5cbiAgICAgIDxmb3JtPlxuICAgICAgICA8c3BhbiBjbGFzcz1cImZpbHRlci10aXRsZVwiPjxzdHJvbmc+U2hvdzwvc3Ryb25nPjwvc3Bhbj5cbiAgICAgICAgPGxhYmVsIGNsYXNzPVwicmFkaW8taW5saW5lXCI+XG4gICAgICAgICAgPGlucHV0IGNoZWNrZWQ9XCJ0cnVlXCJcbiAgICAgICAgICAgIHR5cGU9XCJyYWRpb1wiXG4gICAgICAgICAgICBuYW1lPVwic2hvdy1maWx0ZXJcIlxuICAgICAgICAgICAgdmFsdWU9XCJtYWdcIj4gU3Ryb25nZXN0XG4gICAgICAgIDwvbGFiZWw+XG4gICAgICAgIDxsYWJlbCBjbGFzcz1cInJhZGlvLWlubGluZVwiPlxuICAgICAgICAgIDxpbnB1dCB0eXBlPVwicmFkaW9cIiBuYW1lPVwic2hvdy1maWx0ZXJcIiB2YWx1ZT1cInRpbWVcIj4gTGF0ZXN0XG4gICAgICAgIDwvbGFiZWw+XG4gICAgICA8L2Zvcm0+XG4gICAgPC9kaXY+XG4gIGAsXG4gIGNvbnRyb2xsZXI6IFZpZXdTZWxlY3RvckNvbnRyb2xsZXIsXG4gIGNvbnRyb2xsZXJBczogJ3ZpZXdTZWxlY3RvcicsXG4gIGJpbmRpbmdzOiB7fVxufTtcblxuZXhwb3J0IGRlZmF1bHQgdmlld1NlbGVjdG9yO1xuIiwiLyoqXG4qIEBuZ2RvYyBkaXJlY3RpdmVcbiogQG5hbWUgZGFzaGJvYXJkLmRpcmVjdGl2ZTpkYXRhdGFibGVcbiogQGRlc2NyaXB0aW9uXG4qIERlc2NyaXB0aW9uIG9mIHRoZSBkYXRhdGFibGUgZGlyZWN0aXZlLlxuKi9cbmRhdGF0YWJsZS4kaW5qZWN0ID0gWyckdGltZW91dCcsICckZmlsdGVyJywgJ3F1YWtlc1NlcnZpY2UnXTtcbmZ1bmN0aW9uIGRhdGF0YWJsZSgkdGltZW91dCwgJGZpbHRlciwgcXVha2VzU2VydmljZSl7XG5cbiAgY29uc3Qgc2NvcGUgPSB7fTtcblxuICBmdW5jdGlvbiBsaW5rKCRzY29wZSwgJGVsZW1lbnQpe1xuICAgIGNvbnN0ICR0YWJsZSA9ICRlbGVtZW50LmZpbmQoJ3RhYmxlJyk7XG4gICAgJHNjb3BlLnF1YWtlcyA9IFtdO1xuXG4gICAgY29uc3QgcXVha2VzU3RyZWFtID0gcXVha2VzU2VydmljZS5nZXRRdWFrZXNTdHJlYW0oKTtcblxuICAgIGNvbnN0IGRhdGVGaWx0ZXIgPSAkZmlsdGVyKCdkYXRlJyk7XG4gICAgY29uc3QgZm9ybWF0RGF0ZSA9IChxdWFrZSkgPT4ge1xuICAgICAgcmV0dXJuIE9iamVjdC5hc3NpZ24oe30sIHF1YWtlLCB7XG4gICAgICAgIHRpbWU6IGRhdGVGaWx0ZXIoXG4gICAgICAgICAgcXVha2UudGltZSxcbiAgICAgICAgICAnTU1NIGRkLCB5eXl5IC0gSEg6bW0gVVRDWicsXG4gICAgICAgICAgU3RyaW5nKHF1YWtlLnR6KVxuICAgICAgICApXG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgcXVha2VzU3RyZWFtXG4gICAgICAuYnVmZmVyV2l0aFRpbWUoNTAwKVxuICAgICAgLmZpbHRlcigodmFsdWUpID0+IHZhbHVlLmxlbmd0aClcbiAgICAgIC5zdWJzY3JpYmUoKHF1YWtlcykgPT4ge1xuICAgICAgICAvLyBTdWJzZXF1ZW50IGRhdGEgc3RyZWFtIHdpbGwgYnJpbmcgaW4gb25seSB0aGUgbmV3IHF1YWtlcyB3ZSBkb24ndCB5ZXRcbiAgICAgICAgLy8gaGF2ZSwgdGhlcmVmb3JlIHdlIGNvbmNhdCB0aGUgbmV3IGRhdGEgdG8gdGhlIGV4aXN0aW5nIG9uZXMuXG4gICAgICAgICRzY29wZS5xdWFrZXMgPSAkc2NvcGUucXVha2VzLmNvbmNhdChxdWFrZXMubWFwKGZvcm1hdERhdGUpKTtcbiAgICAgICAgJHNjb3BlLiRhcHBseSgpO1xuXG4gICAgICAgIC8qIGVzbGludCBuZXctY2FwOjAgKi9cbiAgICAgICAgLy8gU29ydHMgdGhlIHRhYmxlIGJ5IHRoZSBtYWduaXR1ZGUgY29sdW1uXG4gICAgICAgICR0YWJsZS5EYXRhVGFibGUoKVxuICAgICAgICAgIC5jb2x1bW4oJzI6dmlzaWJsZScpXG4gICAgICAgICAgLm9yZGVyKCdkZXNjJylcbiAgICAgICAgICAuZHJhdygpO1xuICAgICAgfSk7XG5cbiAgICAkc2NvcGUuJG9uKCckZGVzdHJveScsICgpID0+IHtcbiAgICAgIHF1YWtlc1N0cmVhbS5kaXNwb3NlKCk7XG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIHJlc3RyaWN0OiAnRScsXG4gICAgdGVtcGxhdGU6IGBcbiAgICAgIDxkaXY+XG4gICAgICAgIDx0YWJsZSBkYXRhdGFibGU9XCJuZ1wiIGNsYXNzPVwidGFibGUgdGFibGUtc3RyaXBlZCB0YWJsZS1ob3ZlclwiPlxuICAgICAgICAgIDx0aGVhZD5cbiAgICAgICAgICAgIDx0cj5cbiAgICAgICAgICAgICAgPHRoPkxvY2F0aW9uPC90aD5cbiAgICAgICAgICAgICAgPHRoPlRpbWU8L3RoPlxuICAgICAgICAgICAgICA8dGg+TWFnbml0dWRlPC90aD5cbiAgICAgICAgICAgICAgPHRoPjwvdGg+XG4gICAgICAgICAgICA8L3RyPlxuICAgICAgICAgIDwvdGhlYWQ+XG4gICAgICAgICAgPHRib2R5PlxuICAgICAgICAgICAgPHRyIG5nLXJlcGVhdD1cInF1YWtlIGluIHF1YWtlc1wiPlxuICAgICAgICAgICAgICA8dGQ+e3txdWFrZS5wbGFjZX19PC90ZD5cbiAgICAgICAgICAgICAgPHRkPnt7cXVha2UudGltZX19PC90ZD5cbiAgICAgICAgICAgICAgPHRkPnt7cXVha2UubWFnfX08L3RkPlxuICAgICAgICAgICAgICA8dGQ+PGEgaHJlZj1cInt7cXVha2UudXJsfX1cIiB0YXJnZXQ9XCJfYmxhbmtcIj5Nb3JlIGRldGFpbHM8L2E+PC90ZD5cbiAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgPC90Ym9keT5cbiAgICAgICAgPC90YWJsZT5cbiAgICAgIDwvZGl2PlxuICAgIGAsXG4gICAgc2NvcGU6IHNjb3BlLFxuICAgIGxpbms6IGxpbmtcbiAgfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZGF0YXRhYmxlO1xuIiwiZXhwb3J0IGNvbnN0IEZFVENIX0lOVEVSVkFMID0gNTAwMDsgLy8xODAwZSszOyAvLyBldmVyeSBoYWxmIGhvdXJcblxuZXhwb3J0IGNvbnN0IFFVQUtFX1VSTCA9IChcbiAgLy8nLy9lYXJ0aHF1YWtlLnVzZ3MuZ292L2VhcnRocXVha2VzL2ZlZWQvdjEuMC9zdW1tYXJ5L2FsbF9kYXkuZ2VvanNvbidcbiAgJ2FsbF9kYXkuZ2VvanNvbnAnXG4pO1xuIiwiaW1wb3J0IHsgRkVUQ0hfSU5URVJWQUwgfSBmcm9tICcuLi9zZXR0aW5ncyc7XG5cbi8qKlxuKiBAbmdkb2MgZGlyZWN0aXZlXG4qIEBuYW1lIGRhc2hib2FyZC5kaXJlY3RpdmU6bWV0YWRhdGFJbmZvXG4qIEBkZXNjcmlwdGlvblxuKiBEZXNjcmlwdGlvbiBvZiB0aGUgbWV0YWRhdGFJbmZvIGRpcmVjdGl2ZS5cbiovXG5NZXRhZGF0YUluZm9Db250cm9sbGVyLiRpbmplY3QgPSBbXG4gICckdGltZW91dCcsXG4gICckaW50ZXJ2YWwnLFxuICAnJGZpbHRlcicsXG4gICdxdWFrZXNTZXJ2aWNlJ1xuXTtcbmZ1bmN0aW9uIE1ldGFkYXRhSW5mb0NvbnRyb2xsZXIoJHRpbWVvdXQsICRpbnRlcnZhbCwgJGZpbHRlciwgcXVha2VzU2VydmljZSl7XG4gIGxldCBvbk1ldGFkYXRhVXBkYXRlO1xuXG4gIHRoaXMuJG9uSW5pdCA9ICgpID0+IHtcbiAgICBjb25zdCBxdWFrZVN0cmVhbSA9IHF1YWtlc1NlcnZpY2UuZ2V0U3RyZWFtTWV0YWRhdGEoKTtcbiAgICBjb25zdCBkYXRlRmlsdGVyID0gJGZpbHRlcignZGF0ZScpO1xuICAgIGxldCBjb3VudGRvd25Qcm9taXNlO1xuXG4gICAgb25NZXRhZGF0YVVwZGF0ZSA9IHF1YWtlU3RyZWFtLnN1YnNjcmliZSgobWV0YWRhdGEpID0+IHtcbiAgICAgIC8vIFdlIG11c3QgdXNlIGEgJHRpbWVvdXQgaGVyZSB0byBob29rIGludG8gdGhlIEFuZ3VsYXIgZGlnZXN0IGN5Y2xlXG4gICAgICAkdGltZW91dCgoKSA9PiB7XG4gICAgICAgIHRoaXMubGFzdFVwZGF0ZVRpbWUgPSBkYXRlRmlsdGVyKFxuICAgICAgICAgIG1ldGFkYXRhLmdlbmVyYXRlZCxcbiAgICAgICAgICAnTU1NIGRkLCB5eXl5IC0gSEg6bW0gVVRDWidcbiAgICAgICAgKTtcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoY291bnRkb3duUHJvbWlzZSl7XG4gICAgICAgIHRoaXMudXBkYXRlQ291bnRkb3duID0gJzAwOjAwOjAwJztcbiAgICAgICAgJGludGVydmFsLmNhbmNlbChjb3VudGRvd25Qcm9taXNlKTtcbiAgICAgIH1cblxuICAgICAgY291bnRkb3duUHJvbWlzZSA9ICRpbnRlcnZhbCgodGlja1ZhbHVlKSA9PiB7XG4gICAgICAgIC8vdGhpcy51cGRhdGVDb3VudGRvd24gPSAoRkVUQ0hfSU5URVJWQUwgLyAxMDAwKSAtIHRpY2tWYWx1ZTtcbiAgICAgICAgdGhpcy51cGRhdGVDb3VudGRvd24gPSBkYXRlRmlsdGVyKFxuICAgICAgICAgIEZFVENIX0lOVEVSVkFMIC0gdGlja1ZhbHVlICogMTAwMCxcbiAgICAgICAgICAnSEg6bW06c3MnLFxuICAgICAgICAgICcrMDAwJ1xuICAgICAgICApO1xuICAgICAgfSwgMTAwMCk7XG5cbiAgICB9KTtcbiAgfTtcblxuICB0aGlzLiRvbkRlc3Ryb3kgPSAoKSA9PiB7XG4gICAgb25NZXRhZGF0YVVwZGF0ZS5kaXNwb3NlKCk7XG4gIH07XG59XG5cbmNvbnN0IG1ldGFkYXRhSW5mbyA9IHtcbiAgdGVtcGxhdGU6IGBcbiAgICA8c3BhbiBuZy1zaG93PVwibWV0YWRhdGFJbmZvLmxhc3RVcGRhdGVUaW1lXCI+XG4gICAgICA8c3Ryb25nPkxhc3QgdXBkYXRlOiA8L3N0cm9uZz57e21ldGFkYXRhSW5mby5sYXN0VXBkYXRlVGltZX19XG4gICAgICAgLSA8c3Ryb25nPk5leHQgdXBkYXRlPC9zdHJvbmc+OiB7e21ldGFkYXRhSW5mby51cGRhdGVDb3VudGRvd259fVxuICAgIDwvc3Bhbj5cbiAgYCxcbiAgY29udHJvbGxlcjogTWV0YWRhdGFJbmZvQ29udHJvbGxlcixcbiAgY29udHJvbGxlckFzOiAnbWV0YWRhdGFJbmZvJyxcbiAgYmluZGluZ3M6IHt9XG59O1xuXG5leHBvcnQgZGVmYXVsdCBtZXRhZGF0YUluZm87XG4iLCJpbXBvcnQgeyBGRVRDSF9JTlRFUlZBTCwgUVVBS0VfVVJMIH0gZnJvbSAnLi4vc2V0dGluZ3MnO1xuXG5xdWFrZXNTZXJ2aWNlLiRpbmplY3QgPSBbJ1J4J107XG5mdW5jdGlvbiBxdWFrZXNTZXJ2aWNlKFJ4KXtcblxuICBjb25zdCBqc29uU3RyZWFtID0gKCkgPT4ge1xuICAgIHJldHVybiBSeC5ET00uanNvbnBSZXF1ZXN0KHtcbiAgICAgIHVybDogUVVBS0VfVVJMLFxuICAgICAganNvbnBDYWxsYmFjazogJ2VxZmVlZF9jYWxsYmFjaydcbiAgICB9KTtcbiAgfTtcblxuICBjb25zdCBxdWFrZVN0cmVhbSA9IFJ4Lk9ic2VydmFibGVcbiAgICAgIC5pbnRlcnZhbChGRVRDSF9JTlRFUlZBTClcbiAgICAgIC5zdGFydFdpdGgoMSlcbiAgICAgIC5mbGF0TWFwKCgpID0+IGpzb25TdHJlYW0oKSk7XG5cbiAgZnVuY3Rpb24gZ2V0U3RyZWFtTWV0YWRhdGEoKXtcbiAgICByZXR1cm4gcXVha2VTdHJlYW1cbiAgICAgIC5mbGF0TWFwKChyZXN1bHQpID0+IHtcbiAgICAgICAgcmV0dXJuIFJ4Lk9ic2VydmFibGUucmV0dXJuKHJlc3VsdC5yZXNwb25zZS5tZXRhZGF0YSk7XG4gICAgICAgIC8vcmV0dXJuIFJ4Lk9ic2VydmFibGUucmV0dXJuKHsgZ2VuZXJhdGVkOiBEYXRlLm5vdygpIH0pO1xuICAgICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBnZXRRdWFrZXNTdHJlYW0oKXtcbiAgICByZXR1cm4gcXVha2VTdHJlYW1cbiAgICAgIC5mbGF0TWFwKChyZXN1bHQpID0+IHtcbiAgICAgICAgcmV0dXJuIFJ4Lk9ic2VydmFibGUuZnJvbShyZXN1bHQucmVzcG9uc2UuZmVhdHVyZXMpO1xuICAgICAgfSlcbiAgICAgIC5kaXN0aW5jdCgoZmVhdHVyZSkgPT4ge1xuICAgICAgICByZXR1cm4gZmVhdHVyZS5wcm9wZXJ0aWVzLmNvZGU7XG4gICAgICB9KVxuICAgICAgLm1hcCgoZmVhdHVyZSkgPT4ge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGxhdDogZmVhdHVyZS5nZW9tZXRyeS5jb29yZGluYXRlc1sxXSxcbiAgICAgICAgICBsbmc6IGZlYXR1cmUuZ2VvbWV0cnkuY29vcmRpbmF0ZXNbMF0sXG4gICAgICAgICAgbWFnOiBmZWF0dXJlLnByb3BlcnRpZXMubWFnLFxuICAgICAgICAgIGNvZGU6IGZlYXR1cmUucHJvcGVydGllcy5jb2RlLFxuICAgICAgICAgIHBsYWNlOiBmZWF0dXJlLnByb3BlcnRpZXMucGxhY2UsXG4gICAgICAgICAgdXJsOiBmZWF0dXJlLnByb3BlcnRpZXMudXJsLFxuICAgICAgICAgIHRpbWU6IGZlYXR1cmUucHJvcGVydGllcy50aW1lLFxuICAgICAgICAgIHR6OiBmZWF0dXJlLnByb3BlcnRpZXMudHpcbiAgICAgICAgfTtcbiAgICAgIH0pXG4gICAgICAuZmlsdGVyKChxdWFrZSkgPT4ge1xuICAgICAgICByZXR1cm4gcXVha2UubWFnID49IDE7XG4gICAgICB9KTtcbiAgfTtcblxuICByZXR1cm4ge1xuICAgIGdldFF1YWtlc1N0cmVhbSxcbiAgICBnZXRTdHJlYW1NZXRhZGF0YVxuICB9O1xufVxuXG5leHBvcnQgZGVmYXVsdCBxdWFrZXNTZXJ2aWNlO1xuIiwiaW1wb3J0IGFuZ3VsYXIgZnJvbSAnYW5ndWxhcic7XG5cbmltcG9ydCBtYXBDb21wb25lbnQgZnJvbSAnLi9tYXAuY29tcG9uZW50JztcbmltcG9ydCB2aWV3U2VsZWN0b3IgZnJvbSAnLi92aWV3LXNlbGVjdG9yLmNvbXBvbmVudCc7XG5pbXBvcnQgZGF0YXRhYmxlIGZyb20gJy4vZGF0YXRhYmxlLmNvbXBvbmVudCc7XG5pbXBvcnQgbWV0YWRhdGFJbmZvIGZyb20gJy4vbWV0YWRhdGEtaW5mby5jb21wb25lbnQnO1xuaW1wb3J0IHF1YWtlc1NlcnZpY2UgZnJvbSAnLi9xdWFrZXMuc2VydmljZSc7XG5cbmNvbnN0IGRhc2hib2FyZCA9IGFuZ3VsYXIubW9kdWxlKCdkYXNoYm9hcmQnLCBbJ2RhdGF0YWJsZXMnXSlcbiAgLmZhY3RvcnkoJ3F1YWtlc1NlcnZpY2UnLCBxdWFrZXNTZXJ2aWNlKVxuICAuY29tcG9uZW50KCdtYXAnLCBtYXBDb21wb25lbnQpXG4gIC5jb21wb25lbnQoJ3ZpZXdTZWxlY3RvcicsIHZpZXdTZWxlY3RvcilcbiAgLmNvbXBvbmVudCgnbWV0YWRhdGFJbmZvJywgbWV0YWRhdGFJbmZvKVxuICAuZGlyZWN0aXZlKCdkYXRhdGFibGUnLCBkYXRhdGFibGUpXG4gIC5uYW1lO1xuXG5leHBvcnQgZGVmYXVsdCBkYXNoYm9hcmQ7XG4iLCJpbXBvcnQgYW5ndWxhciBmcm9tICdhbmd1bGFyJztcblxuLyoqXG4qIEBuZ2RvYyBvdmVydmlld1xuKiBAbmFtZSBzaGltc1xuKiBAZGVzY3JpcHRpb25cbiogRGVzY3JpcHRpb24gb2YgdGhlIHNoaW1zIG1vZHVsZS5cbiovXG5jb25zdCBzaGltcyA9IGFuZ3VsYXIubW9kdWxlKCdzaGltcycsIFtdKVxuICAudmFsdWUoJ2xlYWZsZXQnLCB3aW5kb3cuTClcbiAgLnZhbHVlKCdSeCcsIHdpbmRvdy5SeClcbiAgLnZhbHVlKCdqcXVlcnknLCB3aW5kb3cualF1ZXJ5KVxuICAubmFtZTtcblxuZXhwb3J0IGRlZmF1bHQgc2hpbXM7XG4iLCJpbXBvcnQgYW5ndWxhciBmcm9tICdhbmd1bGFyJztcblxuY29uc3QgdXRpbHMgPSBhbmd1bGFyLm1vZHVsZSgndXRpbHMnLCBbXSlcbiAgLm5hbWU7XG5cbmV4cG9ydCBkZWZhdWx0IHV0aWxzO1xuIiwiaW1wb3J0IGFuZ3VsYXIgZnJvbSAnYW5ndWxhcic7XG5cbmltcG9ydCBkYXNoYm9hcmQgZnJvbSAnLi9kYXNoYm9hcmQvZGFzaGJvYXJkJztcbmltcG9ydCBzaGltcyBmcm9tICcuL3NoaW1zL3NoaW1zJztcbmltcG9ydCB1dGlscyBmcm9tICcuL3V0aWxzL3V0aWxzJztcblxuY29uc3QgcXVha2VtYXAgPSBhbmd1bGFyLm1vZHVsZSgncXVha2VtYXAnLCBbXG4gICAgc2hpbXMsXG4gICAgdXRpbHMsXG4gICAgZGFzaGJvYXJkXG4gIF0pXG4gIC5uYW1lO1xuXG5hbmd1bGFyLmJvb3RzdHJhcChkb2N1bWVudCwgW3F1YWtlbWFwXSk7XG5cbmV4cG9ydCBkZWZhdWx0IHF1YWtlbWFwO1xuIl0sIm5hbWVzIjpbIkJlaGF2aW9yU3ViamVjdCIsIk1hcENvbnRyb2xsZXIiLCIkaW5qZWN0IiwiTCIsInF1YWtlc1NlcnZpY2UiLCJxdWFrZXNTdHJlYW0iLCIkb25Jbml0IiwibWFwIiwibWFya2VycyIsImNpcmNsZXMiLCJkcmF3UXVha2UiLCJxdWFrZSIsInBvcHVwRGF0YSIsInBsYWNlIiwiRGF0ZSIsInRpbWUiLCJ0b1VUQ1N0cmluZyIsIm1hZyIsImNvZGUiLCJjaXJjbGUiLCJsYXQiLCJsbmciLCJhZGRUbyIsIm1hcmtlciIsImJpbmRQb3B1cCIsInRpbGVMYXllciIsInNldFZpZXciLCJnZXRRdWFrZXNTdHJlYW0iLCJzdWJzY3JpYmUiLCIkb25EZXN0cm95IiwiZGlzcG9zZSIsIm1hcENvbXBvbmVudCIsInN0cm9uZ2VzdFNvRmFyIiwiYWNjIiwidmFsIiwibGF0ZXN0U29GYXIiLCJWaWV3U2VsZWN0b3JDb250cm9sbGVyIiwiJCIsIiRyYWRpb3MiLCJyYWRpb0NoYW5nZXMiLCJSeCIsIk9ic2VydmFibGUiLCJmcm9tRXZlbnQiLCJieVZhbHVlIiwiZXZlbnQiLCJ0YXJnZXQiLCJ2YWx1ZSIsImZpbHRlciIsIm1lcmdlIiwic2NhbiIsInNhbXBsZSIsInJhZGlvRmlsdGVyU3ViamVjdCIsInNraXAiLCJ2aWV3U2VsZWN0b3IiLCJkYXRhdGFibGUiLCIkdGltZW91dCIsIiRmaWx0ZXIiLCJzY29wZSIsImxpbmsiLCIkc2NvcGUiLCIkZWxlbWVudCIsIiR0YWJsZSIsImZpbmQiLCJxdWFrZXMiLCJkYXRlRmlsdGVyIiwiZm9ybWF0RGF0ZSIsIk9iamVjdCIsImFzc2lnbiIsIlN0cmluZyIsInR6IiwiYnVmZmVyV2l0aFRpbWUiLCJsZW5ndGgiLCJjb25jYXQiLCIkYXBwbHkiLCJEYXRhVGFibGUiLCJjb2x1bW4iLCJvcmRlciIsImRyYXciLCIkb24iLCJGRVRDSF9JTlRFUlZBTCIsIlFVQUtFX1VSTCIsIk1ldGFkYXRhSW5mb0NvbnRyb2xsZXIiLCIkaW50ZXJ2YWwiLCJvbk1ldGFkYXRhVXBkYXRlIiwicXVha2VTdHJlYW0iLCJnZXRTdHJlYW1NZXRhZGF0YSIsImNvdW50ZG93blByb21pc2UiLCJtZXRhZGF0YSIsImxhc3RVcGRhdGVUaW1lIiwiZ2VuZXJhdGVkIiwidXBkYXRlQ291bnRkb3duIiwiY2FuY2VsIiwidGlja1ZhbHVlIiwibWV0YWRhdGFJbmZvIiwianNvblN0cmVhbSIsIkRPTSIsImpzb25wUmVxdWVzdCIsImludGVydmFsIiwic3RhcnRXaXRoIiwiZmxhdE1hcCIsInJlc3VsdCIsInJldHVybiIsInJlc3BvbnNlIiwiZnJvbSIsImZlYXR1cmVzIiwiZGlzdGluY3QiLCJmZWF0dXJlIiwicHJvcGVydGllcyIsImdlb21ldHJ5IiwiY29vcmRpbmF0ZXMiLCJ1cmwiLCJkYXNoYm9hcmQiLCJhbmd1bGFyIiwibW9kdWxlIiwiZmFjdG9yeSIsImNvbXBvbmVudCIsImRpcmVjdGl2ZSIsIm5hbWUiLCJzaGltcyIsIndpbmRvdyIsImpRdWVyeSIsInV0aWxzIiwicXVha2VtYXAiLCJib290c3RyYXAiLCJkb2N1bWVudCJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFFQSx5QkFBZSxJQUFJQSxrQkFBSixFQUFmOztBQ0FBOzs7Ozs7O0FBT0FDLGNBQWNDLE9BQWQsR0FBd0IsQ0FBQyxTQUFELEVBQVksZUFBWixDQUF4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