import radioFilterSubject from './radioFilterSubject';

/**
* @ngdoc directive
* @name dashboard.directive:map
* @description
* Description of the map directive.
*/

MapController.$inject = ['leaflet', 'quakesService'];
function MapController(L, quakesService){
  let quakesStream;

  this.$onInit = () => {
    let map = L.map('map');
    let markers = {};
    let circles = {};

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


    L.tileLayer('//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: `
        &copy; <a href="http://osm.org/copyright">OpenStreetMap</a>
        contributors
      `
    }).addTo(map);

    map.setView([0, 0], 7);

    quakesStream = quakesService
      .getQuakesStream()
      .subscribe(drawQuake);

    radioFilterSubject.subscribe((quake) => {
      if (quake){
        map.setView([quake.lat, quake.lng], 7);
      }
    });
  };

  this.$onDestroy = () => {
    quakesStream.dispose();
  };
}

const mapComponent = {
  template: '<div id="map">map</div>',
  controller: MapController,
  controllerAs: 'map',
  bindings: {}
};

export default mapComponent;


