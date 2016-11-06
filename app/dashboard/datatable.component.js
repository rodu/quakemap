/**
* @ngdoc directive
* @name dashboard.directive:datatable
* @description
* Description of the datatable directive.
*/
datatable.$inject = ['$timeout', '$filter', 'quakesService'];
function datatable($timeout, $filter, quakesService){

  const scope = {};

  function link($scope, $element){
    const $table = $element.find('table');
    $scope.quakes = [];

    const quakesStream = quakesService.getQuakesStream();

    const dateFilter = $filter('date');
    const formatDate = (quake) => {
      return Object.assign({}, quake, {
        time: dateFilter(
          quake.time,
          'MMM dd, yyyy - HH:mm UTCZ',
          String(quake.tz)
        )
      });
    };

    quakesStream
      .bufferWithTime(500)
      .filter((value) => value.length)
      .subscribe((quakes) => {
        // Subsequent data stream will bring in only the new quakes we don't yet
        // have, therefore we concat the new data to the existing ones.
        $scope.quakes = $scope.quakes.concat(quakes.map(formatDate));
        $scope.$apply();

        /* eslint new-cap:0 */
        // Sorts the table by the magnitude column
        $table.DataTable()
          .column('2:visible')
          .order('desc')
          .draw();
      });

    $scope.$on('$destroy', () => {
      quakesStream.dispose();
    });
  }

  return {
    restrict: 'E',
    template: `
      <div>
        <table datatable="ng" class="table table-striped table-hover">
          <thead>
            <tr>
              <th>Location</th>
              <th>Time</th>
              <th>Magnitude</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr ng-repeat="quake in quakes">
              <td>{{quake.place}}</td>
              <td>{{quake.time}}</td>
              <td>{{quake.mag}}</td>
              <td><a href="{{quake.url}}" target="_blank">More details</a></td>
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
