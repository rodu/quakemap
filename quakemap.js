/* global Rx:true, L:true */
(function(Rx){
  'use strict';

  const QUAKE_URL = (
    //'http://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojsonp'
    'http://localhost:8080/all_day.geojsonp'
  );
  const map = L.map('map').setView([42.6117094, 13.1069955], 10);

  L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png').addTo(map);

  Rx.DOM.jsonpRequest({
    url: QUAKE_URL,
    jsonpCallback: 'eqfeed_callback'
  })
  .flatMap((result) => {
    return Rx.Observable.from(result.response.features);
  })
  .map((quake) => {
    const properties = quake.properties;

    return {
      lat: quake.geometry.coordinates[1],
      lng: quake.geometry.coordinates[0],
      mag: properties.mag,
      place: properties.place,
      time: new Date(properties.time).toUTCString()
    };
  })
  .subscribe((quake) => {
    const popupData = '' +
      '<h3>' + quake.place + '</h3>' +
      '<ul>' +
        '<li><strong>Time:</strong> ' + quake.time + '</li>' +
        '<li><strong>Magnitude:</strong> ' + quake.mag + '</li>' +
      '</ul>';

    L.circle([quake.lat, quake.lng], quake.mag * 1000).addTo(map);

    L.marker([quake.lat, quake.lng])
      .addTo(map)
      .bindPopup(popupData);
  });

})(Rx);
