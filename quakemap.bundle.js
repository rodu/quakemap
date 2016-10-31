'use strict';

/* global Rx:true, L:true */
(function (Rx) {
  'use strict';

  var QUAKE_URL = 'http://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojsonp'
  //'http://localhost:8080/all_day.geojsonp'
  ;
  var map = L.map('map');

  L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png').addTo(map);

  var quakes = Rx.DOM.jsonpRequest({
    url: QUAKE_URL,
    jsonpCallback: 'eqfeed_callback'
  }).flatMap(function (result) {
    return Rx.Observable.from(result.response.features);
  }).map(function (quake) {
    var properties = quake.properties;

    return {
      lat: quake.geometry.coordinates[1],
      lng: quake.geometry.coordinates[0],
      mag: properties.mag,
      place: properties.place,
      time: properties.time
    };
  });

  quakes.subscribe(function (quake) {
    var popupData = '' + '<h3>' + quake.place + '</h3>' + '<ul>' + '<li><strong>Time:</strong> ' + new Date(quake.time).toUTCString() + '</li>' + '<li><strong>Magnitude:</strong> ' + quake.mag + '</li>' + '</ul>';

    L.circle([quake.lat, quake.lng], quake.mag * 1000).addTo(map);

    L.marker([quake.lat, quake.lng]).addTo(map).bindPopup(popupData);
  });

  function findMaxByProp(prop) {
    return function (x, y) {
      return x[prop] > y[prop] ? 1 : x[prop] < y[prop] ? -1 : 0;
    };
  }

  function centerMapByProp(prop) {
    quakes.max(findMaxByProp(prop)).subscribe(function (quake) {
      return map.setView([quake.lat, quake.lng], 7);
    });
  }

  function getFilterRadios() {
    return document.querySelectorAll('[name="show-filter"]');
  }

  Rx.Observable.fromEvent(getFilterRadios(), 'change').subscribe(function (event) {
    return centerMapByProp(event.target.value);
  });

  // Let's centre on the currently selected filter
  Rx.Observable.from(getFilterRadios()).filter(function (radio) {
    return radio.checked;
  }).subscribe(function (radio) {
    return centerMapByProp(radio.value);
  });
})(Rx);
