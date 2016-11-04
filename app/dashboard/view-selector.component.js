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

    const onStrongest = quakesStream
      .scan(strongestSoFar)
      .sample(250)
      .subscribe((quake) => {
        strongest = _.clone(quake);
      });

    const onLatest = quakesStream
      .scan(latestSoFar)
      .sample(250)
      .subscribe((quake) => {
        latest = _.clone(quake);
      });

    const byValue = function(event){
      return this === event.target.value;
    }

    const $radios = $('[name="show-filter"]');
    const radioChanges = Rx.Observable.fromEvent($radios, 'change');

    const onMagFilter = radioChanges
      .filter(byValue, 'mag')
      .subscribe(() => {
        mapUtils
          .getMapReference()
          .setView([strongest.lat, strongest.lng], 7);
      });

    const onTimeFilter = radioChanges
      .filter(byValue, 'time')
      .subscribe(() => {
        mapUtils
          .getMapReference()
          .setView([latest.lat, latest.lng], 7);
      });
  };

  this.$onDestroy = () => {
    // Disposes all subscriptions
    onStrongest.dispose();
    onLatest.dispose();
    onMagFilter.dispose();
    onTimeFilter.dispose();
  };
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
