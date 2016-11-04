import angular from 'angular';

quakesService.$inject = ['Rx'];
function quakesService(Rx){

  function loadQuakes() {
    return Rx.Observable.just('one');
  };

  return {
    loadQuakes
  }
}

export default quakesService;
