/* global Rx:true, L:true */
(function(Rx){
  'use strict';

  const QUAKE_URL = (
    //'http://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojsonp'
    'http://localhost:8080/all_day.geojsonp'
  );
  const map = L.map('map').setView([42.6117094, 13.1069955], 7);

  L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png').addTo(map);

  Rx.DOM.jsonpRequest({
    url: QUAKE_URL,
    jsonpCallback: 'eqfeed_callback'
  })
  .flatMap((result) => {
    return Rx.Observable.from(result.response.features);
  })
  .map((quake) => {
    return {
      lat: quake.geometry.coordinates[1],
      lng: quake.geometry.coordinates[0],
      size: quake.properties.mag * 1000
    };
  })
  .subscribe((quake) => {
    L.circle([quake.lat, quake.lng], quake.size).addTo(map);
  });

})(Rx);
