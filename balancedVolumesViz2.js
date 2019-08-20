// Draft version: support both NB/SB and EB/WB routes

var CONFIG = {  'i93_sr3'   :   {   'defaultRoute'              : true,
                                    'routeLabel'                : 'I-93 / SR-3',
                                    'route'                     : 'i93_sr3',
                                    'orientation'               : 'nbsb',
                                    'mapDiv'                    : 'map_nbsb',
                                    'years'                     : [ 2018, 2010, 1999 ],
                                    'years_awdt'                : [ 2018, 2010, 1999 ],
                                    'awdt_year_1_default'       : 2018,
                                    'awdt_year_2_default'       : 2010,
                                    'years_peak_hours'          : [ 2018, 2010 ],
                                    'peakPeridComparisonYear'   : 2018,
                                    'csvWireframe_primaryDir'   : 'data/csv/join_i93_sr3_nb_wireframe_and_volumes.csv',
                                    'csvWireframe_secondaryDir' : 'data/csv/join_i93_sr3_sb_wireframe_and_volumes.csv',
                                    'csvLanes_primaryDir'       : 'data/csv/i93_sr3_nb_LANES_2010.csv',
                                    'csvLanes_secondaryDir'     : 'data/csv/i93_sr3_sb_LANES_2010.csv',
                                    'csvTownBoundaries_primaryDir'      : 'data/csv/i93_sr3_nb_TOWNS.csv',
                                    'csvTownBoundaries_secondaryDir'    : 'data/csv/i93_sr3_sb_TOWNS.csv'  
                                },
                'i90'       :   {   'defaultRoute'              : false,
                                    'routeLabel'                : 'I-90',
                                    'route'                     : 'i90',
                                    'orientation'               : 'ebwb',
                                    'mapDiv'                    : 'map_ebwb',
                                    'years'                     : [ 2010 ],
                                    'years_awdt'                : [ 2010 ],
                                    'awdt_year_1_default'       : 2010,
                                    'awdt_year_2_default'       : 2010,                                                                      
                                    'years_peak_hours'          : [ 2010 ], 
                                    'peakPeridComparisonYear'   : 2010,
                                    'csvWireframe_primaryDir'   : 'data/csv/i90_eb_wireframe_and_volumes.csv',
                                    'csvWireframe_secondaryDir' : 'data/csv/i90_wb_wireframe_and_volumes.csv',
                                    'csvLanes_primaryDir'       : 'data/csv/i90_eb_LANES.csv',
                                    'csvLanes_secondaryDir'     : 'data/csv/i90_wb_LANES.csv',
                                    'csvTownBoundaries_primaryDir'      : 'data/csv/i90_eb_TOWNS.csv',
                                    'csvTownBoundaries_secondaryDir'    : 'data/csv/i90_wb_TOWNS.csv' 
                                    
                                }
}; // CONFIG

var currentRoute = null;

var geojsonURL = 'data/geojson/roadsegments.geojson';

var csvWireFrame_sb_URL = 'data/csv/join_i93_sr3_sb_wireframe_and_volumes.csv';
var csvWireFrame_nb_URL = 'data/csv/join_i93_sr3_nb_wireframe_and_volumes.csv';
var csvLanes_sb_URL = 'data/csv/i93_sr3_sb_LANES_2010.csv';
var csvLanes_nb_URL = 'data/csv/i93_sr3_nb_LANES_2010.csv';

var csvTownBoundaries_sb_URL = 'data/csv/i93_sr3_sb_TOWNS.csv';
var csvTownBoundaries_nb_URL = 'data/csv/i93_sr3_nb_TOWNS.csv';

// Pseudo-const "var" for NO_DATA flag value
var NO_DATA = -9999;
// Global "database" of data read in from CSV and JSON files for currently selected route
var DATA = {};
// Global access to SVG elements for D3 visualization for currently selected route
var VIZ = {};
// Google Maps map object
var map; 
// Primary-direction (northbound or eastbound) and secondary-direction (southbound or westbound) 
// polyline features on GoogleMap
aPolylines_PrimDir = [], aPolylines_SecDir = [];
lineColorPalette = { 'primary' : '#f5831a', 'secondary' : '#0066b4' };

// Scales for width of SVG <line>s
// Upper bound of scale domains is just a placeholder;
// these values are adjusted when app initializes
var widthPalettes = {
    'absolute': {  
                    'awdt'  :   d3.scaleLinear()
                                    .domain([0, 120000])
                                    .range(["1px", "15px"]),        
                    'hourly':   d3.scaleLinear()
                                    .domain([0, 10000])
                                    .range(["1px", "15px"]),  
                    'cum'   :   d3.scaleLinear()
                                    .domain([0, 20000])
                                    .range(["1px", "15px"])
                }
};

// Create on-hover tooltip for SVG line segments: Define the div for the tooltip
// Simple home-brewed tooltip, based on: http://bl.ocks.org/d3noob/a22c42db65eb00d4e369
// 
var tooltipDiv = d3.select("body").append("div")	
    .attr("class", "tooltip")				
    .style("opacity", 0);

// Helper function: getAttrName
//
// Return name of relevant property in the in-memory array, 
// given 'metric' and 'logicalYear' specified in "select_metric" and "select_year" combo boxes.
// The 'logicalYear' parameter may be '2018, '2010' or '1999'.
function getAttrName(metric, logicalYear) {
    var part1, part2, retval;
    retval = '';    
    if (metric.startsWith('peak') === true) {
        part1 = 'peak_';
        part2 = metric.replace('peak','');
        retval = part1 + logicalYear + part2;
    } else if (metric.startsWith('cum') === true) {
        part1 = 'cum_';
        part2 = metric.replace('cum','');
        retval = part1 + logicalYear + part2;            
    } else {
        // Rash assumption: metric.startsWith('awdt') === true
        retval = metric + '_' + logicalYear;
    }
    return retval;
} // getAttrName()

// primaryDirectionP - helper predicate (boolean-valued function) returning true
// if 'backboneRouteName' is that of a 'primary direction' route, i.e., a
// north- or east-bound route, and false otherwise.
function primaryDirectionP(backboneRouteName) {
    return (backboneRouteName.endsWith('_nb') || backboneRouteName.endsWith('_eb'));
} // primaryDirectionP


// Function to synchronize the bounds of the Google Map with the elements in the relevant viewport
// Moved to the top-level scope in case it needs to be visible throughout the file
function scrollHandler(e) {
    var container = $('#' + e.target.id);   // Get ID of the <div> being scrolled
    var contHeight = container.height();
    var contTop = container.scrollTop();
    var contBottom = contTop + contHeight;
    // console.log('top = ' + contTop + ' bottom = ' + contBottom);
    var elts = _.filter(DATA.secondaryDir_data, function(rec) { return rec.y1 >= contTop && rec.y2 <= contBottom; });       
    // Get the data_ids to search for in the GeoJSON; filter out HOV lanes and ramps
    var searchIds = _.pluck(elts, 'data_id');
    searchIds = _.filter(searchIds, function(id) { return  id.contains('hov') === false && id.startsWith('R') === false; });
    // Make a deep copy of the GeoJSON...
    var gj = Object.assign({}, DATA.geojsonCurrentRoute);
    // ... and filter out everything except the records with the matching data_ids.
    // Yes, we know this is an O(n^2) operation... to be optimized when time is avaialble...
    gj.features = _.filter(gj.features, function(rec) { 
        var i;
        var retval = false;
        for (i = 0; i < searchIds.length; i++) {
            if (rec.properties['data_id'] === searchIds[i]) {
                retval = true;
                // console.log('Found ' + searchIds[i]);
                break;
            }
        }
        return retval;
    });
    // Now, all we have to do is to get the bounding box of the filtered feature colleciton... :-)
    map.tmpDataLayer = new google.maps.Data();
    map.tmpDataLayer.addGeoJson(gj);
    map.tmpDataLayer.setStyle({ strokeWidth: 0, opacity : 1.0 });
    var bounds = new google.maps.LatLngBounds(); 
    map.tmpDataLayer.forEach(function(feature){
        feature.getGeometry().forEachLatLng(function(latlng){
            bounds.extend(latlng);
        });
    });
    map.fitBounds(bounds);
    return;
} // scrollHandler()

// *** EXECUTION BEGINS HERE ***
$(document).ready(function() {
    // Populate combo box of routes
    var route;
    for (prop in CONFIG) {
        $("#select_route").append(
            $("<option />")
                .val(CONFIG[prop].route)
                .text(CONFIG[prop].routeLabel)
                .prop('selected', CONFIG[prop].defaultRoute)
        );
    }
      
    $('#main_view_wrapper').show();
    $('#sb_lanes,#nb_lanes,#eb_lanes,#wb_lanes').hide();
    $('#awdt_comp_view_wrapper').hide();
    $('#peak_comp_view_wrapper').hide();

    // Arm event handler for select_view radio buttons
    $('.select_view').on("click", function(e) {
        var view = $('.select_view:checked').val();
        switch(view) {
        case 'select_main_view':
            $('#awdt_comp_view_wrapper').hide(); 
            $('#peak_comp_view_wrapper').hide();
            $('#main_view_wrapper').show();
            break;
        case 'select_awdt_comp_view':
            $('#main_view_wrapper').hide();
            $('#peak_comp_view_wrapper').hide();
            $('#awdt_comp_view_wrapper').show();
            break;
        case 'select_peak_comp_view':
            $('#main_view_wrapper').hide();
            $('#awdt_comp_view_wrapper').hide();
            $('#peak_comp_view_wrapper').show();
            break;
        default:
            break;
       }
    });
    
    // Arm event handler for select_route combo box
    $('#select_route').change(function(e) {
        var route = $("#select_route option:selected").attr('value');
        // *** TBD ***
        // currentRoute = CONFIG[route];
        // initializeForRoute(currentRoute.route);        
    });
    
    // Load GeoJSON with spatial data, and initialize for default "current" route
    var q = d3.queue()
                .defer(d3.json, geojsonURL)
                .awaitAll(function(error, results) {
                    if (error != null) {
                        alert("Request to load GeoJSON data failed. Exiting application.");
                        return;         
                    }                    
                    DATA.geojsonAll = results[0];  // This is the GeoJSON for *all* limited-access routes (a subset of these for now)
                   // alert("hello, world");
                    var route = $("#select_route option:selected").attr('value');
                    currentRoute = CONFIG[route];
                    initializeForRoute(currentRoute.route);
        });
}); // document ready event handler

// initializeForRoute()
// 
// parameter: route - symbolic name of route for which we are to initizlize the app
//
// This function kicks-off loading the CSV data for the selected route, and causes
// "generateViz" when the AJAZ requests for CSV data have completed (or failed).
// 
function initializeForRoute(route) {
    var q = d3.queue()
                .defer(d3.csv, CONFIG[route].csvWireframe_secondaryDir)
                .defer(d3.csv, CONFIG[route].csvWireframe_primaryDir)
                .defer(d3.csv, CONFIG[route].csvLanes_secondaryDir)
                .defer(d3.csv, CONFIG[route].csvLanes_primaryDir)
                .defer(d3.csv, CONFIG[route].csvTownBoundaries_secondaryDir)
                .defer(d3.csv, CONFIG[route].csvTownBoundaries_primaryDir)
                .awaitAll(generateViz);    
} // initializeForRoute()

// generateViz()
// 
// parameters: 
//      error - null if no error, otherwise error object from failed XmlHttpRequest
//      results[0] - CSV balanced volume and "wireframe" layout data for secondary direction of route
//      results[1] - CSV balanced volume and "wireframe" layout data for primary direction of route
//      results[2] - CSV data for layout of lanes diagram for secondary direction of route
//      results[3] - CSV data for layout of lanes diagram for primary direction of route
//      results[4] - CSV data for location of town boundary lines in viz of secondary direction of route
//      results[5] - CSV data for location of town boundary lines in viz of primary direction of route
//
// This function parses the various pieces of CSV data for the route in question, and then calls
// subsidiary functions to generate the SVGs for the several visualizations of the data for the route
//
function generateViz(error, results) {
    if (error != null) {
        alert('One or more requests to load CSV data for route ' + CONFIG[currentRoute].routeLabel + ' failed. Exiting application.');
        return;         
    } 

    // Populate combo boxes for 'AWDT comparison' and 'peak hours' views for the current route;
    // First, we must remove any options that are present (i.e., from last selected route)
    $('#awdt_select_year_1,#awdt_select_year_2').empty();
    var i;
    for (i = 0; i < currentRoute.years_awdt.length; i++) {
        $('#awdt_select_year_1').append(
            $("<option />")
                .val(currentRoute.years_awdt[i])
                .text(currentRoute.years_awdt[i])
                .prop('selected', currentRoute.years_awdt[i] === currentRoute.awdt_year_1_default)
        );
        $('#awdt_select_year_2').append(
            $("<option />")
                .val(currentRoute.years_awdt[i])
                .text(currentRoute.years_awdt[i])
                .prop('selected', currentRoute.years_awdt[i] === currentRoute.awdt_year_2_default)
        );        
    }
    
    $('#peak_select_direction').empty();
    var directions = (currentRoute.orientation === 'nbsb') ? [ 'Northbound', 'Southbound' ] : [ 'Eastbound', 'Westbound' ];
    for (i = 0; i < directions.length; i++) {
        $('#peak_select_direction').append(
            $("<option />")
                .val(directions[i])
                .text(directions[i])
                .prop('selected', i === 0)
        );
    }
   

    

    // Extract subset of the GeoJSON data for the currently selected route 
    DATA.geojsonCurrentRoute = Object.assign({}, DATA.geojsonAll);
    DATA.geojsonCurrentRoute.features = _.filter(DATA.geojsonCurrentRoute.features, function(rec) {
            return rec.properties['backbone_rte'].startsWith(currentRoute.route);
    });
    
    DATA.secondaryDir_data = results[0];
    DATA.primaryDir_data = results[1];
    DATA.secondaryDir_lanes = results[2];
    DATA.primaryDir_lanes = results[3];
    DATA.secondaryDir_towns = results[4];
    DATA.primaryDir_towns = results[5];

    // Prep GeoJSON data for the currently selected route for use in app
    //
    // 2010 'backbone' route - both NB and SB
    DATA.backbone_2010 = Object.assign({}, DATA.geojsonCurrentRoute);
    DATA.backbone_2010.features = _.filter(DATA.backbone_2010.features, function(rec) { 
        return rec.properties['yr_2010'] === 1 && rec.properties['data_id'].contains('hov') == false;
    });
     // 1999 'backbone' route - both NB and SB
    DATA.backbone_1999 = Object.assign({}, DATA.geojsonCurrentRoute);
    DATA.backbone_1999.features = _.filter(DATA.backbone_1999.features, function(rec) { 
        return rec.properties['yr_1999'] === 1 && rec.properties['data_id'].contains('hov') == false;
    });
    
    // Prep tabular (CSV) volume data loaded for use in app
    function cleanupCsvRec(rec) {
        var tmp1, tmp2;
        rec.x1 = +rec.x1;
        rec.y1 = +rec.y1;
        rec.x2 = +rec.x2;
        rec.y2 = +rec.y2;   
        rec.showdesc = +rec.showdesc;
        rec.nlanes = +rec.nlanes;
        rec.yr_1999 = +rec.yr_1999;
        rec.yr_2010 = +rec.yr_2010;
        rec.yr_2018 = +rec.yr_2018;
        // Split 'description' field into 3 parts
        tmp1 = rec.description.split('|');
        rec.description = tmp1[0].trim();
        rec.description2 = (tmp1.length > 1) ? tmp1[1].trim() : '';
        rec.description3 = (tmp1.length === 3) ? tmp1[2].trim() : '';
        // Add 'year_restriction' field
        if (rec.yr_1999 === 1 && rec.yr_2010 === 0) {
            tmp2 = 'yr_1999_only';
        } else if (rec.yr_1999 === 0 && rec.yr_2010 === 1) {
            tmp2 = 'yr_2010_only';
        } else {
            tmp2 = 'yr_restriction_none';
        }
        rec.year_restriction = tmp2;
        // 1999 data
        rec.awdt_1999 = +rec.awdt_1999;
        // 2010 data
        rec.awdt_2010 = +rec.awdt_2010;
        rec['peak_2010_6_to_7_am']  = +rec['peak_2010_6_to_7_am'];
        rec['peak_2010_7_to_8_am']  = +rec['peak_2010_7_to_8_am'];
        rec['peak_2010_8_to_9_am']  = +rec['peak_2010_8_to_9_am'];
        rec['cum_2010_6_to_9_am']   = +rec['cum_2010_6_to_9_am'];
        rec['peak_2010_9_to_10_am'] = +rec['peak_2010_9_to_10_am'];
        rec['peak_2010_3_to_4_pm']  = +rec['peak_2010_3_to_4_pm'];
        rec['peak_2010_4_to_5_pm']  = +rec['peak_2010_4_to_5_pm'];
        rec['peak_2010_5_to_6_pm']  = +rec['peak_2010_5_to_6_pm'];
        rec['cum_2010_3_to_6_pm']   = +rec['cum_2010_3_to_6_pm'];
        rec['peak_2010_6_to_7_pm']  = +rec['peak_2010_6_to_7_pm']
        // 2018 data
        rec.awdt_2018 = +rec.awdt_2018;
        rec['peak_2018_6_to_7_am']  = +rec['peak_2018_6_to_7_am'];
        rec['peak_2018_7_to_8_am']  = +rec['peak_2018_7_to_8_am'];
        rec['peak_2018_8_to_9_am']  = +rec['peak_2018_8_to_9_am'];
        rec['cum_2018_6_to_9_am']   = +rec['cum_2018_6_to_9_am'];
        rec['peak_2018_9_to_10_am'] = +rec['peak_2018_9_to_10_am'];
        rec['peak_2018_3_to_4_pm']  = +rec['peak_2018_3_to_4_pm'];
        rec['peak_2018_4_to_5_pm']  = +rec['peak_2018_4_to_5_pm'];
        rec['peak_2018_5_to_6_pm']  = +rec['peak_2018_5_to_6_pm'];
        rec['cum_2018_3_to_6_pm']   = +rec['cum_2018_3_to_6_pm'];
        rec['peak_2018_6_to_7_pm']  = +rec['peak_2018_6_to_7_pm'];   
    } // cleanupCsvRec()

    DATA.secondaryDir_data.forEach(cleanupCsvRec);
    DATA.primaryDir_data.forEach(cleanupCsvRec);    

    // Determine the upper bound of domains of width scales ('widthPalettes');
    var max_awdt = _.max([_.max(_.pluck(DATA.secondaryDir_data, 'awdt_1999')), _.max(_.pluck(DATA.secondaryDir_data, 'awdt_2010')), _.max(_.pluck(DATA.secondaryDir_data, 'awdt_2018')),
                          _.max(_.pluck(DATA.primaryDir_data, 'awdt_1999')), _.max(_.pluck(DATA.primaryDir_data, 'awdt_2010')), _.max(_.pluck(DATA.primaryDir_data, 'awdt_2018'))]);
    widthPalettes.absolute.awdt.domain([0, max_awdt]);
    
    var max_hourly = _.max([_.max(_.pluck(DATA.secondaryDir_data, 'peak_2018_6_to_7_am')), _.max(_.pluck(DATA.secondaryDir_data, 'peak_2018_7_to_8_am')), 
                            _.max(_.pluck(DATA.secondaryDir_data, 'peak_2018_8_to_9_am')), _.max(_.pluck(DATA.secondaryDir_data, 'peak_2018_9_to_10_am')), 
                            _.max(_.pluck(DATA.secondaryDir_data, 'peak_2018_3_to_4_pm')), _.max(_.pluck(DATA.secondaryDir_data, 'peak_2018_4_to_5_pm')), 
                            _.max(_.pluck(DATA.secondaryDir_data, 'peak_2018_5_to_6_pm')), _.max(_.pluck(DATA.secondaryDir_data, 'peak_2018_6_to_7_pm')),                           
                            _.max(_.pluck(DATA.primaryDir_data, 'peak_2018_6_to_7_am')), _.max(_.pluck(DATA.primaryDir_data, 'peak_2018_7_to_8_am')), 
                            _.max(_.pluck(DATA.primaryDir_data, 'peak_2018_8_to_9_am')), _.max(_.pluck(DATA.primaryDir_data, 'peak_2018_9_to_10_am')), 
                            _.max(_.pluck(DATA.primaryDir_data, 'peak_2018_3_to_4_pm')), _.max(_.pluck(DATA.primaryDir_data, 'peak_2018_4_to_5_pm')), 
                            _.max(_.pluck(DATA.primaryDir_data, 'peak_2018_5_to_6_pm')), _.max(_.pluck(DATA.primaryDir_data, 'peak_2018_6_to_7_pm')),
                            _.max(_.pluck(DATA.secondaryDir_data, 'peak_2010_6_to_7_am')), _.max(_.pluck(DATA.secondaryDir_data, 'peak_2010_7_to_8_am')), 
                            _.max(_.pluck(DATA.secondaryDir_data, 'peak_2010_8_to_9_am')), _.max(_.pluck(DATA.secondaryDir_data, 'peak_2010_9_to_10_am')), 
                            _.max(_.pluck(DATA.secondaryDir_data, 'peak_2010_3_to_4_pm')), _.max(_.pluck(DATA.secondaryDir_data, 'peak_2010_4_to_5_pm')), 
                            _.max(_.pluck(DATA.secondaryDir_data, 'peak_2010_5_to_6_pm')), _.max(_.pluck(DATA.secondaryDir_data, 'peak_2010_6_to_7_pm')),                           
                            _.max(_.pluck(DATA.primaryDir_data, 'peak_2010_6_to_7_am')), _.max(_.pluck(DATA.primaryDir_data, 'peak_2010_7_to_8_am')), 
                            _.max(_.pluck(DATA.primaryDir_data, 'peak_2010_8_to_9_am')), _.max(_.pluck(DATA.primaryDir_data, 'peak_2010_9_to_10_am')), 
                            _.max(_.pluck(DATA.primaryDir_data, 'peak_2010_3_to_4_pm')), _.max(_.pluck(DATA.primaryDir_data, 'peak_2010_4_to_5_pm')), 
                            _.max(_.pluck(DATA.primaryDir_data, 'peak_2010_5_to_6_pm')), _.max(_.pluck(DATA.primaryDir_data, 'peak_2010_6_to_7_pm'))]);
    widthPalettes.absolute.hourly.domain([0, max_hourly]);                        
                            
    var max_cum = _.max([_.max(_.pluck(DATA.secondaryDir_data, 'cum_2018_6_to_9_am')), _.max(_.pluck(DATA.secondaryDir_data, 'cum_2018_3_to_6_pm')),
                         _.max(_.pluck(DATA.secondaryDir_data, 'cum_2010_6_to_9_am')), _.max(_.pluck(DATA.secondaryDir_data, 'cum_2010_3_to_6_pm'))]);
    widthPalettes.absolute.cum.domain([0, max_cum]);
    
    // Handlers for various events on the main SVG <line>-work (a.k.a. 'stick diagram')
    var handlers = {
        'click' :       function(d,i) {
                            console.log('On-click handler: unique_id = ' + d.unique_id + ' data_id = ' + d.data_id); 
                            var primaryDir, color;
                            var dottedLine = false;
                            var lineFeature = _.find(DATA.geojsonCurrentRoute.features, function(f) { return f.properties['data_id'] == d.data_id; } );
                            if (lineFeature == null) {
                                alert('Segment ' + d.unique_id + ' not found in GeoJSON.');
                                return;
                            }
                            primaryDir = primaryDirectionP(lineFeature.properties.backbone_rte);
                            if (primaryDir) {
                                // Clear any 'primary direction' (i.e., 'northbound') polylines on the map
                                aPolylines_PrimDir.forEach(function(pl) { pl.setMap(null); });  
                                color = lineColorPalette.primary;
                            } else {
                                // Clear any 'secondary direction' (i.e., 'southbound') polylines on the map
                                aPolylines_SecDir.forEach(function(pl) { pl.setMap(null); });  
                                color = lineColorPalette.secondary;
                            }    
                            // Create polyline feature and add it to the map
                            var style = { strokeColor : color, strokeOpacity : 1.0, strokeWeight: 8.0 };
                            // Render features that existed in the Central Artery area before the 'Big Dig',
                            // i.e., in 1999, with a dotted line, all others with a solid line
                            if (lineFeature.properties['pre_big_dig'] === 1) {
                                dottedLine = true;
                            }
                            var polyline = ctpsGoogleMapsUtils.drawPolylineFeature(lineFeature, map, style, dottedLine);
                            if (primaryDir) {
                                aPolylines_PrimDir.push(polyline);
                            } else {
                                aPolylines_SecDir.push(polyline);
                            }                           
                            // Now pan/zoom map to the selected (single) feature.
                            // We use turf.js here to compute the bounding box to which to pan/zoom.
                            // turf.js doest the job well for *single* features, and is lightweight. 
                            // I've had it fail when when called to compute the bbox of a feature collection,
                            // and so we employ a bit of slight-of-hand using a Google Maps Data layer when
                            // performing that operation. See the code for scrollHandler().
                            var bbox = turf.bbox(lineFeature);
                            // Return value of turf.bbox() has the form: [minX, minY, maxX, maxY]
                            // Morph this into a form Google Maps can digest
                            var googleBounds = new google.maps.LatLngBounds();
                            googleBounds.extend({ lat : bbox[1], lng : bbox[0] });
                            googleBounds.extend({ lat : bbox[3], lng : bbox[2] });
                            map.fitBounds(googleBounds);                        
        },
        'mouseover' :   function(d,i) {
                            var tmpstr, metric, metricTxt, year, yearTxt, attrName, backgroundColor;
                            tmpstr = d.description + '<br>' + d.description2 + '<br>';
                            tmpstr += (d.description3 !== '') ? d.description3 + '<br>' : '';
                            metric = $("#select_metric option:selected").attr('value');
                            metricTxt = $("#select_metric option:selected").text();
                            year = $("#select_year option:selected").attr('value');
                            yearTxt = $("#select_year option:selected").text();
                            attrName = getAttrName(metric,year); 
                            tmpstr += yearTxt + ' ' + metricTxt + ': ' + d[attrName].toLocaleString();
                            tmpstr += '<br>'+ 'Number of lanes: ' + d.nlanes + '<br>';
                            backgroundColor = (primaryDirectionP(d.backbone_rte)) ? lineColorPalette.primary : lineColorPalette.secondary;                 
                            tooltipDiv.transition()		
                                .duration(200)		
                                .style("opacity", .9);                              
                            tooltipDiv.html(tmpstr)
                                .style("background", backgroundColor)
                                .style("left", (d3.event.pageX) + "px")		
                                .style("top", (d3.event.pageY - 28) + "px");            
                        },
        'mouseout'  :   function(d,i) {
                            tooltipDiv.transition()		
                                .duration(500)		
                                .style("opacity", 0);	            
                        }      
    }; // handlers{}
    
    function setMainCaption(route, year) {
        var tmp = route + "&nbsp;-&nbsp;" + year;
        $('#central_caption_nbsb').html(tmp);
    } // setMainCaption()
    
    // Prep CSV data for lanes diagrams
    //
    function cleanupCsvLanesRec(rec) {
        rec.x1 = +rec.x1;
        rec.y1 = +rec.y1;
        rec.x2 = +rec.x2;
        rec.y2 = +rec.y2;
        rec.yr_2010 = +rec.yr_2010;
    }   
    DATA.secondaryDir_lanes.forEach(cleanupCsvLanesRec);
    DATA.secondaryDir_lanes = _.filter(DATA.secondaryDir_lanes, function(d) { return d.yr_2010 === 1; });
    DATA.primaryDir_lanes.forEach(cleanupCsvLanesRec);
    DATA.primaryDir_lanes = _.filter(DATA.primaryDir_lanes, function(d) { return d.yr_2010 === 1; });    
    generateSvgLanesChart(DATA.secondaryDir_lanes, 'sb_lanes');
    generateSvgLanesChart(DATA.primaryDir_lanes, 'nb_lanes');
    
    // Prep CSV data for town boundary lines
    // 
    function cleanupCsvTownBoundaryRec(rec) { rec.y = +rec.y; }
    DATA.secondaryDir_towns.forEach(cleanupCsvTownBoundaryRec);
    DATA.primaryDir_towns.forEach(cleanupCsvTownBoundaryRec);
    
    ///////////////////////////////////////////////////////////////////////////////////////////////
    // Initialize machinery for the 'main' view: 
    //      1. SVG (route) wireframe and town boundary lines
    //          a. route wireframe
    //          b. town boundary lines
    //      2. Google Map
    //      3. Event handlers for UI controls
    //          a. select_year combo box
    //          b. select_metric combo box
    //          c. sync_scrollbars checkbox
    //      4. Download data button
    // 
    // (1)  Initialize SVG wireframes
    VIZ.secondaryDir = generateSvgWireframe(DATA.secondaryDir_data, DATA.secondaryDir_towns, 'sb_viz', true, handlers);
    symbolizeSvgWireframe(VIZ.secondaryDir, 'sb_viz', 'awdt', '2018', lineColorPalette.secondary);
    VIZ.primaryDir = generateSvgWireframe(DATA.primaryDir_data, DATA.primaryDir_towns, 'nb_viz', false, handlers);  
    symbolizeSvgWireframe(VIZ.primaryDir, 'nb_viz', 'awdt', '2018', lineColorPalette.primary);    
    
    // (2) Initialize Google Map
    initMap(DATA);

    // (3) Event hanlders for UI controls
    // (3a) Arm event handler for select_year combo box
    $('#select_year').change(function(e) {
        var year = $("#select_year option:selected").attr('value');
        var metric;
        // Toggle the enabled/disabled state of the options for select_metric, 
        // to reflect the metrics avaialble for the given year
        if (year === "1999") {
            $("#select_metric option[value='peak_6_to_7_am']").prop('disabled', true);
            $("#select_metric option[value='peak_7_to_8_am']").prop('disabled', true);
            $("#select_metric option[value='peak_8_to_9_am']").prop('disabled', true);
            $("#select_metric option[value='cum_6_to_9_am']").prop('disabled', true);
            $("#select_metric option[value='peak_9_to_10_am']").prop('disabled', true);
            $("#select_metric option[value='peak_3_to_4_pm']").prop('disabled', true);
            $("#select_metric option[value='peak_4_to_5_pm']").prop('disabled', true);
            $("#select_metric option[value='peak_5_to_6_pm']").prop('disabled', true);
            $("#select_metric option[value='cum_3_to_6_pm']").prop('disabled', true);
            $("#select_metric option[value='peak_6_to_7_pm']").prop('disabled', true);
            // If year is 1999, only one metric (awdt) is available, so select it
            $("#select_metric").val('awdt');
        } else {
            $("#select_metric option[value='peak_6_to_7_am']").prop('disabled', false);
            $("#select_metric option[value='peak_7_to_8_am']").prop('disabled', false);
            $("#select_metric option[value='peak_8_to_9_am']").prop('disabled', false);
            $("#select_metric option[value='cum_6_to_9_am']").prop('disabled', false);
            $("#select_metric option[value='peak_9_to_10_am']").prop('disabled', false);
            $("#select_metric option[value='peak_3_to_4_pm']").prop('disabled', false);
            $("#select_metric option[value='peak_4_to_5_pm']").prop('disabled', false);
            $("#select_metric option[value='peak_5_to_6_pm']").prop('disabled', false);
            $("#select_metric option[value='cum_3_to_6_pm']").prop('disabled', false);
            $("#select_metric option[value='peak_6_to_7_pm']").prop('disabled', false);              
        }
        metric = $("#select_metric option:selected").attr('value');
        symbolizeSvgWireframe(VIZ.secondaryDir, 'sb_viz', metric, year, lineColorPalette.secondary);
        symbolizeSvgWireframe(VIZ.primaryDir, 'nb_viz', metric, year, lineColorPalette.primary);       
        setMainCaption("I-93/SR-3", year);
    });
    
    // (3b) Arm event handler for select_metric combo box
    $('#select_metric').change(function(e) {
        var metric = $("#select_metric option:selected").attr('value');
        var year = $("#select_year option:selected").attr('value');
        // If year is 1999, only one metric (awdt) is available
        if (year === "1999" && metric !== "awdt") {
            $("#select_metric").val('awdt');
            metric = $("#select_metric option:selected").attr('value');
        }       
        symbolizeSvgWireframe(VIZ.secondaryDir, 'sb_viz', metric, year, lineColorPalette.secondary);
        symbolizeSvgWireframe(VIZ.primaryDir, 'nb_viz', metric, year, lineColorPalette.primary);   
        setMainCaption("I-93/SR-3", year);        
     });
    
    // (3c) On-change handler for sync_scrollbars checkbox
    // Synchronize or un-synchronize the scrollbars for the sb_viz and nb_viz <div>s
    // Documentation on the (very simple) syncscroll.js library may be found at:
    //      https://github.com/asvd/syncscroll
    // 
    // Note: This handler also arms the 'scroll' handler for the sb_viz and nb_viz divs,
    // as appropriate
    $('#main_sync_scrollbars').change(function(e) {
        var new_name_attr_nb, new_name_attr_sb;
        var checked = $('#main_sync_scrollbars').prop('checked');       
        if (checked) {
            new_name_attr_nb = 'sync_nb_and_sb';
            new_name_attr_sb = 'sync_nb_and_sb';
        } else {
            new_name_attr_nb = 'sync_nb';
            new_name_attr_sb = 'sync_sb';            
        }       
        var elt = $('#nb_viz').get()[0];
        elt.setAttribute('name', new_name_attr_nb);   
        elt = $('#nb_lanes').get()[0];
        elt.setAttribute('name', new_name_attr_nb);                
        elt =  $('#sb_viz').get()[0];
        elt.setAttribute('name', new_name_attr_sb);      
        elt = $('#sb_lanes').get()[0];
        elt.setAttribute('name', new_name_attr_sb);        
        syncscroll.reset();  
        // If checked, only arm the scroll event handler for either the SB or NB divs;
        // this will prevent duplicate calls to the handler.
        if (checked) {
            $('#sb_viz,#sb_lanes').scroll(function(e) { scrollHandler(e); });
        } else {
            $('#sb_viz,#nb_viz,#sb_lanes,#nb_lanes').scroll(function(e) { scrollHandler(e); });
        }
    });
    
    // (3d) On-scroll handler for scrollbars of the main view
    //
    // Synchronize the bounds of the Google Map with the elements in the relevant viewport
    $('#sb_viz,#nb_viz').on('scroll', scrollHandler);
      
    // (3e) Show/hide 2010 lane configuration <div>s
    //
    $('#main_show_lane_config').change(function(e) {
        var checked = $('#main_show_lane_config').prop('checked');  
        if (checked) {
           $('#sb_lanes,#nb_lanes').show();
        } else {
           $('#sb_lanes,#nb_lanes').hide();
        }
    });
 
    // (4) Download data button
    // 
    $('#download_button').click(function(e) {
        var url = 'Download.html'
        window.open(url,'popUpWindow','height=700,width=900,left=10,top=10,resizable=yes,scrollbars=yes,toolbar=no,menubar=no,location=no,directories=no,status=yes')
    });
    
    ///////////////////////////////////////////////////////////////////////////////////////////////
    // Initialize machinery for the 'awdt comparison' view:
    //      1. SVG wireframes
    //      2. Event handlers for UI controls
    //          a. awdt_select_year_1 and awdt_select_year_2 combo boxes
    //          b. sync_*_scrollbars radio buttons
    //
    // (1) Initialize SVG wireframes:
    //      Southbound route, year 1 - default is 2018
    //      Southbound route, year 2 - default is 2010
    //      Northbound route, year 1 - default is 2018
    //      Northbound route, year 2 - default is 2010
    VIZ.secondaryDir_yr_1 = generateSvgWireframe(DATA.secondaryDir_data, DATA.secondaryDir_towns, 'sb_viz_yr_1', true, null);
    symbolizeSvgWireframe(VIZ.secondaryDir_yr_1, 'sb_viz_yr_1', 'awdt', '2018', lineColorPalette.secondary);
    VIZ.secondaryDir_yr_2 = generateSvgWireframe(DATA.secondaryDir_data, DATA.secondaryDir_towns, 'sb_viz_yr_2', true, null);
    symbolizeSvgWireframe(VIZ.secondaryDir_yr_2, 'sb_viz_yr_2', 'awdt', '2010', lineColorPalette.secondary);   
    VIZ.primaryDir_yr_1 = generateSvgWireframe(DATA.primaryDir_data, DATA.primaryDir_towns, 'nb_viz_yr_1', false, null);  
    symbolizeSvgWireframe(VIZ.primaryDir_yr_1, 'nb_viz_yr_1', 'awdt', '2018', lineColorPalette.primary);    
    VIZ.primaryDir_yr_2 = generateSvgWireframe(DATA.primaryDir_data, DATA.primaryDir_towns, 'nb_viz_yr_2', false, null);  
    symbolizeSvgWireframe(VIZ.primaryDir_yr_2, 'nb_viz_yr_2', 'awdt', '2010', lineColorPalette.primary);   

    // (2a) Arm event handlers for awdt_select_year_1 and awdt_select_year_2 combo boxes
    $('#awdt_select_year_1').change(function(e) {
        var year_1 = $("#awdt_select_year_1 option:selected").attr('value');   
        var tmp = 'Southbound' + '&nbsp;' + year_1 + '&nbsp;AWDT&nbsp;' + '&darr;';
        $('#awdt_comp_caption_sb_yr_1').html(tmp);
        tmp = 'Northbound' + '&nbsp;' + year_1 + '&nbsp;AWDT&nbsp;' + '&uarr;';
        $('#awdt_comp_caption_nb_yr_1').html(tmp);
        symbolizeSvgWireframe(VIZ.secondaryDir_yr_1, 'sb_viz_yr_1', 'awdt', year_1,  lineColorPalette.secondary);  
        symbolizeSvgWireframe(VIZ.primaryDir_yr_1, 'nb_viz_yr_1', 'awdt', year_1,  lineColorPalette.primary); 
    });
    $('#awdt_select_year_2').change(function(e) {
        var year_2 = $("#awdt_select_year_2 option:selected").attr('value');      
        var tmp = 'Southbound' + '&nbsp;' + year_2 + '&nbsp;AWDT&nbsp;' + '&darr;';
        $('#awdt_comp_caption_sb_yr_2').html(tmp);
        tmp = 'Northbound' + '&nbsp;' + year_2 + '&nbsp;AWDT&nbsp;' + '&uarr;';
        $('#awdt_comp_caption_nb_yr_2').html(tmp);     
        symbolizeSvgWireframe(VIZ.secondaryDir_yr_2, 'sb_viz_yr_2', 'awdt', year_2,  lineColorPalette.secondary);  
        symbolizeSvgWireframe(VIZ.primaryDir_yr_2, 'nb_viz_yr_2', 'awdt', year_2,  lineColorPalette.primary);         
    }); 

    // (2b) Arm-change handlers for sync_*_scrollbars radio buttons
    // Documentation on the (very simple) syncscroll.js library may be found at:
    //      https://github.com/asvd/syncscroll
    $('.scroll_radio').on("click", function(e) {
        var checked = $('.scroll_radio:checked').val();
        var newName = (checked !== 'awdt_unsync_scrollbars') ? checked : '';
        var elt;
        switch(checked) {
        case "awdt_sync_all_scrollbars":
        case "awdt_unsync_scrollbars":
            elt = $('#nb_viz_yr_1').get()[0];
            elt.setAttribute('name', newName);   
            elt = $('#nb_viz_yr_2').get()[0];
            elt.setAttribute('name', newName);         
            elt =  $('#sb_viz_yr_1').get()[0];
            elt.setAttribute('name', newName);
            elt =  $('#sb_viz_yr_2').get()[0];
            elt.setAttribute('name', newName);            
            break;           
        case "awdt_sync_sb_scrollbars":
            elt = $('#nb_viz_yr_1').get()[0];
            elt.setAttribute('name', 'name_1');   
            elt = $('#nb_viz_yr_2').get()[0];
            elt.setAttribute('name', 'name_2');  
            elt =  $('#sb_viz_yr_1').get()[0];
            elt.setAttribute('name', newName);
            elt =  $('#sb_viz_yr_2').get()[0];
            elt.setAttribute('name', newName);             
            break;
        case "awdt_sync_nb_scrollbars":
            elt = $('#nb_viz_yr_1').get()[0];
            elt.setAttribute('name', newName);   
            elt = $('#nb_viz_yr_2').get()[0];
            elt.setAttribute('name', newName);    
            elt =  $('#sb_viz_yr_1').get()[0];
            elt.setAttribute('name', 'name_3');
            elt =  $('#sb_viz_yr_2').get()[0];
            elt.setAttribute('name', 'name_4');            
            break;
        default:
            // Should never get here
            console.log("Event handler for scroll buttons in AWDT comparison view: Unrecognized 'checked' value: " + checked);
            break;
        }      
        syncscroll.reset();  
    }); 
    
    ///////////////////////////////////////////////////////////////////////////////////////////////
    // Initialize machinery for the 'peak period comparison' view:
    //      1. SVG wireframes
    //      2. Event handlers for UI controls
    //          a. peak_select_period and peak_select_direction combo boxes
    //          b. sync_*_scrollbars radio buttons
    //
    // (1) Initialize SVG wireframes - we initialize with the data for the northbound (i.e., primary) direction:
    //      hour 1 - default is 6-7 AM
    //      hour 2 - default is 7-8 AM
    //      hour 3 - default is 8-9 AM
    //      sum    - default is 6-9 AM 
    VIZ.hourly_1 = generateSvgWireframe(DATA.primaryDir_data, DATA.primaryDir_towns, 'peak_viz_hr_1', true, null);
    symbolizeSvgWireframe(VIZ.hourly_1, 'peak_viz_hr_1', 'peak_6_to_7_am', '2018', lineColorPalette.primary);    
    VIZ.hourly_2 = generateSvgWireframe(DATA.primaryDir_data, DATA.primaryDir_towns, 'peak_viz_hr_2', true, null);
    symbolizeSvgWireframe(VIZ.hourly_2, 'peak_viz_hr_2', 'peak_7_to_8_am', '2018', lineColorPalette.primary);    
    VIZ.hourly_3 = generateSvgWireframe(DATA.primaryDir_data, DATA.primaryDir_towns, 'peak_viz_hr_3', true, null);
    symbolizeSvgWireframe(VIZ.hourly_3, 'peak_viz_hr_3', 'peak_8_to_9_am', '2018', lineColorPalette.primary);    
    VIZ.hourly_sum = generateSvgWireframe(DATA.primaryDir_data, DATA.primaryDir_towns, 'peak_viz_sum', true, null);
    symbolizeSvgWireframe(VIZ.hourly_sum, 'peak_viz_sum', 'cum_6_to_9_am', '2018', lineColorPalette.primary);    
    
    // Helper function for select_peak_period and select_direction combo boxes on-change event handlers
    function symbolizeHourlyComparison(period, direction) {
        var color = direction === "Northbound" ? lineColorPalette.primary : lineColorPalette.secondary;
        if (period === "AM") {
            $('#peak_comp_caption_1').html('6 to 7 AM');
            $('#peak_comp_caption_2').html('7 to 8 AM');
            $('#peak_comp_caption_3').html('8 to 9 AM');
            $('#peak_comp_caption_4').html('6 to 9 AM<br>(cumulative)');
            symbolizeSvgWireframe(VIZ.hourly_1, 'peak_viz_hr_1', 'peak_6_to_7_am', '2018', color);     
            symbolizeSvgWireframe(VIZ.hourly_2, 'peak_viz_hr_2', 'peak_7_to_8_am', '2018', color); 
            symbolizeSvgWireframe(VIZ.hourly_3, 'peak_viz_hr_3', 'peak_8_to_9_am', '2018', color); 
            symbolizeSvgWireframe(VIZ.hourly_sum, 'peak_viz_sum', 'cum_6_to_9_am', '2018', color);  
        } else {
            // Assume period === "PM"
            $('#peak_comp_caption_1').html('3 to 4 PM');
            $('#peak_comp_caption_2').html('4 to 5 PM');
            $('#peak_comp_caption_3').html('5 to 6 PM');
            $('#peak_comp_caption_4').html('3 to 6 PM<br>(cumulative)');
            symbolizeSvgWireframe(VIZ.hourly_1, 'peak_viz_hr_1', 'peak_3_to_4_pm', '2018', color);     
            symbolizeSvgWireframe(VIZ.hourly_2, 'peak_viz_hr_2', 'peak_4_to_5_pm', '2018', color); 
            symbolizeSvgWireframe(VIZ.hourly_3, 'peak_viz_hr_3', 'peak_5_to_6_pm', '2018', color); 
            symbolizeSvgWireframe(VIZ.hourly_sum, 'peak_viz_sum', 'cum_3_to_6_pm', '2018', color);            
        }
    } // symbolizeHourlyComparison()

     // (2a) Arm event handlers for select_peak_period and select_direction combo boxes
    $('#peak_select_period').change(function(e) {
        var period = $("#peak_select_period option:selected").attr('value');   
        var direction = $("#peak_select_direction option:selected").attr('value');
        symbolizeHourlyComparison(period, direction);
    });   
    $('#peak_select_direction').change(function(e) {
        var period = $("#peak_select_period option:selected").attr('value');   
        var direction = $("#peak_select_direction option:selected").attr('value');    
        var color = (direction === 'Northbound') ? lineColorPalette.primary : lineColorPalette.secondary;
        var volumeData = (direction === 'Northbound') ? DATA.primaryDir_data : DATA.secondaryDir_data;
        var townBoundaryData = (direction === 'Northbound') ? DATA.primaryDir_towns : DATA.secondaryDir_towns;
        // Need to cear existing SVG wireframes, and generate new ones for the newly selected direction    
        $('#peak_viz_hr_1').html('');
        $('#peak_viz_hr_2').html('');
        $('#peak_viz_hr_3').html('');
        $('#peak_viz_sum').html('');
        VIZ.hourly_1 = generateSvgWireframe(volumeData, townBoundaryData, 'peak_viz_hr_1', true, null);        
        VIZ.hourly_2 = generateSvgWireframe(volumeData, townBoundaryData, 'peak_viz_hr_2', true, null);      
        VIZ.hourly_3 = generateSvgWireframe(volumeData, townBoundaryData, 'peak_viz_hr_3', true, null);       
        VIZ.hourly_sum = generateSvgWireframe(volumeData, townBoundaryData, 'peak_viz_sum', true, null);
        symbolizeHourlyComparison(period, direction);
    });        
} // generateViz()

// function: generateSvgWireframe
// parameters:
//      wireframeData -  data from main CSV file containing data on layout of the SVG <line>
//                       elements (a 'wireframe') that will be symbolized to represent
//                       the actual balanced volume data values
//      townBoundaryData - data from "_TOWNS" CSV file with info on the location of (logical) town
//                         boundaries within the schematic 'wireframe'
//      div_id - the ID of the HTML <div> into which to place the SVG elements
//      yDir_is_routeDir - boolean flag indicating whether the route travels in the same
//                         direction as increasing Y-values in the SVG space;
//                         used to determine which end of SVG <line> elements for
//                         ramps corresponds to the 'end' (i.e., tip) of the ramp
//      handlers - object that optionally contains properties that are the handler
//                 functions associated with events (click, mouseover, mouseout) on 
//                 the SVG <line>-work. If these are non-null, they are bound to
//                 to the SVG <line>-work; otherwise no function9s) is/are so bound
//
// notes: This function generates four SVG structures, each contained within 
//        an SVG <g> element:
//          1. svgRouteSegs_g  - contains <line> elements comprising the schematic route 'wireframe'
//          2. svgVolumeText_g - contains <text> elements containing balanced volume numbers
//          3. svgLabelText_g  - contains <text> and <tspan> elements containing descriptive 
//                               text about route segments
//          4. svgTownBoundaries_g - contains <line> elements indicating town boundary lines
//                                   with respect to route schematic route linework;
//                                   this is generated first, so the schematic linework
//                                   is rendered on top of it
//          5. svgTownNamesBefore_g and svgTownNamesAfter_g - contains <text> elements for
//                                town names on either side of a schematic town boundary
//
function generateSvgWireframe(wireframeData, townBoundaryData, div_id, yDir_is_routeDir, handlers) {	
    var verticalPadding = 10;
    var width = 450;
    var height = d3.max([d3.max(wireframeData, function(d) { return d.y1; }),
                         d3.max(wireframeData, function(d) { return d.y2; })]) + verticalPadding; 
    
   var svgContainer = d3.select('#' + div_id)
        .append("svg")
            .attr("width", width)
            .attr("height", height);
                      
    // (4) SVG <line> elements for schematic town boundaries
    //
    var svgTownBoundaries_g = svgContainer.append("g");
    var svgTownBoundaries = svgTownBoundaries_g;
    svgTownBoundaries
        .selectAll("line.town_boundary")
        .data(townBoundaryData)
        .enter()
        .append("line")
            .attr("id", function(d, i) { return d.unique_id; })
            .attr("class", "town_boundary")
            .attr("x1", 10)
            .attr("x2", width - 10)
            .attr("y1", function(d,i) {
                            var retval;
                            retval = d.y + 10;
                            return retval;
                 })                    
            .attr("y2", function(d,i) {
                            var retval;
                            retval = d.y + 10;
                            return retval;
                 })
            .style("stroke", "firebrick")
            .style("stroke-width", "2px")
            .style("stroke-dasharray", "10, 5");
    
    // (5)  SVG <text> elements for the names of the towns on each side of each town boundary <line>
    // (5a) Name of town "before" town boundary
    var svgTownNamesBefore_g = svgContainer.append("g");
    var svgTownNamesBefore = svgTownNamesBefore_g;
    svgTownNamesBefore
        .selectAll("text.town_name_before")
        .data(townBoundaryData)
        .enter()
        .append("text")
            .attr("class", "town_name_before")
            .attr("font-size", 12)
            .attr("fill", "firebrick")  // font color
            .attr("x", width - 10)
            .attr("y", function(d, i) {
                            var retval;
                            retval = d.y + 5;
                            return retval;
                })
            .attr("text-anchor", "end")
            .text(function(d,i) { return d.town_before; });
    // (5b) Name of town "after" town boundary
    var svgTownNamesAfter_g = svgContainer.append("g");
    var svgTownNamesAfter = svgTownNamesAfter_g;
    svgTownNamesAfter
        .selectAll("text.town_name_after")
        .data(townBoundaryData)
        .enter()
        .append("text")
            .attr("class", "town_name_after")
            .attr("font-size", 12)
            .attr("fill", "firebrick")  // font color
            .attr("x", width - 10)
            .attr("y", function(d, i) {
                            var retval;
                            retval = d.y + 25;
                            return retval;
                })
            .attr("text-anchor", "end")
            .text(function(d,i) { return d.town_after; });           
    
    // The x-offset of the main barrel of the 'wireframe' is 150 in the CSV wireframe layout data;
    // Given an SVG drawing area width of 450, translate x +75px to center the main barrel
    var svgRouteSegs_g = svgContainer
        .append("g")
            .attr("transform", "translate(75,0)");  
    
    // (1) 'wireframe' for the schematic route outline, consisting of SVG <line> elements
    //
    var svgRouteSegs = svgRouteSegs_g     
        .selectAll("line.wireframe")
        .data(wireframeData)
        .enter()
        .append("line")
            .attr("id", function(d, i) { return d.unique_id; })
            .attr("class", function(d, i) { 
                var retval = '';
                retval += 'wireframe';
                retval += ' volume_' + d.type; 
                retval += ' ' + 'restriction_' + d.restriction;
                retval += ' ' + d.year_restriction; 
                return retval;
            }) 
            .attr("x1", function(d, i) { return d.x1; })
            .attr("y1", function(d, i) { return d.y1; })
            .attr("x2", function(d, i) { return d.x2; })
            .attr("y2", function(d, i) { return d.y2; });
            
    if (handlers !== null && handlers.click !== null) {
        svgRouteSegs.on("click", handlers.click);
    }
    if (handlers !== null && handlers.mouseover !== null) {
        svgRouteSegs.on("mouseover", handlers.mouseover);
    } 
    if (handlers !== null && handlers.mouseout !== null) {
        svgRouteSegs.on("mouseout", handlers.mouseout);
    }    
   
    var mainline_xOffset = 150;
    var volumeText_xOffset = 250;
    
    // (2) SVG <text> elements for the balanced volume data itself
    // Do not show volume data for pseudo-ramps for HOV lanes - these are just graphical decorations
   var filtered_wireframeData1 = _.filter(wireframeData, function(rec) { return (rec.type != 'ramphov'); });
    var svgVolumeText_g = svgContainer
            .append("g")
            .attr("transform", "translate(75,0)");  
    var svgVolumeText = svgVolumeText_g
        .selectAll("text.vol_txt")
        .data(filtered_wireframeData1)
        .enter()
        .append("text")
            .attr("id", function(d, i) { return 'vol_txt_' +d.unique_id; })
            .attr("class", function(d,i) {
                var retval = 'vol_txt';
                retval += ' ' + d.year_restriction;
                return retval;    
            })
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
                        retval = d.x1; 
                        break;
                    case 'hovright':
                        retval = d.x1;
                        break;
                    case 'rampleftmain':
                        // These ramps are 'vertical' in the wireframe display; the 2 x-coordinates are identical
                        retval = d.x1
                        break;                            
                    case 'ramp_on_left':
                    case 'ramp_off_left':
                         // Since the ramp is to the left, use the x-coordinate with the lesser value
                        tmp = (d.x1 < d.x2) ? d.x1 - 25 : d.x2 - 25;
                        retval = tmp;
                        break;                    
                    case 'ramp_on_right':
                    case 'ramp_off_right': 
                        // Since the ramp is to the right, use the x-coordinate with the greater value
                        tmp = (d.x1 > d.x2) ? d.x1 + 25 : d.x2 + 25;
                        retval = tmp;
                        break;   
                    case 'ramphov':
                        // Fallthrough is deliberate
                    default:
                        // Segments not 'labeled' with volume data, e.g., HOV 'ramps' - x and y ccordinates are abritrary (since these segments are unlabeled with data)
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
                    case 'mainleft':
                    case 'mainright':                 
                        retval = d.y1 + ((d.y2 - d.y1)/2);    
                        break;
                    case 'hovleft':
                        // Note: We have to futz with the *Y*-coordinate because the text for 'hov{left,right}' segments is rotated
                       retval = d.y1 + ((d.y2 - d.y1)/2) - 15;
                       break;
                    case 'hovright':
                        // Note: We have to futz with the *Y*-coordinate because the text for 'hov{left,right}' segments is rotated
                        retval = d.y1 + ((d.y2 - d.y1)/2) + 15;  
                        break;
                    case 'rampleftmain':
                        // Place the data value below the 'loose end' of 'vertical ramps'
                        tmp = (d.y1 > d.y2) ? d.y1 + 20 : d.y2 + 20;
                        retval = tmp;
                        break;                        
                    case 'ramp_on_left':
                    case 'ramp_off_left':
                         // Since the ramp is to the left, the x-coordinate with the lesser value indicates the 'loose end' of the ramp
                        tmp = (d.x1 < d.x2) ? d.y1 - 10 : d.y2 - 10;
                        retval = tmp;
                        break;                    
                    case 'ramp_on_right':
                    case 'ramp_off_right':               
                        // Since the ramp is the right, the x-coordinate with the greater value indicates the 'loose end' of the ramp
                        tmp = (d.x1 > d.x2) ? d.y1 + 10 : d.y2 + 10;
                        retval = tmp;
                        break;                    
                    case 'ramphov':
                        // Fallthrough is deliberate
                    default:
                        // Segments not 'labeled' with volume data, e.g., HOV 'ramps' - x and y ccordinates are abritrary (since these segments are unlabeled with data)
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
                        // Segments not 'labeled' with volume data, e.g., HOV 'ramps' - text-anchor value is arbitrary (since these are unlabeled with data)
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

    // (3) SVG <text> and <tspan> elements for descriptive labels, e.g., "Interchange X off-ramp to Y"
    // These are only applied for certain records in the input data, essentially interchange on/off ramps
    var filtered_wireframeData2 = _.filter(wireframeData, function(rec) { return (rec.showdesc === 1); });
    var svgLabelText_g = svgContainer.append("g");
    var svgLabelText = svgLabelText_g
        .selectAll("text.label_txt")
        .data(filtered_wireframeData2)
        .enter()
        .append("text")
            .attr("id", function(d, i) { return 'label_txt_' + d.unique_id; })
            .attr("class", function(d, i) {
                retval = 'label_text';
                retval += ' ' + d.year_restriction;
                return retval;
            })
            .attr("font-size", 12)
            .attr("x", function(d, i) { 
                var retval;
                switch(d.type) {
                case 'ramp_on_left':
                case 'ramp_on_right':
                case 'ramp_off_left':
                case 'ramp_off_right':
                case 'rampleftmain':              
                    retval = 5; 
                    break;
                default:   
                    // The following cases should never occur in practice: main, mainright, mainleft, hovleft, hovright, and ramphov.
                    // If they do, something is amiss.
                    console.log('Attempt to create descriptive label text placeholder for: ' + d.unique_id + '. Type = ' + d.type);
                    retval = 0; // Retval is arbitrary choice   
                    break;
                }
                return retval;
             })
            .attr("y", function(d, i) { 
                var retval;
                switch(d.type) {
                // General comment on the placement of descriptive labels for ramps.
                // The general principle here is to place the descriptive label for 
                // ramps at the Y-coordinate of the 'tip' ('loose end') of the ramp.
                // Which end is the 'tip' depends upon (1) whether the direction of the 
                // route corresponds to increasing Y-values in SVG space, and (2) whether
                // the ramp is an on- or off-ramp.
                //
                case 'ramp_on_left':
                case 'ramp_on_right':
                    retval = (yDir_is_routeDir === true) ? d3.min([d.y1,d.y2]) : d3.max([d.y1,d.y2]);
                    break;
                case 'ramp_off_left':
                case 'ramp_off_right':
                    retval = (yDir_is_routeDir === true) ? d3.max([d.y1,d.y2]) : d3.min([d.y1,d.y2]);
                    break;
                case 'rampleftmain':
                    // These are 'vertical' off-ramps
                    retval = (yDir_is_routeDir === true) ? d3.max([d.y1,d.y2]) : d3.min([d.y1,d.y2]);
                    break;
                default:
                    // The following cases should never occur in practice:
                    // main, mainright, mainleft, hovleft, hovright, and ramphov.
                    console.log(d.unique_id + ' type = ' + d.type);
                    retval = 0; // Retval is arbitrary choice
                    break;
                }
                return retval;
            })
            .attr("text-anchor", function(d, i) {
                    var retval; 
                    retval = "start";   // TBD if this will be OK
                    return retval;
            });
    // First line of descriptive label text
    var line1 = svgLabelText.append("tspan")
        .attr("class", function(d, i) {
            var retval = 'label_tspan_1';
            retval += ' ' + d.year_restriction;
            return retval;
        })
        .text(''); // Placeholder     
    // Second line of descriptive label text
    var line2 = svgLabelText.append("tspan")
        .attr("class", function(d, i) {
            var retval = 'label_tspan_2';
            retval += ' ' + d.year_restriction;
            return retval;
        })
        .attr("x", 5)
        .attr("y", function(d, i) { 
            var retval;
            // Place descriptive label at the Y-coordinate of the 'tip' ('loose end') of the ramp.
            // Which end is the 'tip' depends upon (1) whether the direction of the 
            // route corresponds to increasing Y-values in SVG space, and (2) whether
            // the ramp is an on- or off-ramp.
            switch(d.type) {
            case 'ramp_on_left':
            case 'ramp_on_right':
                retval = (yDir_is_routeDir === true) ? d3.min([d.y1,d.y2]) : d3.max([d.y1,d.y2]);
                break;
            case 'ramp_off_left':
            case 'ramp_off_right':
                retval = (yDir_is_routeDir === true) ? d3.max([d.y1,d.y2]) : d3.min([d.y1,d.y2]);
                break;
            case 'rampleftmain':
                // These are 'vertical' off-ramps
                retval = (yDir_is_routeDir === true) ? d3.max([d.y1,d.y2]) : d3.min([d.y1,d.y2]);
                break;                
            default:
                // The following cases should never occur in practice:
                // main, mainright, mainleft, hovleft, hovright, and ramphov.              
                retval = 0;  // Retval is arbitrary choice
                break;   
            }
            return retval; 
        }) 
        .attr("dy", 10)
        .text(''); // Placeholder
    // Third line of descriptive label text
    var line3 = svgLabelText.append("tspan")
        .attr("class", function(d, i) {
            var retval = 'label_tspan_3';
            retval += ' ' + d.year_restriction;
            return retval;
        })
        .attr("x", 5)
        .attr("y", function(d, i) { 
            var retval;
            // Place descriptive label at the Y-coordinate of the 'tip' ('loose end') of the ramp.
            // Which end is the 'tip' depends upon (1) whether the direction of the 
            // route corresponds to increasing Y-values in SVG space, and (2) whether
            // the ramp is an on- or off-ramp.
            switch(d.type) {
            case 'ramp_on_left':
            case 'ramp_on_right':
                retval = (yDir_is_routeDir === true) ? d3.min([d.y1,d.y2]) : d3.max([d.y1,d.y2]);
                break;
            case 'ramp_off_left':
            case 'ramp_off_right':
                retval = (yDir_is_routeDir === true) ? d3.max([d.y1,d.y2]) : d3.min([d.y1,d.y2]);
                break;
            case 'rampleftmain':
                // These are 'vertical' off-ramps
                retval = (yDir_is_routeDir === true) ? d3.max([d.y1,d.y2]) : d3.min([d.y1,d.y2]);
                break;                
            default:
                // The following cases should never occur in practice:
                // main, mainright, mainleft, hovleft, hovright, and ramphov.              
                retval = 0;  // Retval is arbitrary choice
                break;   
            }
            return retval; 
        }) 
        .attr("dy", 20)
        .text(''); // Placeholder     
        
    var retval = { volumeLines : svgRouteSegs,  volume_txt : svgVolumeText,  label_txt_1 : line1,  label_txt_2 : line2,  label_txt_3: line3 };
    return retval;
} // generateSvgWireframe()

// function: symbolizeSvgWireframe
// parameters:
//      vizWireframe : 'wireframe' of SVG <line> elements, and assocated <text> and <tspan> elements for labels
//      divId  : the ID of the <div> contaiing the SVG 'wireframe'
//      metric : the metric to be displayed, e.g., 'awdt' or '6_to_7_am' (6 - 7 am peak period volume)
//      year   : 2019, 2010, or 1999
//      color  : the color to be used to render the SVG <line>s
// return value : none
function symbolizeSvgWireframe(vizWireframe, divId, metric, year, color) {
    // Given a 'logical' metric to symbolize (denoted by a 'metric' and 'logicalYear'
    // return the witdh palette to use for it
    function getWidthPalette(metric, logicalYear) {
        var base, retval;
        base = widthPalettes['absolute'];
        if (metric.contains('awdt')) {
            retval = base['awdt'];
        } else if (metric.contains('cum')) {
            retval = base['cum'];
        } else {
            retval = base['hourly'];
        } 
        return retval;
    } // getWidthPalette()
  
    // Body of symbolizeSvgWireframe() begins here:
    //
    var attrName, widthPalette, colorPalette;
    attrName = getAttrName(metric, year);
        
    widthPalette = getWidthPalette(metric, year); 
    vizWireframe.volumeLines
        .style("stroke", function(d, i) { 
            var retval = color; 
            return retval;
        }) 
        .style("stroke-width", function(d, i) { 
            var retval = widthPalette(d[attrName]);
            return retval;
        });
            
   vizWireframe.volume_txt
        // Textual display of NO_DATA values should be blank
        .text(function(d, i) { 
            var retval;
            // Do not display volume data for:
            //     1. segments with a NO_DATA value (i.e., value === -9999)
            //     2. segments with type 'ramphov'            
            if (d[attrName] === NO_DATA || d.type == 'ramphov') {
                retval = '';
            } else {
                retval = d[attrName].toLocaleString();
            }
            return retval;
        }); 
    
    // Hide linework, metric values, and descriptive text for segments not present during the selected year.
    $('#' + divId + ' .yr_1999_only').show();
    $('#' + divId + ' .yr_2010_only').show();
    if (year === '2010' || year === '2018') {
        $('#' + divId + ' .yr_1999_only').hide();
    } else if (year === '1999') {
        $('#' + divId + ' .yr_2010_only').hide();
    }
    
    // Folderol to hide linework for the southern HOV lane that's only present in the PM if the selected metric is for an AM time period,
    // and to hide linework for the southern HOV lane that's only present in the AM if the selected metric is for a PM time period.
    var elts;
    $('#' + divId + ' .restriction_am_only').show();
    $('#' + divId + ' .restriction_pm_only').show();
    if (divId === 'sb_viz' && metric.endsWith('_am')) {
        $('#sb_viz .restriction_pm_only').hide();
    } else if (divId == 'nb_viz' && metric.endsWith('_pm')) {
        $('#nb_viz .restriction_am_only').hide();
    }
    
    // Descriptive labels
    vizWireframe.label_txt_1
        .text(function(d,i) { return d.description; });
    vizWireframe.label_txt_2
        .text(function(d,i) { return d.description2; });
    vizWireframe.label_txt_3
        .text(function(d,i) { return d.description3; });   
} // symbolizeSvgWireframe()

function generateSvgLanesChart(lanes_data, div_id) {    
    var tmp = _.max(lanes_data, function(d) { return d.x2; });
    var x_max = tmp.x2;
    tmp = _.max(lanes_data, function(d) { return d.y2; });
    var y_max = tmp.y2;
    
	var width = x_max +10,
        height = y_max + 10;
                     
	var svgContainer = d3.select('#' + div_id)
        .append("svg")
            .attr("width", width)
            .attr("height", height);
       
    var svgLaneSegs = svgContainer
		.selectAll("line")
		.data(lanes_data)
		.enter()
		.append("line")
            // .attr("id", function(d, i) { return d.unique_id; })
            .attr("x1", function(d, i) { return d.x1; })
            .attr("y1", function(d, i) { return d.y1; })
            .attr("x2", function(d, i) { return d.x2; })
            .attr("y2", function(d, i) { return d.y2; })
            // .attr("class", function(d, i) { return d.type; })
			.style("stroke", "black")
			.style("stroke-width", "2px")
			.on("click", function(d, i) { console.log(d.unique_id); });    
} // generateSvgLanesChart()

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

	map = new google.maps.Map(document.getElementById("map_nbsb"), mapOptions); 
    google.maps.event.addListener(map, "bounds_changed", function boundsChangedHandler(e) { } );
     // Un petit hacque to get the map's "bounds_changed" event to fire.
    // Believe it or not: When a Google Maps map object is created, its bounding
    // box is undefined (!!). Thus calling map.getBounds on a newly created map
    // will raise an error. We are compelled to force a "bounds_changed" event to fire.
    // Larry and Sergey: How did you let this one through the cracks??
    map.setCenter(new google.maps.LatLng(lat + 0.000000001, lng + 0.000000001));
    
    // START of petite hacque to set scale bar units to miles/imperial instead of km/metric:
    // See: https://stackoverflow.com/questions/18067797/how-do-i-change-the-scale-displayed-in-google-maps-api-v3-to-imperial-miles-un
    // and: https://issuetracker.google.com/issues/35825255
    var intervalTimer = window.setInterval(function() {
        var elements = document.getElementById("map_nbsb").getElementsByClassName("gm-style-cc");
        for (var i in elements) {
            // look for 'km' or 'm' in innerText via regex https://regexr.com/3hiqa
            if ((/\d\s?(km|(m\b))/g).test(elements[i].innerText)) {
                // The following call effects the change of scale bar units
                elements[i].click();
                window.clearInterval(intervalTimer);
            }
        }
    }, 500);
    window.setTimeout(function() { window.clearInterval(intervalTimer) }, 20000 );
    // END of peitie hacque to set scale bar units to miles/imperial instead of km/metric  

    // Render the main 'backbone' route on the map using a Google Map data layer
    //
    map.data.addGeoJson(data.backbone_2010);
    map.data.setStyle(function(feature) {
        var retval, backbone_rte = feature.getProperty('backbone_rte');
        if (primaryDirectionP(backbone_rte)) {
            retval = { strokeColor : lineColorPalette.primary, strokeWeight: 2.0,  opacity: 1.0 };
        } else {
            retval = { strokeColor : lineColorPalette.secondary, strokeWeight: 2.0,  opacity: 1.0 };
        }
        return retval;
    });
    
    //  Now pan/zoom map to the full extent of the route
    //  With credit to: https://stackoverflow.com/questions/32615267/zoom-on-google-maps-data-layer
    var bounds = new google.maps.LatLngBounds(); 
    map.data.forEach(function(feature){
        feature.getGeometry().forEachLatLng(function(latlng){
            bounds.extend(latlng);
        });
    });
    map.fitBounds(bounds);    
} // initMap()

function downloadData(e) {
    // Create string of data to be downloaded
    var newstring = '';
    // Header line
    newstring = 'data_id, direction, description, yr_2018, yr_1999,';
    newstring += 'awdt_2018,';
    newstring += 'peak_2018_6_to_7_am, peak_2018_7_to_8_am, peak_2018_8_to_9_am, peak_2018_9_to_10_am,';
    newstring += 'peak_2018_3_to_4_pm, peak_2018_4_to_5_pm, peak_2018_5_to_6_pm, peak_2018_6_to_7_pm,';
    newstring += 'cum_2018_6_to_9_am, cum_2018_3_to_6_pm'; 
    newstring += 'awdt_2010,';
    newstring += 'peak_2010_6_to_7_am, peak_2010_7_to_8_am, peak_2010_8_to_9_am, peak_9_to_10_am,';
    newstring += 'peak_2010_3_to_4_pm, peak_2010_4_to_5_pm, peak_2010_5_to_6_pm, peak_2010_6_to_7_pm,';
    newstring += 'cum_2010_6_to_9_am, cum_2010_3_to_6_pm'
    newstring += 'awdt_1999';
    newstring += '\n';
     
    function writeRecords(data, dirString) {
        var i, tmp;
        for (i = 0; i < data.length; i++) {
            newstring += data[i].data_id + ',' + dirString + ',';
            // N.B. The following three fields may contain commas, and are combined into a single field in the generated CSV.
            tmp = data[i].description + ' ' +  data[i].description2 + ' ' + data[i].description3; 
            newstring += '"' + tmp + '"' + ',';
            newstring += data[i].yr_2018 + ',';
            newstring += data[i].yr_1999 + ',';
            newstring += data[i].awdt_2018 + ',';      
            newstring += data[i].peak_2018_6_to_7_am + ',';
            newstring += data[i].peak_2018_7_to_8_am + ',';
            newstring += data[i].peak_2018_8_to_9_am + ',';
            newstring += data[i].peak_2018_9_to_10_am + ',';
            newstring += data[i].peak_2018_3_to_4_pm + ',';
            newstring += data[i].peak_2018_4_to_5_pm + ',';
            newstring += data[i].peak_2018_5_to_6_pm + ',';
            newstring += data[i].peak_2018_6_to_7_pm + ',';     
            newstring += data[i].cum_2018_6_to_9_am + ',';
            newstring += data[i].cum_2018_3_to_6_pm + ',';
            newstring += data[i].awdt_2010 + ',';
            newstring += data[i].peak_2010_6_to_7_am + ',';
            newstring += data[i].peak_2010_7_to_8_am + ',';
            newstring += data[i].peak_2010_8_to_9_am + ',';
            newstring += data[i].peak_2010_9_to_10_am + ',';
            newstring += data[i].peak_2010_3_to_4_pm + ',';
            newstring += data[i].peak_2010_4_to_5_pm + ',';
            newstring += data[i].peak_2010_5_to_6_pm + ',';
            newstring += data[i].peak_2010_6_to_7_pm + ',';     
            newstring += data[i].cum_2010_6_to_9_am + ',';
            newstring += data[i].cum_2010_3_to_6_pm + ',';
            newstring += data[i].awdt_1999;
            newstring += '\n';   
        }
    } // writeRecords()
     
    // Data lines, NB and SB
    writeRecords(DATA.primaryDir_data, 'nb');
    writeRecords(DATA.secondaryDir_data, 'sb');
    sessionStorage.setItem("sent", newstring); 
    download(newstring, "i93_sr3_balanced_volumes.csv", "text/csv");
} // downloadData()
