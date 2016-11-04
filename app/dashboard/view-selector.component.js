import { strongestSoFar, latestSoFar } from '../utils/quakesDataUtils';

/**
* @ngdoc directive
* @name dashboard.directive:viewSelector
* @description
* Description of the viewSelector directive.
*/
viewSelectorController.$inject = [
  'quakesService',
  'lodash',
  'jquery',
  'mapUtils'
];
function viewSelectorController(quakesService, _, $, mapUtils){

  this.$onInit = () => {
    const quakesStream = quakesService.getQuakesStream();
    let strongest;
    let latest;

    quakesStream
      .scan(strongestSoFar)
      .sample(250)
      .subscribe((quake) => {
        strongest = _.clone(quake);
      });

    quakesStream
      .scan(latestSoFar)
      .sample(250)
      .subscribe((quake) => {
        latest = _.clone(quake);
      });

    $('[name="show-filter"]').on('change', (event) => {

      const map = mapUtils.getMapReference();

      switch(event.target.value){
        case 'mag':
          map.setView([strongest.lat, strongest.lng], 7);
        break;
        case 'time':
          map.setView([latest.lat, latest.lng], 7);
      }
    });
  };

  this.$onDestroy = () => {};
}

const viewSelector = {
  template: `
    <div class="show-filter">
      <form>
        <span class="filter-title"><strong>Show</strong></span>
        <label class="radio-inline">
          <input checked="true" type="radio" name="show-filter" value="mag"> Strongest
        </label>
        <label class="radio-inline">
          <input type="radio" name="show-filter" value="time"> Latest
        </label>
      </form>
    </div>
  `,
  controller: viewSelectorController,
  controllerAs: 'viewSelector',
  bindings: {}
};

export default viewSelector;
