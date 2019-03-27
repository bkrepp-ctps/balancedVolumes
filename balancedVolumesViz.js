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
// 'Southbound' and 'northbound' polyline features on GoogleMap
aPolylines_sb = [], aPolylines_nb = [];

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
    symbolizeSvgWireframe(VIZ.sb, 'awdt', '2018');
    // Generate wireframe for northbound route
    VIZ.nb = generateSvgWireframe(DATA.nb_wireframe, 'nb_viz', 0 /* placeholder for now */);  
    symbolizeSvgWireframe(VIZ.nb, 'awdt', '2018');    
    
    // Initialize Google Map
    initMap(DATA); // No need to pass DATA as parm, but doing so anyway  

    // Arm event handler for combo boxes
    $('.app_select_box').change(function(e) {
        var metric = $("#select_metric option:selected").attr('metric');
        var year = $("#select_year option:selected").attr('year');
        symbolizeSvgWireframe(VIZ.sb, metric, year);
        symbolizeSvgWireframe(VIZ.nb, metric, year);
        var _DEBUG_HOOK = 0;
    });
} // initializeApp

function generateSvgWireframe(wireframe_data, div_id, year) {	
    var verticalPadding = 10;
    var width = 450;
    var height = d3.max([d3.max(wireframe_data, function(d) { return d.y1; }),
                         d3.max(wireframe_data, function(d) { return d.y2; })]) + verticalPadding; 
    
   var svgContainer = d3.select('#' + div_id)
        .append("svg")
            .attr("width", width)
            .attr("height", height);

    // The x-offset of the main barrel is 150;
    // Given an SVG drawing area width of 250, translate x +75px to center the main barrel
    var svgRouteSegs_g = svgContainer
        .append("g")
            .attr("transform", "translate(75,0)");  
            
    var svgRouteSegs = svgRouteSegs_g     
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
            .on("click", function(d, i) 
                { 
                    console.log('On-click handler: unique_id = ' + d.unique_id + ' data_id = ' + d.data_id); 
                    var color;
                    var lineFeature = _.find(DATA.geojson.features, function(f) { return f.properties['data_id'] == d.data_id; } );
                    if (lineFeature == null) {
                        alert('Segment ' + d.unique_id + ' not found in GeoJSON.');
                        console.log('Segment ' + d.unique_id + ' not found in GeoJSON.');
                        return;
                    }
                    if (lineFeature.properties.backbone_rte === "i93_sr3_sb") {
                        // Clear any 'southbound' polylines on the map
                        aPolylines_sb.forEach(function(pl) { pl.setMap(null); });  
                        color = '#ff0000'
                    } else if (lineFeature.properties.backbone_rte === "i93_sr3_nb")  {
                        // Clear any 'northbound' polylines on the map
                        aPolylines_nb.forEach(function(pl) { pl.setMap(null); });  
                        color = '#0000ff'
                    } else {
                        return;
                    }    
                    // Create pollyline feature and add it to the map
                    var style = { strokeColor : color, strokeOpacity : 0.7, strokeWeight: 3.0 }
                    var polyline = ctpsGoogleMapsUtils.drawPolylineFeature(lineFeature, map, style);
                    if (lineFeature.properties.backbone_rte === "i93_sr3_sb") {
                        aPolylines_sb.push(polyline);
                    } else {
                        aPolylines_nb.push(polyline);
                    }
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
    
    var svgVolumeText_g = svgContainer
            .append("g")
            .attr("transform", "translate(75,0)");  
    var svgVolumeText = svgVolumeText_g
        .selectAll("text.vol_txt")
        .data(wireframe_data)
        .enter()
        .append("text")
            .attr("id", function(d, i) { return 'vol_txt_' +d.unique_id; })
            .attr("class", "vol_txt")
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
                        // Since the ramp is the right, use the x-coordinate with the greater value
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
            .text('');  // Placeholder value

    var filtered_wireframe_data = _.filter(wireframe_data, function(rec) { return (rec.type === 'rampleft' || rec.type === 'rampright'); });
    var svgLabelText_g = svgContainer.append("g");
    var svgLabelText = svgLabelText_g
        .selectAll("text.label_txt")
        .data(filtered_wireframe_data)
        .enter()
        .append("text")
            .attr("id", function(d, i) { return 'label_txt_' +d.unique_id; })
            .attr("class", "label_text")
            .attr("font-size", 12)
            .attr("x", function(d, i) { 
                var retval;
                retval = 5;     // temp hack during dev
                return retval;
             })
            .attr("y", function(d, i) { 
                var retval;
                retval = d.y1;  // temp hack during dev
                return retval;
            })
            .attr("text-anchor", function(d, i) {
                    var retval; 
                    retval = "start";   // temp hack during dev - may be OK for prod
                    return retval;
            });
    // First line of label text
    var line1 = svgLabelText.append("tspan")
        .attr("class", "label_tspan_1")
        .text(''); // Placeholder     
    // Second line of label text
    var line2 = svgLabelText.append("tspan")
        .attr("class", "label_tspan_2")
        .attr("x", 5)
        .attr("y", function(d, i) { return d.y1; })
        .attr("dy", 10)
        .text(''); // Placeholder
            
    var retval = { lines : svgRouteSegs, volume_txt : svgVolumeText, label_txt_1 : line1, label_txt_2 : line2 };
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

// function: symbolizeSvgWireframe
// parameters:
//      vizWireframe : 'wireframe' of SVG <line> elements, as well as assocated <text. and <tspan> elements for labels
//      metric : the metric to be displayed, e.g., 'awdt' or '6_to_7_am' (6 - 7 am peak period volume)
//      year : may be either the string for a single year, e.g., "2018" or a string beginning with "delta", 
//             followed an underscore, and the strings for 2 years delimited by another underscore, e.g., "delta_2018_2010".
//             The former is self-explanatory; the latter indicates that a comparison of the data for the relevant metric for
//             the 2 years (first - last) is to be rendered.
//  return value : none
function symbolizeSvgWireframe(vizWireframe, metric, year) {
    // Work-in-progress for function to extract either singleton or "delta" data attribute values,
    // which could simplify the code for 'symbolizeSvgWireframe' greatly.
    // Currently not used. 
    var get = function(obj, attr1, attr2) {
        var _DEBUG_HOOK = 0;
        if (arguments.length < 2 || arguments.length > 3) return null;
        if (arguments.length === 2) {
            return obj[attr1];
        } else {
            return obj[attr1] - obj[attr2];
        }
    };
    
    var attrName1, attrName2, parts, year1, year2, colorPalette, widthPalette;    
    
    // Bifurcated world - there HAS to be a more elegant way to do this...
    if (year.includes('delta')) {
        // Data value to be displayed is the delta between two values in the table, i.e., needs to be computed
        parts = year.split('_');
        year1 = parts[1], year2 = parts[2];
        if (metric === 'awdt') {
            attrName1 = metric + '_' + year1;
            attrName2 = metric + '_' + year2;
        } else {
            attrName1 = 'peak_' + year1 + '_' + metric;
            attrName2 = 'peak_' + year2 + '_' + metric;
        }
        console.log('attrName1 = ' + attrName1 + ' attrName2 = ' + attrName2);
        if (attrName1.search('awdt') !== -1) {
            colorPalette = colorPalettes.awdt;
            widthPalette = widthPalettes.awdt;
        } else {
            colorPalette = colorPalettes.hourly;
            widthPalette = widthPalettes.hourly;        
        } 
        vizWireframe.lines
            .style("stroke", function(d, i) { 
                var retval = colorPalette(d[attrName1] - d[attrName2]);
                return retval;
                }) 
            .style("stroke-width", function(d, i) { return widthPalette(d[attrName1] - d[attrName2]); });
            
       vizWireframe.volume_txt
            // Textual display of NO DATA values should be blank
            .text(function(d, i) { 
                var retval;
                // Do not 'lablel':
                //     1. segments with NO DATA values (i.e., <= 0)
                //     2. segments with type 'ramphov'
                if (d[attrName1] <= 0 || d.type == 'ramphov') {         // *** This statement needs attention
                    retval = '';
                } else {
                    retval = (d[attrName1] - d[attrName2]).toLocaleString();
                }
                return retval;
            });
    } else {
        // Simple volume data contained in table - no computation necesssary, just fetch value
        if (metric === 'awdt') {
            attrName1 = metric + '_' + year;
        } else {
            attrName1 = 'peak' + '_' + year + '_' + metric;
        }
        // console.log('attrName1 = ' + attrName1);
        if (attrName1.search('awdt') !== -1) {
            colorPalette = colorPalettes.awdt;
            widthPalette = widthPalettes.awdt;
        } else {
            colorPalette = colorPalettes.hourly;
            widthPalette = widthPalettes.hourly;        
        }    
        vizWireframe.lines
            .style("stroke", function(d, i) { 
                var retval = colorPalette(d[attrName1]);
                return retval;
                }) 
            .style("stroke-width", function(d, i) { return widthPalette(d[attrName1]); });
            
       vizWireframe.volume_txt
            // Textual display of NO DATA values should be blank
            .text(function(d, i) { 
                var retval;
                // Do not 'lablel':
                //     1. segments with NO DATA values (i.e., <= 0)
                //     2. segments with type 'ramphov'
                if (d[attrName1] <= 0 || d.type == 'ramphov') {
                    retval = '';
                } else {
                    retval = d[attrName1].toLocaleString();
                }
                return retval;
            }); 
    } // if-else on whether requested metric needs to be computed or not
        
    // Regardless of whether we're displaying values contained in the table or computed values,
    // these are just descriptive labels and are displayed in the same way
    vizWireframe.label_txt_1
        .text(function(d,i) { return d.description; });
    vizWireframe.label_txt_2
        .text(function(d,i) { return d.description2; });
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
