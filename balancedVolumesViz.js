var geojsonURL = 'data/geojson/i93_and_sr3_complete.geojson';
var csvWireFrame_sb_URL = 'data/csv/join_i93_sr3_sb_wireframe_and_volumes.csv';
var csvWireFrame_nb_URL = 'data/csv/join_i93_sr3_nb_wireframe_and_volumes.csv';

// Pseudo-const "var" for NO_DATA flag value
var NO_DATA = -9999;
// Global "database" of data read in from CSV and JSON files
var DATA = {};
// Global access to SVG elements for D3 visualization
VIZ = {};
// Google Maps map object
var map; 
// Primary-direction (northbound or eastbound) and secondary-direction (southbound or westbound) 
// polyline features on GoogleMap
aPolylines_PrimDir = [], aPolylines_SecDir = [];
lineColorPalette = { 'primary' : '#f5831a', 'secondary' : '#0066b4' };

// Helper function: getAttrName
//
// Return name of relevant property in the in-memory array, 
// given 'metric' and 'logicalYear' specified in "select_metric" and "select_year" combo boxes.
// The 'logicalYear' parameter may be '2018, '2010' or 'delta_2018_2010'
function getAttrName(metric, logicalYear) {
    var part1, part2, retval;
    retval = '';    
    if (logicalYear.startsWith('delta')) {
        retval = logicalYear + '_' + metric;     
    } else {
        // Non-delta attribute
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
    }
    return retval;
} // getAttrName()

// Create on-hover tooltip for SVG line segments: Define the div for the tooltip
// Simple home-brewed tooltip, based on: http://bl.ocks.org/d3noob/a22c42db65eb00d4e369
// 
var tooltipDiv = d3.select("body").append("div")	
    .attr("class", "tooltip")				
    .style("opacity", 0);

$(document).ready(function() {
    $('#wrapper').show();
    $('#comp_wrapper').hide();
    $('.select_view').on("click", function(e) {
        var view = $('.select_view:checked').val();
        if (view === 'select_main_view') {
            $('#comp_wrapper').hide();   
            $('#main_wrapper').show();
        } else {
            $('#main_wrapper').hide();
            $('#comp_wrapper').show();
        }
    });
    var q = d3.queue()
                .defer(d3.json, geojsonURL)
                .defer(d3.csv, csvWireFrame_sb_URL)
                .defer(d3.csv, csvWireFrame_nb_URL)
                .awaitAll(initializeApp);
});

// primaryDirectionP - predicate (boolean-valued function) returning true
// if 'backboneRouteName' is that of a 'primary direction' route, i.e., a
// north- or east-bound route, and false otherwise.
function primaryDirectionP(backboneRouteName) {
    return (backboneRouteName.endsWith('_nb') || backboneRouteName.endsWith('_eb'));
} // primaryDirectionP

function initializeApp(error, results) {
    if (error != null) {
        alert("One or more requests to load data failed. Exiting application.");
        return;         
    }        
    var geojson = results[0];
    var sb_data = results[1];
    var nb_data = results[2];

    // Prep data loaded for use in app
    DATA.geojson = geojson;
    
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
        // Synthesize the 'delta' of the 2018 and 2010 awdt values
        rec['delta_2018_2010_awdt'] = (rec['awdt_2018'] != NO_DATA) ? rec['awdt_2018'] - rec['awdt_2010'] : NO_DATA;
    } // cleanupCsvRec()

    sb_data.forEach(cleanupCsvRec);
    nb_data.forEach(cleanupCsvRec);     
    DATA.sb_data = sb_data;
    DATA.nb_data = nb_data;
    
    // Handlers for various events on the main SVG <line>-work:
    var handlers = {
        'click' :       function(d,i) {
                            // console.log('On-click handler: unique_id = ' + d.unique_id + ' data_id = ' + d.data_id); 
                            var primaryDir, color;
                            var dottedLine = false;
                            var lineFeature = _.find(DATA.geojson.features, function(f) { return f.properties['data_id'] == d.data_id; } );
                            if (lineFeature == null) {
                                alert('Segment ' + d.unique_id + ' not found in GeoJSON.');
                                // console.log('Segment ' + d.unique_id + ' not found in GeoJSON.');
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
                            var style = { strokeColor : color, strokeOpacity : 1.0, strokeWeight: 5.0 };
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
                            // performing that operation. See the code for scrollHandler(), below.
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
                            if (year.contains('delta')) {
                                // Current assumption: all "deltas" are between 2018 and 2010
                                tmpstr += 'Change in ' + metricTxt + ' between 2018 and 2010: ' + d[attrName].toLocaleString();
                            } else {
                                tmpstr += yearTxt + ' ' + metricTxt + ': ' + d[attrName].toLocaleString();
                            }
                            tmpstr += '<br>'+ 'Number of lanes: ' + d.nlanes + '<br>';
                            backgroundColor = (primaryDirectionP(d.backbone_rte)) ? lineColorPalette.primary : lineColorPalette.secondary;
                            // console.log(tmpstr);                 
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
    
    ///////////////////////////////////////////////////////////////////////////////////////////////
    // Initialize stuff for the 'main' view: 
    //      1. SVG wireframe
    //      2. Google Map
    //      3. Event handlers for UI controls
    //          a. select_year combo box
    //          b. select_metric combo box
    //          c. sync_scrollbars checkbox
    // 
    // (1)  Initialize SVG wireframes
    VIZ.sb = generateSvgWireframe(DATA.sb_data, 'sb_viz', true, handlers);
    symbolizeSvgWireframe(VIZ.sb, 'sb_viz', 'awdt', '2018', lineColorPalette.secondary);
    VIZ.nb = generateSvgWireframe(DATA.nb_data, 'nb_viz', false, handlers);  
    symbolizeSvgWireframe(VIZ.nb, 'nb_viz', 'awdt', '2018', lineColorPalette.primary);    
    
    // (2) Initialize Google Map
    initMap(DATA);

    // (3) Event hanlders for UI controls
    // (3a) Arm event handler for select_year combo box
    $('#select_year').change(function(e) {
        var year = $("#select_year option:selected").attr('value');
        var metric;
        // Toggle the enabled/disabled state of the options for select_metric, 
        // to reflect the metrics avaialble for the given year
        if (year === "1999" || year === "2010") {
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
            // If year is 1999 or 2010, only one metric (awdt) is available, so select it
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
        symbolizeSvgWireframe(VIZ.sb, 'sb_viz', metric, year, lineColorPalette.secondary);
        symbolizeSvgWireframe(VIZ.nb, 'nb_viz', metric, year, lineColorPalette.primary);       
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
        symbolizeSvgWireframe(VIZ.sb, 'sb_viz', metric, year, lineColorPalette.secondary);
        symbolizeSvgWireframe(VIZ.nb, 'nb_viz', metric, year, lineColorPalette.primary);                
     });
    
    // (3c) On-change handler for sync_scrollbars checkbox
    // Synchronize or un-synchronize the scrollbars for the sb_viz and nb_viz <div>s
    // Documentation on the (very simple) syncscroll.js library may be found at:
    //      https://github.com/asvd/syncscroll
    // 
    // Note: This handler also arms the 'scroll' handler for the sb_viz and nb_viz divs,
    // as appropriate
    $('#sync_scrollbars').change(function(e) {
        var checked = $('#sync_scrollbars').prop('checked');
        var newName = checked ? 'syncMyScrollbar' : '';
        var elt = $('#nb_viz').get()[0];
        elt.setAttribute('name', newName);   
        elt =  $('#sb_viz').get()[0];
        elt.setAttribute('name', newName);
        syncscroll.reset();  
        // If checked, only arm the scroll event handler for one of the two main viz divs;
        // this will prevent duplicate calls to the handler.
        if (checked) {
            $('#sb_viz').scroll(function(e) { scrollHandler(e); });
        } else {
            $('#sb_viz,#nb_viz').scroll(function(e) { scrollHandler(e); });
        }
    });
    
    // (3d) On-scroll handler for scrollbars of the main view
    //
    // Synchronize the bounds of the Google Map with the elements in the relevant viewport
    function scrollHandler(e) {
        var container = $('#' + e.target.id);
        var contHeight = container.height();
        var contTop = container.scrollTop();
        var contBottom = contTop + contHeight;
        // console.log('top = ' + contTop + ' bottom = ' + contBottom);
        var elts = _.filter(DATA.sb_data, function(rec) { return rec.y1 >= contTop && rec.y2 <= contBottom; });       
        // Get the data_ids to search for in the GeoJSON; filter out HOV lanes and ramps
        var searchIds = _.pluck(elts, 'data_id');
        searchIds = _.filter(searchIds, function(id) { return  id.contains('hov') === false && id.startsWith('R') === false; });
        // Make a deep copy of the GeoJSON...
        var gj = Object.assign({}, DATA.geojson);
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
    }
    $('#sb_viz,#nb_viz').scroll(function(e) { scrollHandler(e); });
    
    ///////////////////////////////////////////////////////////////////////////////////////////////
    // Initialize stuff for 'comparison' view:
    //      1. SVG wireframes
    //      2. Event handlers for UI controls
    //          a. select_year_1 and select_year_2 combo boxes
    //          b. sync_*_scrollbars radio buttons
    //
    // (1) Initialize SVG wireframes:
    //      Southbound route, year 1 - default is 2018
    //      Southbound route, year 2 - default is 2010
    //      Northbound route, year 1 - default is 2018
    //      Northbound route, year 2 - default is 2010
    VIZ.sb_yr_1 = generateSvgWireframe(DATA.sb_data, 'sb_viz_yr_1', true, null);
    symbolizeSvgWireframe(VIZ.sb_yr_1, 'sb_viz_yr_1', 'awdt', '2018', lineColorPalette.secondary);
    VIZ.sb_yr_2 = generateSvgWireframe(DATA.sb_data, 'sb_viz_yr_2', true, null);
    symbolizeSvgWireframe(VIZ.sb_yr_2, 'sb_viz_yr_2', 'awdt', '2010', lineColorPalette.secondary);   
    VIZ.nb_yr_1 = generateSvgWireframe(DATA.nb_data, 'nb_viz_yr_1', false, null);  
    symbolizeSvgWireframe(VIZ.nb_yr_1, 'nb_viz_yr_1', 'awdt', '2018', lineColorPalette.primary);    
    VIZ.nb_yr_2 = generateSvgWireframe(DATA.nb_data, 'nb_viz_yr_2', false, null);  
    symbolizeSvgWireframe(VIZ.nb_yr_2, 'nb_viz_yr_2', 'awdt', '2010', lineColorPalette.primary);   

    // (2a) Arm event handlers for select_year_ and select_year_2 combo boxes
    $('#select_year_1').change(function(e) {
        var year_1 = $("#select_year_1 option:selected").attr('value');   
        var tmp = 'Southbound' + '&nbsp;' + year_1 + '&nbsp;AWDT&nbsp;' + '&darr;';
        $('#comp_caption_sb_yr_1').html(tmp);
        tmp = 'Northbound' + '&nbsp;' + year_1 + '&nbsp;AWDT&nbsp;' + '&uarr;';
        $('#comp_caption_nb_yr_1').html(tmp);
        symbolizeSvgWireframe(VIZ.sb_yr_1, 'sb_viz_yr_1', 'awdt', year_1,  lineColorPalette.secondary);  
        symbolizeSvgWireframe(VIZ.nb_yr_1, 'nb_viz_yr_1', 'awdt', year_1,  lineColorPalette.primary); 
    });
    $('#select_year_2').change(function(e) {
        var year_2 = $("#select_year_2 option:selected").attr('value');      
        var tmp = 'Southbound' + '&nbsp;' + year_2 + '&nbsp;AWDT&nbsp;' + '&darr;';
        $('#comp_caption_sb_yr_2').html(tmp);
        tmp = 'Northbound' + '&nbsp;' + year_2 + '&nbsp;AWDT&nbsp;' + '&uarr;';
        $('#comp_caption_nb_yr_2').html(tmp);     
        symbolizeSvgWireframe(VIZ.sb_yr_2, 'sb_viz_yr_2', 'awdt', year_2,  lineColorPalette.secondary);  
        symbolizeSvgWireframe(VIZ.nb_yr_2, 'nb_viz_yr_2', 'awdt', year_2,  lineColorPalette.primary);         
    }); 

    // (2b) Arm-change handlers for sync_*_scrollbars radio buttons
    // Documentation on the (very simple) syncscroll.js library may be found at:
    //      https://github.com/asvd/syncscroll
    $('.scroll_radio').on("click", function(e) {
        var checked = $('.scroll_radio:checked').val();
        var newName = (checked !== 'unsync_scrollbars') ? checked : '';
        var elt;
        switch(checked) {
        case "sync_all_scrollbars":
        case "unsync_scrollbars":
            elt = $('#nb_viz_yr_1').get()[0];
            elt.setAttribute('name', newName);   
            elt = $('#nb_viz_yr_2').get()[0];
            elt.setAttribute('name', newName);         
            elt =  $('#sb_viz_yr_1').get()[0];
            elt.setAttribute('name', newName);
            elt =  $('#sb_viz_yr_2').get()[0];
            elt.setAttribute('name', newName);            
            break;           
        case "sync_sb_scrollbars":
            elt = $('#nb_viz_yr_1').get()[0];
            elt.setAttribute('name', 'name_1');   
            elt = $('#nb_viz_yr_2').get()[0];
            elt.setAttribute('name', 'name_2');  
            elt =  $('#sb_viz_yr_1').get()[0];
            elt.setAttribute('name', newName);
            elt =  $('#sb_viz_yr_2').get()[0];
            elt.setAttribute('name', newName);             
            break;
        case "sync_nb_scrollbars":
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
            console.log("Unrecognized 'checked' value: " + checked);
            break;
        }      
        syncscroll.reset();  
    }); 
} // initializeApp()

// function: generateSvgWireframe
// parameters:
//      wireframe_data - data from CSV file containing data on layout of the 'wireframe'
//                       and the actual balanced volume data
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
// notes: This function generates three SVG structures, each contained within 
//        an SVG <g> element:
//          1. svgRouteSegs_g - <line> elements comprising the schematic 'wireframe'
//          2. svgVolumeText_g - <text> elements containing balanced volume numbers
//          3. svgLabelText_g - <text> and <tspan> elements containing descriptive 
//                              text about route segments
//
function generateSvgWireframe(wireframe_data, div_id, yDir_is_routeDir, handlers) {	
    var verticalPadding = 10;
    var width = 450;
    var height = d3.max([d3.max(wireframe_data, function(d) { return d.y1; }),
                         d3.max(wireframe_data, function(d) { return d.y2; })]) + verticalPadding; 
    
   var svgContainer = d3.select('#' + div_id)
        .append("svg")
            .attr("width", width)
            .attr("height", height);

    // The x-offset of the main barrel is 150 in the CSV wireframe layout data;
    // Given an SVG drawing area width of 450, translate x +75px to center the main barrel
    var svgRouteSegs_g = svgContainer
        .append("g")
            .attr("transform", "translate(75,0)");  
    
    // (1) 'wireframe' for the schematic route outline, consisting of SVG <line> elements
    //
    var svgRouteSegs = svgRouteSegs_g     
        .selectAll("line")
        .data(wireframe_data)
        .enter()
        .append("line")
            .attr("id", function(d, i) { return d.unique_id; })
            .attr("class", function(d, i) { 
                var retval = '';
                retval += 'volume_' + d.type; 
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
   var filtered_wireframe_data1 = _.filter(wireframe_data, function(rec) { return (rec.type != 'ramphov'); });
    var svgVolumeText_g = svgContainer
            .append("g")
            .attr("transform", "translate(75,0)");  
    var svgVolumeText = svgVolumeText_g
        .selectAll("text.vol_txt")
        .data(filtered_wireframe_data1)
        .enter()
        .append("text")
            .attr("id", function(d, i) { return 'vol_txt_' +d.unique_id; })
            .attr("class", function(d,i) {
                var retval = 'vol_txt';
                retval += ' ' + d.year_restriction;
                return retval;    
            })
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
    var filtered_wireframe_data2 = _.filter(wireframe_data, function(rec) { return (rec.showdesc === 1); });
    var svgLabelText_g = svgContainer.append("g");
    var svgLabelText = svgLabelText_g
        .selectAll("text.label_txt")
        .data(filtered_wireframe_data2)
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
        
    var retval = { lines : svgRouteSegs, volume_txt : svgVolumeText, label_txt_1 : line1, label_txt_2 : line2, label_txt_3: line3 };
    return retval;
} // generateSvgWireframe()

// colorPalettes - currently unused; currently no distinction between scales for 'absolute' vs. 'delta' metrics
var colorPalettes = {
    'awdt'  :   d3.scaleThreshold()
                    .domain([0, 25000, 50000, 75000, 100000, Infinity])
                    .range(["gray", "blue", "green", "yellow", "orange", "red"]),
    'hourly':   d3.scaleThreshold()
                    .domain([0, 2000, 4000, 6000, 8000, Infinity])
                    .range(["gray", "blue", "green", "yellow", "orange", "red"]),
    'cum'   :   d3.scaleThreshold()
                    .domain([0, 6000, 12000, 18000, 24000, Infinity])
                    .range(["gray", "blue", "green", "yellow", "orange", "red"]),    
};

var widthPalettes = {
    'absolute': {  
                    'awdt'  :   d3.scaleThreshold()
                                    .domain([0,       12500, 25000, 37500,   50000, 62500,   75000, 87500,    100000, 112500,   Infinity])
                                    .range(["0.5px",  "2px", "3px", "4.5px", "6px", "7.5px", "9px", "10.5px", "12px", "13.5px", "15px"]),
                    'hourly':   d3.scaleThreshold()
                                    .domain([0,      1000,  2000,  3000,    4000,  5000,    6000,  7000,     8000,   9000,     Infinity])
                                    .range(["0.5px", "2px", "3px", "4.5px", "6px", "7.5px", "9px", "10.5px", "12px", "13.5px", "15px"]),
                    // 3-hour cumulative
                    'cum'   :   d3.scaleThreshold()
                                    .domain([0,      3000,  6000,  9000,    12000, 15000,   18000, 21000,    24000,  27000,    Infinity])
                                    .range(["0.5px", "2px", "3px", "4.5px", "6px", "7.5px", "9px", "10.5px", "12px", "13.5px", "15px"])
                },       
    'delta':    {
                    'awdt'  :   d3.scaleThreshold()
                                    .domain([0,       2000,   4000,   8000,  10000,  12000,  14000,    16000, 18000,    20000,   Infinity])
                                    .range(["0.5px",  "2px", "3px", "4.5px", "6px", "7.5px", "9px", "10.5px", "12px", "13.5px", "15px"]), 
                    'hourly':   d3.scaleThreshold()
                                    .domain([0,       200,   400,     600,   800,     1000,  1200,   1400,    1600,     1800,   Infinity])
                                    .range(["0.5px", "2px", "3px", "4.5px", "6px", "7.5px", "9px", "10.5px", "12px", "13.5px", "15px"]),   
                    // 3-hour cumulative
                    'cum'   :   d3.scaleThreshold()
                                    .domain([0,       300,   600,     900,   1200,   1500,   1800,    2100,    2400,     2700,    Infinity])
                                    .range(["0.5px", "2px", "3px", "4.5px", "6px", "7.5px", "9px", "10.5px", "12px", "13.5px", "15px"])                                    
                }
};

// function: symbolizeSvgWireframe
// parameters:
//      vizWireframe : 'wireframe' of SVG <line> elements, and assocated <text> and <tspan> elements for labels
//      divId  : the ID of the <div> contaiing the SVG 'wireframe'
//      metric : the metric to be displayed, e.g., 'awdt' or '6_to_7_am' (6 - 7 am peak period volume)
//      year : may be either the string for a single year, e.g., "2018" or a string beginning with "delta", 
//             followed an underscore, and the strings for 2 years delimited by another underscore, e.g., "delta_2018_2010".
//             The former is self-explanatory; the latter indicates that a comparison of the data for the relevant metric for
//             the 2 years (first - last) is to be rendered.
//      color : the color to be used to render the SVG <line>s
// return value : none
function symbolizeSvgWireframe(vizWireframe, divId, metric, year, color) {
    // Given a 'logical' metric to symbolize (denoted by a 'metric' and 'logicalYear'
    // return the witdh palette to use for it
    function getWidthPalette(metric, logicalYear) {
        var base, retval;
        base = (logicalYear.startsWith('delta')) ? widthPalettes['delta'] : widthPalettes['absolute'];
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
    var attrName, widthPalette, colorPalette, tmp; 
    tmp = "I-93/SR-3&nbsp;-&nbsp;" + year;
    $('#central_caption').html(tmp);
    attrName = getAttrName(metric, year);
    // console.log('Symbolizing attribute; attrName = ' + attrName);
        
    widthPalette = getWidthPalette(metric, year); 
    vizWireframe.lines
        .style("stroke", function(d, i) { 
            var retval = color; 
            return retval;
        }) 
        .style("stroke-width", function(d, i) { 
            var retval = widthPalette(d[attrName]);
            // console.log('Segment: ' + d.unique_id + ' width = ' + retval);
            return retval;
        });
            
   vizWireframe.volume_txt
        // Textual display of NO DATA values should be blank
        .text(function(d, i) { 
            var retval;
            // Do not 'lablel':
            //     1. segments with NO DATA values (i.e., === -9999
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
    
    // Folderol to hide linework for HOV lane that's only present in the PM if the selected metric is for an AM time period,
    // and hide the linework for HOV lane that's only present in the AM if the selected metric is for a PM time period.
    $('.restriction_am_only').show();
    $('.restriction_pm_only').show();
    if (metric.endsWith('_am')) {
        $('#' + divId + ' .restriction_pm_only').hide();
    } else if (metric.endsWith('_pm')) {
        $('#' + divId + ' .restriction_am_only').hide();
    }

    vizWireframe.label_txt_1
        .text(function(d,i) { return d.description; });
    vizWireframe.label_txt_2
        .text(function(d,i) { return d.description2; });
    vizWireframe.label_txt_3
        .text(function(d,i) { return d.description3; });   
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

    // Show the main 'backbone' route on the map
    var nb_backbone = _.filter(data.geojson.features, function(rec) { return rec.properties['backbone_rte'] === 'i93_sr3_nb'; });
    nb_backbone = _.filter(nb_backbone, function(rec) { return rec.properties['yr_2010'] === 1; });
    nb_backbone = _.reject(nb_backbone, function(rec) { return rec.properties['data_id'].startsWith('R'); });
    nb_backbone = _.reject(nb_backbone, function(rec) { return rec.properties['data_id'].contains('hov'); });
    
    var sb_backbone = _.filter(data.geojson.features, function(rec) { return rec.properties['backbone_rte'] === 'i93_sr3_sb'; });
    sb_backbone = _.filter(sb_backbone, function(rec) { return rec.properties['yr_2010'] === 1; });
    sb_backbone = _.reject(sb_backbone, function(rec) { return rec.properties['data_id'].startsWith('R'); });
    sb_backbone = _.reject(sb_backbone, function(rec) { return rec.properties['data_id'].contains('hov'); });   
    
    // Create polyline features and add them to the map
    var style_nb = { strokeColor : lineColorPalette.primary, strokeOpacity : 1.0, strokeWeight: 1.5 },
        style_sb = { strokeColor : lineColorPalette.secondary, strokeOpacity : 1.0, strokeWeight: 1.5 };

    var i, pl;
    for (i = 0; i < nb_backbone.length; i++) {
        pl = ctpsGoogleMapsUtils.drawPolylineFeature(nb_backbone[i], map, style_nb, false);
    }
    for (i = 0; i < sb_backbone.length; i++) { 
        pl = ctpsGoogleMapsUtils.drawPolylineFeature(sb_backbone[i], map, style_sb, false); 
    }
    
    // Now pan/zoom map to the full extent of the route
    //
    // With credit to: https://stackoverflow.com/questions/32615267/zoom-on-google-maps-data-layer
    // Note that the GeoJSON data layer is being used simply to set the map extent;
    // it is rendered invisible due to the map.setStyle() call, below.
    map.data.addGeoJson(data.geojson);
    var bounds = new google.maps.LatLngBounds(); 
    map.data.forEach(function(feature){
        feature.getGeometry().forEachLatLng(function(latlng){
            bounds.extend(latlng);
        });
    });
    map.data.setStyle({ strokeWeight: 0, opacity: 1.0 });
    map.fitBounds(bounds);

/*  *** If we can ever get documetation on how to use the geojson-bbox library, the following call,
        or something similar to it should do the trick ...
    var bbox = bbox(data.geojson);
    var _DEBUG_HOOK = 0;
    map.fitBounds(bbox);
*/
} // initMap()
