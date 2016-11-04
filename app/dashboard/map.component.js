/**
* @ngdoc directive
* @name dashboard.directive:map
* @description
* Description of the map directive.
*/

MapController.$inject = ['leaflet', 'quakesService', 'lodash'];
function MapController(L, quakesService, _){
  let map;
  let markers;
  let circles;
  let strongestQuake;

  const drawQuake = (quake) => {
    const popupData = '' +
      '<h3>' + quake.place + '</h3>' +
      '<ul>' +
        '<li><strong>Time:</strong> ' +
          new Date(quake.time).toUTCString() +
        '</li>' +
        '<li><strong>Magnitude:</strong> ' + quake.mag + '</li>' +
      '</ul>';

    circles[quake.code] = L.circle(
      [quake.lat, quake.lng],
      quake.mag * 1000
    ).addTo(map);

    markers[quake.code] = L.marker([quake.lat, quake.lng])
      .addTo(map)
      .bindPopup(popupData);
  };

  // Waits for a whole stream of quakes to come in before setting the map on the
  // coordinates of the strongest quake.
  const setViewOnStrongest = _.debounce((quake) => {
    map.setView([quake.lat, quake.lng], 7);
  }, 250);

  const strongestSoFar = (quake) => {
    if (!strongestQuake){
      strongestQuake = quake;
      return;
    }

    if (quake.mag > strongestQuake.mag){
      setViewOnStrongest(quake);
      strongestQuake = quake;
    }
  };

  this.$onInit = () => {
    map = L.map('map');
    markers = {};
    circles = {};

    L.tileLayer('//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: `
        &copy; <a href="http://osm.org/copyright">OpenStreetMap</a>
        contributors
      `
    }).addTo(map);

    map.setView([0, 0], 7);

    const quakesStream = quakesService.getQuakesStream();

    quakesStream.subscribe(strongestSoFar);
    quakesStream.subscribe(drawQuake);
  };
}

const mapComponent = {
  template: '<div id="map">map</div>',
  controller: MapController,
  controllerAs: 'map',
  bindings: {}
};

export default mapComponent;


