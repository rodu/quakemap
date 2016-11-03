/* global Rx:true, L:true */
(function(Rx){
  'use strict';

  const FETCH_INTERVAL = 5000;

  const QUAKE_URL = (
    //'//earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojsonp'
    'http://localhost:8080/all_day.geojsonp'
  );
  const map = L.map('map');

  //map.setView([0, 0], 7);

  L.tileLayer('//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  const jsonStream = () => {
    return Rx.DOM.jsonpRequest({
      url: QUAKE_URL,
      jsonpCallback: 'eqfeed_callback'
    });
  };

  const quakeStream = Rx.Observable
    .interval(FETCH_INTERVAL)
    .startWith(1)
    .flatMap(() => jsonStream());

  const quakeMap = (Observable) => {
    return Observable
      .flatMap((result) => {
        return Rx.Observable.from(result.response.features);
      })
      .distinct((feature) => {
        return feature.properties.code;
      })
      .map((feature) => {
        return {
          lat: feature.geometry.coordinates[1],
          lng: feature.geometry.coordinates[0],
          mag: feature.properties.mag,
          place: feature.properties.place,
          time: feature.properties.time
        };
      });
  };

  function findMaxByProp(prop){
    return (x, y) => (x[prop] > y[prop]) ? 1 : (x[prop] < y[prop]) ? -1 : 0;
  }

  quakeMap(jsonStream())
    .max(findMaxByProp('mag'))
    .subscribe((quake) => {
      map.setView([quake.lat, quake.lng], 7);
    });

  quakeMap(quakeStream).subscribe((quake) => {
    const popupData = '' +
      '<h3>' + quake.place + '</h3>' +
      '<ul>' +
        '<li><strong>Time:</strong> ' +
          new Date(quake.time).toUTCString() +
        '</li>' +
        '<li><strong>Magnitude:</strong> ' + quake.mag + '</li>' +
      '</ul>';

    L.circle([quake.lat, quake.lng], quake.mag * 1000).addTo(map);

    L.marker([quake.lat, quake.lng])
      .addTo(map)
      .bindPopup(popupData);
  });

  function centerMapByProp(prop){
    quakes
      .max(findMaxByProp(prop))
      .subscribe((quake) => map.setView([quake.lat, quake.lng], 7));
  }

  function getFilterRadios(){
    return document.querySelectorAll('[name="show-filter"]');
  }

  Rx.Observable.fromEvent(getFilterRadios(), 'change')
    .subscribe((event) => centerMapByProp(event.target.value));

  // Let's centre on the currently selected filter
  /*Rx.Observable.from(getFilterRadios())
    .filter((radio) => radio.checked)
    .subscribe((radio) => centerMapByProp(radio.value));
*/
})(Rx);
