import { strongestSoFar } from '../utils/quakesDataUtils';

/**
* @ngdoc directive
* @name dashboard.directive:map
* @description
* Description of the map directive.
*/

MapController.$inject = ['leaflet', 'quakesService', 'mapUtils'];
function MapController(L, quakesService, mapUtils){
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
  const setViewOnStrongest = (quake) => {
    map.setView([quake.lat, quake.lng], 7);
  };

  this.$onInit = () => {
    map = mapUtils.shareMapReference(L.map('map'));
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

    quakesStream
      .scan(strongestSoFar)
      .sample(250)
      .subscribe(setViewOnStrongest);

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


