/**
* @ngdoc directive
* @name dashboard.directive:viewSelector
* @description
* Description of the viewSelector directive.
*/
viewSelectorController.$inject = [];
function viewSelectorController(){
  this.$onInit = () => {

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
