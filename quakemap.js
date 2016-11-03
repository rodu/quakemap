/* global jQuery:true, L:true */
(function($){
  'use strict';

  const FETCH_INTERVAL = 1800e+3; // every half hour

  const QUAKE_URL = (
    '//earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson'
    //'http://localhost:8080/all_day.geojson'
  );
  const map = L.map('map');
  const markers = {};
  const circles = {};

  //map.setView([0, 0], 7);

  L.tileLayer('//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  const mapFeatures = (feature) => {
    return {
      lat: feature.geometry.coordinates[1],
      lng: feature.geometry.coordinates[0],
      mag: feature.properties.mag,
      place: feature.properties.place,
      time: feature.properties.time,
      code: feature.properties.code
    };
  };

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

  const removeQuake = (quake) => {
    markers[quake.code].remove();
    circles[quake.code].remove();

    delete markers[quake.code];
    delete circles[quake.code];
  };

  const findStrongest = (strongest, current) => {
    return strongest.mag > current.mag ? strongest : current;
  };

  const randomId = () => {
    return '?id=' + Math.random();
  };

  let lastQuakes;
  (function renderQuakes(){

    $.getJSON(QUAKE_URL + randomId()).done((data) => {
      const quakes = data.features.map(mapFeatures);
      const strongest = quakes.reduce(findStrongest, { mag: 0 });

      // Centres the map on the strongest quake
      map.setView([strongest.lat, strongest.lng], 7);

      // Adds any new quake to the map
      _.differenceWith(quakes, lastQuakes, _.isEqual).forEach(drawQuake);

      // Removes outdated quakes from the map
      _.differenceWith(lastQuakes, quakes, _.isEqual).forEach(removeQuake);

      // Keeps a copy of latest quakes to compare with next update
      lastQuakes = _.clone(quakes);

      // Schedules next update
      window.setTimeout(renderQuakes, FETCH_INTERVAL);
    });
  })();

  /*const jsonStream = () => {
    return Rx.DOM.jsonpRequest({
      url: QUAKE_URL,
      jsonpCallback: 'eqfeed_callback'
    });
  };

  /*const quakeStream = Rx.Observable
    .interval(FETCH_INTERVAL)
    .startWith(1)
    .flatMap(() => jsonStream());

  const quakes = Rx.DOM.jsonpRequest({
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
      time: properties.time
    };
  });

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
*/
})(jQuery);
