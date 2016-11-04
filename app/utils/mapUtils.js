/**
* @ngdoc service
* @name utils.service:mapUtils
* @description
* Description of the mapUtils service.
*/
class MapUtils {

  constructor() {
    this.map = null;
  }

  shareMapReference(map){
    return this.map = map;
  }

  getMapReference(){
    return this.map;
  }

}

export default MapUtils;
