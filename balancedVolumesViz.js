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
// Polyline features (should only ever be one) on GoogleMap
aPolylines = [];

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
            .attr("class", function(d, i) { return "volume " + d.type; })            
            .attr("x1", function(d, i) { return d.x1; })
            .attr("y1", function(d, i) { return d.y1; })
            .attr("x2", function(d, i) { return d.x2; })
            .attr("y2", function(d, i) { return d.y2; })
            // .style("stroke", function(d, i) { return (( d.type === 'ramp') ? "red" : "blue"); })
            // .style("stroke-width", "2px")
            .on("click", function(d, i) 
                { 
                    console.log('On-click handler: ' + d.unique_id); 
                    var lineFeature = _.find(DATA.geojson.features, function(f) { return f.properties['unique_id'] == d.unique_id; } );
                    if (lineFeature == null) {
                        alert('Segment ' + d.unique_id + ' not found in GeoJSON.');
                        console.log('Segment ' + d.unique_id + ' not found in GeoJSON.');
                        return;
                    }
                    // First, clear any polylines currently on the map
                    aPolylines.forEach(function(pl) { pl.setMap(null); });
                    // Create pollyline feature and add it to the map
                    var style = { strokeColor : '#ff0000', strokeOpacity : 0.7, strokeWeight: 3.0 }
                    var polyline = ctpsGoogleMapsUtils.drawPolylineFeature(lineFeature, map, style);
                    aPolylines.push(polyline);
                    // Now pan/zoom map to selected feature
                    var bbox = turf.bbox(lineFeature);
                    // Return value of turf.bbox() has the form: [minX, minY, maxX, maxY]
                    // Morph this into a form Google Maps can digest
                    var googleBounds = new google.maps.LatLngBounds();
                    googleBounds.extend({ lat : bbox[1], lng : bbox[0] });
                    googleBounds.extend({ lat : bbox[3], lng : bbox[2] });
                    map.fitBounds(googleBounds);
                }); 

    var mainline_xOffset = 150;
    var volumeText_xOffset = 250;
    
    var svgVolumeText = svgContainer
        .selectAll("text")
        .data(wireframe_data)
        .enter()
        .append("text")
            .attr("id", function(d, i) { return 'txt_' +d.unique_id; })
            .attr("class", function(d, i) { return 'txt_' + d.type; })
            // .attr("x", function(d, i) { return d.x1 + ((d.x2 - d.x1)/2); })
            .attr("x", function(d, i) {
                    var tmp, retval;
                    switch(d.type) {
                    case 'main':
                        retval = volumeText_xOffset;
                        break;
                    case 'mainleft':
                        retval = d.x1 - 30;
                        break;
                    case 'mainright':
                        retval = d.x1 + 30;
                        break;
                    case 'hovleft':
                        retval = d.x1; // - 10;
                        break;
                    case 'hovright':
                        retval = d.x1; // + 10;
                        break;
                    case 'rampleft':
                        // Fallthrough is deliberate
                    case 'rampleftmain':
                        // Since the ramp is to the left, use the x-coordinate with the lesser value
                        tmp = (d.x1 < d.x2) ? d.x1 - 10 : d.x2 - 10;
                        retval = tmp;
                        break;                   
                    case 'rampright': 
                        // Since the ramp is the right, use the x-coordinat with the greater value
                        tmp = (d.x1 > d.x2) ? d.x1 + 10 : d.x2 + 10;
                        retval = tmp;
                        break;
                    case 'ramphov':
                        // Fallthrough is deliberate
                    default:
                        // Unlabeled segments, e.g., HOV 'ramps' - x and y ccordinates are abritrary (since these segments are unlabeled)
                        console.log(d.unique_id + ' : segment type is: ' + d.type);
                        retval = d.x1;
                        break;
                    } // switch 
                    return retval;
                 })
            .attr("y", function(d, i) { 
                    var tmp, retval;
                    switch(d.type) {
                    case 'main':
                        retval = d.y1 + ((d.y2 - d.y1)/2);
                        break;
                    case 'mainleft':
                        retval = d.y1 + ((d.y2 - d.y1)/2);     // TEMP - should be OK
                        break;
                    case 'mainright':
                         retval = d.y1 + ((d.y2 - d.y1)/2);     // TEMP - should be OK
                        break;
                    case 'hovleft':
                        // Fallthrough is deliberate
                    case 'hovright':
                        retval = d.y1 + ((d.y2 - d.y1)/2);     
                        break;
                    case 'rampleft':
                         // Since the ramp is to the left, the x-coordinate with the lesser value indicates the 'loose end' of the ramp
                        tmp = (d.x1 < d.x2) ? d.y1 - 10 : d.y2 - 10;
                        retval = tmp;
                        break;              
                    case 'rampleftmain':
                        // Place the label below the 'loose end' of 'vertical ramps'
                        tmp = (d.y1 > d.y2) ? d.y1 + 10 : d.y2 + 10;
                        retval = tmp;
                        break;
                    case 'rampright': 
                        // Since the ramp is the right, the x-coordinate with the greater value indicates the 'loose end' of the ramp
                        tmp = (d.x1 > d.x2) ? d.y1 + 10 : d.y2 + 10;
                        retval = tmp;
                        break;
                    case 'ramphov':
                        // Fallthrough is deliberate
                    default:
                        // Unlabeled segments, e.g., HOV 'ramps' - x and y ccordinates are abritrary (since these are unlabeled)
                        retval = d.y1 + ((d.y2 - d.y1)/2);
                        break;
                    } // switch                   
                    return retval;
                })
            .attr("text-anchor", function(d, i) {
                    var retval; 
                    switch(d.type) {
                    case 'main':
                    case 'mainleft':
                    case 'mainright':
                    case 'hovright':
                    case 'hovleft':
                    case 'rampleftmain':
                        // Fallthroughs above are deliberate
                        retval = "middle";
                        break;
                    case 'rampleft':
                        retval = "end";
                        break;
                    case 'rampright':
                        retval = "start";
                        break;
                    case 'ramphov':
                        // Fallthrough is deliberate
                    default:
                        // Unlabeled segments, e.g., HOV 'ramps' - text-anchor value is arbitrary (since these are unlabeled)
                        retval = "middle";
                        break;
                    }
                    return retval;
                    })
            .attr("transform", function(d, i) 
                {
                    var retval;
                    if (d.type !== 'hovleft' && d.type !== 'hovright') {
                        retval = 'rotate(0,0,0)';
                    } else {
                        // Rotate HOV labels 90 degrees counter-clockwise, i.e., -90 degrees in SVG-speak
                        // The (x,y) point around which the rotation is performed is the (x,y) midpoint of the line in question
                        // For reference, the syntax of the SVG rotate transform in pseudo-BNF form is:
                        //      transform='rotate(<degrees>, <x_origin>, <y_origin>)'
                        retval = 'rotate(-90,' ;
                        retval += d.x1 + ((d.x2 - d.x1)/2);
                        retval += ',';
                        retval += d.y1 + ((d.y2 - d.y1)/2);
                        retval += ')' ;
                    }
                    return retval;
                }) 
            .text('');
    
    var retval = { lines : svgRouteSegs, volume_txt : svgVolumeText };
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
            var retval = colorPalette(d[metric]);
            // console.log('Segment ' + d['unique_id'] + ' color: ' + retval);
            return retval;
            }) 
        .style("stroke-width", function(d, i) { return widthPalette(d[metric]); });
        
   vizWireframe.volume_txt
        // 'Label' for NO DATA values should be blank
        .text(function(d, i) { 
            var retval;
            // Do not 'lablel':
            //     1. segments with NO DATA values (i.e., <= 0)
            //     2. segments with type 'ramphov'
            if (d[metric] <= 0 || d.type == 'ramphov') {
                retval = '';
            } else {
                retval = d[metric].toLocaleString();
            }
            return retval;
        });    
    
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
