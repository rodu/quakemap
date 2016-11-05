import { strongestSoFar, latestSoFar } from '../utils/quakesDataUtils';
import radioFilterSubject from './radioFilterSubject';

/**
* @ngdoc directive
* @name dashboard.directive:viewSelector
* @description
* Description of the viewSelector directive.
*/
ViewSelectorController.$inject = [
  'quakesService',
  'lodash',
  'jquery'
];
function ViewSelectorController(quakesService, _, $){

  this.$onInit = () => {
    const quakesStream = quakesService.getQuakesStream();

    const $radios = $('[name="show-filter"]');
    const radioChanges = Rx.Observable.fromEvent($radios, 'change');

    const byValue = function(event){
      /* eslint no-invalid-this:0 */
      return this === event.target.value;
    };

    /*radioChanges
      .filter(byValue, 'mag')
      .merge(quakesStream)
      .scan(strongestSoFar)
      .sample(250)
      .subscribe(radioFilterSubject);

    radioChanges
      .filter(byValue, 'time')
      .merge(quakesStream)
      .scan(latestSoFar)
      .sample(250)
      .subscribe(radioFilterSubject);*/

    radioChanges
      .filter(byValue, 'mag')
      .subscribe(() => {
        quakesStream
          .scan(strongestSoFar)
          .sample(250)
          .subscribe(radioFilterSubject);
      });

    radioChanges
      .filter(byValue, 'time')
      .subscribe(() => {
        quakesStream
          .scan(latestSoFar)
          .sample(250)
          .subscribe(radioFilterSubject);
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
          <input checked="true"
            type="radio"
            name="show-filter"
            value="mag"> Strongest
        </label>
        <label class="radio-inline">
          <input type="radio" name="show-filter" value="time"> Latest
        </label>
      </form>
    </div>
  `,
  controller: ViewSelectorController,
  controllerAs: 'viewSelector',
  bindings: {}
};

export default viewSelector;
