/**
* @ngdoc directive
* @name dashboard.directive:metadataInfo
* @description
* Description of the metadataInfo directive.
*/
MetadataInfoController.$inject = ['$timeout', '$filter', 'quakesService'];
function MetadataInfoController($timeout, $filter, quakesService){
  let onMetadataUpdate;

  this.$onInit = () => {
    const quakeStream = quakesService.getStreamMetadata();
    const dateFilter = $filter('date');

    onMetadataUpdate = quakeStream.subscribe((metadata) => {
      // We must use a $timeout here to hook into the Angular digest cycle
      $timeout(() => {
        this.lastUpdateTime = dateFilter(
          metadata.generated,
          'MMM dd, yyyy - HH:mm UTCZ'
        );
      });
    });
  };

  this.$onDestroy = () => {
    onMetadataUpdate.dispose();
  };
}

const metadataInfo = {
  template: `
    <span><strong>Last update: </strong>{{metadataInfo.lastUpdateTime}}</span>
  `,
  controller: MetadataInfoController,
  controllerAs: 'metadataInfo',
  bindings: {}
};

export default metadataInfo;
