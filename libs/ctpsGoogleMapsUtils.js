// ctpsGoogleMapsUtils.js - Library of Google Maps utility functions used at CTPS.
// ===> N.B. This library *requires* that the Google Maps JS API library is loaded before it!
//
// Author: B. Krepp
// Date: March 12, 2019
(function() {
    // Internals of the library (if any) go here
    //
	// *** Public API of the library begins here. ***
	return ctpsGoogleMapsUtils = {
		version : "1.0",
        //
        drawPolylineFeature : function(lineFeature, gMap, style) {
            var gmPolyline = {}, aFeatCoords = [], point = {}, aAllPoints = [];
            var i, j;
            if (lineFeature.geometry.type === 'MultiLineString') {
                // console.log('Rendering MultiLintString feature.');
                aFeatCoords = lineFeature.geometry.coordinates;
                for (i = 0; i < aFeatCoords.length; i++) {
                    aAllPoints = [];
                    // Render each LineString in the MultiLineString individually
                    for (j = 0; j < aFeatCoords[i].length; j++) {
                        aCoord = aFeatCoords[i][j];
                        point = new google.maps.LatLng({ 'lat': aCoord[1], 'lng': aCoord[0] });
                        aAllPoints.push(point);
                    } // for j in aFeatCoords[i]
                    gmPolyline = new google.maps.Polyline({ path            : aAllPoints,
                                                            map             : gMap,
                                                            strokeColor     : style.strokeColor,
                                                            strokeOpacity   : style.strokeOpacity,
                                                            strokeWeight    : style.strokeWeight });
                } // for i in aFeatureCoords.length
            } else if (lineFeature.geometry.type === 'LineString') {
                // console.log('Rendering LineString feature.');
                aFeatCoords = lineFeature.geometry.coordinates;
                for (i = 0; i < aFeatCoords.length; i++ ) {
                    aCoord = aFeatCoords[i];
                    point = new google.maps.LatLng({ 'lat': aCoord[1], 'lng': aCoord[0] });
                    aAllPoints.push(point);
                } // for i in aFeatureCoords.length
                gmPolyline = new google.maps.Polyline({ path            : aAllPoints,
                                                        map             : gMap,
                                                        strokeColor     : style.strokeColor,
                                                        strokeOpacity   : style.strokeOpacity,
                                                        strokeWeight    : style.strokeWeight });
            } else {
                console.log('Feature has unrecognized geometry type: ' + lineFeature.geometry.type);
                return;
            }
        }, //drawPolylineFeature()
        //
        drawPolygonFeature : function (polygonFeature, gMap, style) {
            var i, j, k, l, name, pt, part, path, paths;
            name = polygonFeature.properties['name'];
            if (polygonFeature.geometry.type == 'MultiPolygon' ) {
                paths = [];
                for (j = 0; j < polygonFeature.geometry.coordinates.length; j++) {
                    part = polygonFeature.geometry.coordinates[j];
                    path = [];
                    for (k = 0; k < polygonFeature.geometry.coordinates[j].length; k++) {
                        for (l = 0; l < polygonFeature.geometry.coordinates[j][k].length; l++) {
                            pt = { lng : polygonFeature.geometry.coordinates[j][k][l][0],
                                   lat : polygonFeature.geometry.coordinates[j][k][l][1] };
                            path.push(pt);
                        }
                        paths.push(path);
                    } 
                } 
                polygon = new google.maps.Polygon({
                    paths           : paths,
                    strokeColor     : style.strokeColor,
                    strokeOpacity   : style.strokeOpacity,
                    strokeWeight    : style.strokeWeight,
                    fillColor       : style.fillColor,
                    fillOpacity     : style.fillOpacity                            
                });               
                polygon.setMap(gMap);                
            } else {
            // geometry.type == 'Polygon'
                path = [];
                for (j = 0; j < polygonFeature.geometry.coordinates[0].length; j++) {
                    pt = { lng : polygonFeature.geometry.coordinates[0][j][0],
                           lat : polygonFeature.geometry.coordinates[0][j][1] };
                    path.push(pt);
                } 
                polygon = new google.maps.Polygon({
                    paths           : path,
                    strokeColor     : style.strokeColor,
                    strokeOpacity   : style.strokeOpacity,
                    strokeWeight    : style.strokeWeight,
                    fillColor       : style.fillColor,
                    fillOpacity     : style.fillOpacity                            
                });
                polygon.setMap(gMap);
            } // end-if over geometry.type    
        } // drawPolygonFeature())
	}; // return value (i.e., API object)
})();