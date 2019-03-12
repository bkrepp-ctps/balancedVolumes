var geojsonURL = 'data/geojson/i93_and_sr3_complete.geojson';
// var csvWireFrame_sb_URL = 'data/wireframe/i93_sr3_sb_COMPLETE.csv';
// var csvWireFrame_nb_URL = 'data/wireframe/i93_sr3_nb_COMPLETE.csv';

var csvWireFrame_sb_URL = 'data/csv/join_i93_sr3_sb_wireframe_and_volumes.csv';
var csvWireFrame_nb_URL = 'data/csv/join_i93_sr3_nb_wireframe_and_volumes.csv';

// Global "database" of data read in from JSON and CSV files
var DATA = {};
// Global access to D3 visualization elements
VIZ = {};
// Google Maps map object
var map; 

$(document).ready(function() {
    var q = d3.queue()
                .defer(d3.json, geojsonURL)
                .defer(d3.csv, csvWireFrame_sb_URL)
                .defer(d3.csv, csvWireFrame_nb_URL)
                .awaitAll(initializeApp);
});

function initializeApp(error, results) {
    if (error != null) {
        alert("One or more requests to load data failed. Exiting application.");
        return;         
    }        
    var geojson = results[0];
    var sb_wireframe = results[1];
    var nb_wireframe = results[2];

    // Prep data loaded for use in app
    DATA.geojson = geojson;
    
    function cleanupCsvRec(rec) {
        rec.x1 = +rec.x1;
        rec.y1 = +rec.y1;
        rec.x2 = +rec.x2;
        rec.y2 = +rec.y2;    
        [2018, 2010].forEach(function(year) {
            rec['awdt_' + year] = +rec['awdt_' + year];
            rec['peak_' + year + '_6_to_7_am']  = +rec['peak_' + year + '_6_to_7_am'];
            rec['peak_' + year + '_7_to_8_am']  = +rec['peak_' + year + '_7_to_8_am'];
            rec['peak_' + year + '_8_to_9_am']  = +rec['peak_' + year + '_8_to_9_am'];
            rec['peak_' + year + '_9_to_10_am'] = +rec['peak_' + year + '_9_to_10_am'];
            rec['peak_' + year + '_3_to_4_pm']  = +rec['peak_' + year + '_3_to_4_pm'];
            rec['peak_' + year + '_4_to_5_pm']  = +rec['peak_' + year + '_4_to_5_pm'];
            rec['peak_' + year + '_5_to_6_pm']  = +rec['peak_' + year + '_5_to_6_pm'];
        });   
    }    
    sb_wireframe.forEach(cleanupCsvRec);
    DATA.sb_wireframe = sb_wireframe;
    nb_wireframe.forEach(cleanupCsvRec);   
    DATA.nb_wireframe = nb_wireframe;
    
    // Generate wireframe for southbound route
    VIZ.sb = generateSvgWireframe(DATA.sb_wireframe, 'sb_viz', 0 /* placeholder for now */);
    symbolizeSvgWireframe(VIZ.sb, 'awdt_2018');
    // Generate wireframe for northbound route
    VIZ.nb = generateSvgWireframe(DATA.nb_wireframe, 'nb_viz', 0 /* placeholder for now */);  
    symbolizeSvgWireframe(VIZ.nb, 'awdt_2018');    
    
    // Initialize Google Map
    initMap(DATA); // No need to pass DATA as parm, but doing so anyway     
} // initializeApp

function generateSvgWireframe(wireframe_data, div_id, year) {	
    var verticalPadding = 10;
    var width = 380;
    var height = d3.max([d3.max(wireframe_data, function(d) { return d.y1; }),
                         d3.max(wireframe_data, function(d) { return d.y2; })]) + verticalPadding; 
    
   var svgContainer = d3.select('#' + div_id).append("svg")
    .attr("width", width)
    .attr("height", height);

   var svgRouteSegs = svgContainer
    .selectAll("line")
    .data(wireframe_data)
    .enter()
    .append("line")
        .attr("id", function(d, i) { return d.unique_id; })
        .attr("x1", function(d, i) { return d.x1; })
        .attr("y1", function(d, i) { return d.y1; })
        .attr("x2", function(d, i) { return d.x2; })
        .attr("y2", function(d, i) { return d.y2; })
        .attr("class", function(d, i) { return "volume " + d.type; })
        // .style("stroke", function(d, i) { return (( d.type === 'ramp') ? "red" : "blue"); })
        // .style("stroke-width", "2px")
        .on("click", function(d, i) 
            { 
                console.log(d.unique_id); 
                var lineFeature = _.find(DATA.geojson.features, function(f) { return f.properties['unique_id'] == d.unique_id; } );
                if (lineFeature == null) {
                    alert('Something is rotten in the State of Denmark: segment ' + d.unique_id + ' not found.');
                    return;
                }
                var style = { strokeColor : '#ff0000', strokeOpacity : 0.7, strokeWeight: 3.0 }
                ctpsGoogleMapsUtils.drawPolylineFeature(lineFeature, map, style);
                // Now pan/zoom map to selected feature
                var bbox = turf.bbox(lineFeature);
                // Return value of turf.bbox() has the form: [minX, minY, maxX, maxY]
                // Morph this into a form Google Maps can digest
                var googleBounds = new google.maps.LatLngBounds();
                googleBounds.extend({ lat : bbox[1], lng : bbox[0] });
                googleBounds.extend({ lat : bbox[3], lng : bbox[2] });
                map.fitBounds(googleBounds);
            });   
    
    var retval = { lines : svgRouteSegs, txt : null };
    return retval;
} // generateSvgWireframe()

var colorPalettes = {
    'awdt'  :   d3.scaleThreshold()
                    .domain([0, 25000, 50000, 75000, 100000, 150000])
                    .range(["gray", "blue", "green", "yellow", "orange", "red"]),
    'hourly':   d3.scaleThreshold()
                    .domain([0, 2000, 4000, 6000, 8000, 10000])
                    .range(["gray", "blue", "green", "yellow", "orange", "red"])
};
// For the time being, we will use a 6px width in all cases
var widthPalettes = {
    'awdt'  :   d3.scaleThreshold()
                    .domain([0, 25000, 50000, 75000, 100000, 150000])
                    .range(["2px", "3px", "4px", "5px", "6px", "7px"]),
    'hourly':   d3.scaleThreshold()
                    .domain([0, 2000, 4000, 6000, 8000, 10000])
                    .range(["2px", "3px", "4px", "5px", "6px", "7px"])
};

// Work-in-progress 3/11/2019
function symbolizeSvgWireframe(vizWireframe, metric) {
    if (metric.search('awdt') !== -1) {
        colorPalette = colorPalettes.awdt;
        widthPalette = widthPalettes.awdt;
    } else {
        colorPalette = colorPalettes.hourly;
        widthPalette = widthPalettes.hourly;        
    }
    vizWireframe.lines
        .style("stroke", function(d, i) { 
            var _DEBUG_HOOK = 0;
            var retval = colorPalette(d[metric]);
            console.log('Segment ' + d['unique_id'] + ' color: ' + retval);
            return retval;
            }) 
        .style("stroke-width", function(d, i) { return widthPalette(d[metric]); });
        
   //  vizWireframe['volumeText']
            // 'Label' for NO DATA values should be blank
        // .text(function(d, i) { return (d.volumes[metric] <= 0) ? '' : d.volumes[metric].toLocaleString(); });    
    
} // symbolizeSvgWireframe()

function initMap(data) {
    var regionCenterLat = 42.345111165; 
	var regionCenterLng = -71.124736685;
    var zoomLev = 10;
	var lat = regionCenterLat;
	var lng = regionCenterLng;
    
	var mapOptions = {
		center: new google.maps.LatLng(lat, lng),
		zoom: zoomLev,
		mapTypeId: google.maps.MapTypeId.ROADMAP,
		mapTypeControlOptions: {'style': google.maps.MapTypeControlStyle.DROPDOWN_MENU},
		panControl: false,
		streetViewControl: false,
		zoomControlOptions: {'style': 'SMALL'},
		scaleControl: true,
		overviewMapControl: false
	};
    
	map = new google.maps.Map(document.getElementById("map"), mapOptions);
    google.maps.event.addListener(map, "bounds_changed", function boundsChangedHandler(e) { } );
    
    // Un petit hacque to get the map's "bounds_changed" event to fire.
    // Believe it or not: When a Google Maps map object is created, its bounding
    // box is undefined (!!). Thus calling map.getBounds on a newly created map
    // will raise an error. We are compelled to force a "bounds_changed" event to fire.
    // Larry and Sergey: How did you let this one through the cracks??
    map.setCenter(new google.maps.LatLng(lat + 0.000000001, lng + 0.000000001));
} // initMap()


/*
function drawPolylineFeature(lineFeature, gMap, style) {
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
} //drawPolylineFeature()
*/