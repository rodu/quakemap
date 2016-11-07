import { FETCH_INTERVAL, QUAKE_URL } from '../settings';

quakesService.$inject = ['Rx'];
function quakesService(Rx){

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

  function getStreamMetadata(){
    return quakeStream
      .flatMap((result) => {
        return Rx.Observable.return(result.response.metadata);
        //return Rx.Observable.return({ generated: Date.now() });
      });
  }

  function getQuakesStream(){
    return quakeStream
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
          code: feature.properties.code,
          place: feature.properties.place,
          url: feature.properties.url,
          time: feature.properties.time,
          tz: feature.properties.tz
        };
      })
      .filter((quake) => {
        return quake.mag >= 1;
      });
  };

  return {
    getQuakesStream,
    getStreamMetadata
  };
}

export default quakesService;
