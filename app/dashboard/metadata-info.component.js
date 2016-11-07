import { FETCH_INTERVAL } from '../settings';

/**
* @ngdoc directive
* @name dashboard.directive:metadataInfo
* @description
* Description of the metadataInfo directive.
*/
MetadataInfoController.$inject = [
  '$timeout',
  '$interval',
  '$filter',
  'quakesService'
];
function MetadataInfoController($timeout, $interval, $filter, quakesService){
  let onMetadataUpdate;

  this.$onInit = () => {
    const quakeStream = quakesService.getStreamMetadata();
    const dateFilter = $filter('date');
    let countdownPromise;

    onMetadataUpdate = quakeStream.subscribe((metadata) => {
      // We must use a $timeout here to hook into the Angular digest cycle
      $timeout(() => {
        this.lastUpdateTime = dateFilter(
          metadata.generated,
          'MMM dd, yyyy - HH:mm UTCZ'
        );
      });

      if (countdownPromise){
        this.updateCountdown = '00:00:00';
        $interval.cancel(countdownPromise);
      }

      countdownPromise = $interval((tickValue) => {
        //this.updateCountdown = (FETCH_INTERVAL / 1000) - tickValue;
        this.updateCountdown = dateFilter(
          FETCH_INTERVAL - tickValue * 1000,
          'HH:mm:ss',
          '+000'
        );
      }, 1000);

    });
  };

  this.$onDestroy = () => {
    onMetadataUpdate.dispose();
  };
}

const metadataInfo = {
  template: `
    <span ng-show="metadataInfo.lastUpdateTime">
      <strong>Last update: </strong>{{metadataInfo.lastUpdateTime}}
       - <strong>Next update</strong>: {{metadataInfo.updateCountdown}}
    </span>
  `,
  controller: MetadataInfoController,
  controllerAs: 'metadataInfo',
  bindings: {}
};

export default metadataInfo;
