/**
* @ngdoc directive
* @name dashboard.directive:map
* @description
* Description of the map directive.
*/

MapController.$inject = ['leaflet'];
function MapController(L){
  let map;
  let markers;
  let circles;

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
  };
}

const mapComponent = {
  template: '<div id="map">map</div>',
  controller: MapController,
  controllerAs: 'map',
  bindings: {}
};

export default mapComponent;


