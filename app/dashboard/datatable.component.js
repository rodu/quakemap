/**
* @ngdoc directive
* @name dashboard.directive:datatable
* @description
* Description of the datatable directive.
*/
datatable.$inject = ['$timeout', 'quakesService'];
function datatable($timeout, quakesService){

  const scope = {};

  function link($scope){
    $scope.quakes = [];

    const quakesStream = quakesService.getQuakesStream();

    const renderTable = (quakes) => {
      console.log(quakes);
      $scope.quakes = quakes;
    };

    quakesStream
      .bufferWithTime(500)
      .filter((value) => value.length)
      .subscribe((quakes) => {
        $scope.quakes = quakes;
        $scope.$apply();
      });

    $scope.$on('$destroy', () => {
      quakesStream.dispose();
    });
  }

  return {
    restrict: 'E',
    template: `
      <div>
        <table datatable="ng"
          dt-options="showCase.dtOptions"
          dt-columns="showCase.dtColumns"
          class="table table-striped table-hover">
          <thead>
            <tr>
              <th>Location</th>
              <th>Time</th>
              <th>Magnitude</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            <tr ng-repeat="quake in quakes">
              <td>{{quake.place}}</td>
              <td>{{quake.time}}</td>
              <td>{{quake.mag}}</td>
              <td>{{quake.link}}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `,
    scope: scope,
    link: link
  };
}

export default datatable;