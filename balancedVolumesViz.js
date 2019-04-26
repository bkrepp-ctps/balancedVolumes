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
// Primary-direction (northbound or eastbound) and secondary-direction (southbound or westbound) 
// polyline features on GoogleMap
aPolylines_PrimDir = [], aPolylines_SecDir = [];
polylineColorPalette = { 'primary' : '#f5831a', 'secondary' : '#0066b4' };

// Experimentation ...
var tip = d3.tip()
    .attr('class', 'd3-tip')
    .html(function(d, i) { 
        var _DEBUG_HOOK = 0;
        return 'Hello world! <br> I am ' + d.data_id; 
    });
tip.direction(function(d, i) { return 'n'; });
        
/*
tip.offset(function(d, i) {
    // return [this.getBBox().height / 2, 0];
    return [10,-10];
});
*/

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
        rec.showdesc = +rec.showdesc;
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
    VIZ.sb = generateSvgWireframe(DATA.sb_wireframe, 'sb_viz', true, 0 /* placeholder for now */);
    symbolizeSvgWireframe(VIZ.sb, 'awdt', '2018', polylineColorPalette.secondary);
    // Generate wireframe for northbound route
    VIZ.nb = generateSvgWireframe(DATA.nb_wireframe, 'nb_viz', false, 0 /* placeholder for now */);  
    symbolizeSvgWireframe(VIZ.nb, 'awdt', '2018', polylineColorPalette.primary);    
    
    // Initialize Google Map
    initMap(DATA); // No need to pass DATA as parm, but doing so anyway  

    // Arm event handler for combo boxes
    $('.app_select_box').change(function(e) {
        var metric = $("#select_metric option:selected").attr('metric');
        var year = $("#select_year option:selected").attr('year');
        symbolizeSvgWireframe(VIZ.sb, metric, year, polylineColorPalette.secondary);
        symbolizeSvgWireframe(VIZ.nb, metric, year, polylineColorPalette.primary);
        var _DEBUG_HOOK = 0;
    });
} // initializeApp

// function: generateSvgWireframe
// parameters:
//      wireframe_data - data from CSV file containing data on layout of the 'wireframe'
//                       and the actual balanced volume data
//      div_id - the ID of the HTML <div> into which to place the SVG elements
//      yDir_is_routeDir - boolean flag indicating whether the route travels in the same
//                         direction as increasing Y-values in the SVG space;
//                         used to determine which end of SVG <line> elements for
//                         ramps corresponds to the 'end' (i.e., tip) of the ramp
//      year - not yet used
function generateSvgWireframe(wireframe_data, div_id, yDir_is_routeDir, year) {	
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
    
    // 'wireframe' for the schematic route outline, consisting of SVG <line> elements
    //
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
            .call(tip)
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
                    if (lineFeature.properties.backbone_rte === "i93_sr3_nb") {
                        // Clear any 'northbound' polylines on the map
                        aPolylines_PrimDir.forEach(function(pl) { pl.setMap(null); });  
                        color = polylineColorPalette.primary;
                    } else if (lineFeature.properties.backbone_rte === "i93_sr3_sb")  {
                        // Clear any 'southbound' polylines on the map
                        aPolylines_SecDir.forEach(function(pl) { pl.setMap(null); });  
                        color = polylineColorPalette.secondary;
                    } else {
                        return;
                    }    
                    // Create polyline feature and add it to the map
                    var style = { strokeColor : color, strokeOpacity : 0.7, strokeWeight: 4.5 }
                    var polyline = ctpsGoogleMapsUtils.drawPolylineFeature(lineFeature, map, style);
                    if (lineFeature.properties.backbone_rte === "i93_sr3_nb") {
                        aPolylines_PrimDir.push(polyline);
                    } else {
                        aPolylines_SecDir.push(polyline);
                    }
                    // Now pan/zoom map to selected feature
                    var bbox = turf.bbox(lineFeature);
                    // Return value of turf.bbox() has the form: [minX, minY, maxX, maxY]
                    // Morph this into a form Google Maps can digest
                    var googleBounds = new google.maps.LatLngBounds();
                    googleBounds.extend({ lat : bbox[1], lng : bbox[0] });
                    googleBounds.extend({ lat : bbox[3], lng : bbox[2] });
                    map.fitBounds(googleBounds);
                })
            .on('mouseover', function(d, i) {
                tip.show(d, i);
            })
            .on('mouseout', function(d, i) {
                tip.hide(d, i);
            });
                  
    // Append SVG rect element for tooltip content  
/*    
    svgContainer.append('rect')
       .attr('width', 200)
       .attr('height', 200);
 */      

    var mainline_xOffset = 150;
    var volumeText_xOffset = 250;
    
    // SVG <text> elements for the balanced volume data itself
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

    // SVG <text> and <tspan> elements for descriptive labels, e.g., "Interchange X off-ramp to Y"
    // These are only applied for certain records in the input data, essentially interchange on/off ramps
    var filtered_wireframe_data2 = _.filter(wireframe_data, function(rec) { return (rec.showdesc === 1); });
    var svgLabelText_g = svgContainer.append("g");
    var svgLabelText = svgLabelText_g
        .selectAll("text.label_txt")
        .data(filtered_wireframe_data2)
        .enter()
        .append("text")
            .attr("id", function(d, i) { return 'label_txt_' + d.unique_id; })
            .attr("class", "label_text")
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
        .attr("class", "label_tspan_1")
        .text(''); // Placeholder     
    // Second line of descriptive label text
    var line2 = svgLabelText.append("tspan")
        .attr("class", "label_tspan_2")
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
            
    var retval = { lines : svgRouteSegs, volume_txt : svgVolumeText, label_txt_1 : line1, label_txt_2 : line2 };
    return retval;
} // generateSvgWireframe()

var colorPalettes = {
    'awdt'  :   d3.scaleThreshold()
                    .domain([0, 25000, 50000, 75000, 100000, Infinity])
                    .range(["gray", "blue", "green", "yellow", "orange", "red"]),
    'hourly':   d3.scaleThreshold()
                    .domain([0, 2000, 4000, 6000, 8000, Infinity])
                    .range(["gray", "blue", "green", "yellow", "orange", "red"])
};
// For the time being, we will use a 6px width in all cases
var widthPalettes = {
    'awdt'  :   d3.scaleThreshold()
                    .domain([0,       12500, 25000, 37500,   50000, 62500,   75000, 87500,    100000, 112500,   Infinity])
                    .range(["0.5px",  "2px", "3px", "4.5px", "6px", "7.5px", "9px", "10.5px", "12px", "13.5px", "15px"]),
    'hourly':   d3.scaleThreshold()
                    .domain([0,      1000,  2000,  3000,    4000,  5000,    6000,  7000,     8000,   9000,     Infinity])
                    .range(["0.5px", "2px", "3px", "4.5px", "6px", "7.5px", "9px", "10.5px", "12px", "13.5px", "15px"])
};

// function: symbolizeSvgWireframe
// parameters:
//      vizWireframe : 'wireframe' of SVG <line> elements, as well as assocated <text. and <tspan> elements for labels
//      metric : the metric to be displayed, e.g., 'awdt' or '6_to_7_am' (6 - 7 am peak period volume)
//      year : may be either the string for a single year, e.g., "2018" or a string beginning with "delta", 
//             followed an underscore, and the strings for 2 years delimited by another underscore, e.g., "delta_2018_2010".
//             The former is self-explanatory; the latter indicates that a comparison of the data for the relevant metric for
//             the 2 years (first - last) is to be rendered.
//      color : the color to be used to render the SVG <line>s
//  return value : none
function symbolizeSvgWireframe(vizWireframe, metric, year, color) {
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
    
    var attrName1, attrName2, parts, year1, year2, colorPalette, widthPalette;    // colorPalette now ignored
    
    // Bifurcated world - there HAS to be a more elegant way to do this...
    if (year.includes('delta')) {
        // Data value to be displayed is the difference (delta) between two values in the table, i.e., needs to be computed
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
            colorPalette = colorPalettes.awdt;      // Now ignored
            widthPalette = widthPalettes.awdt;
        } else {
            colorPalette = colorPalettes.hourly;    // Now ignored
            widthPalette = widthPalettes.hourly;        
        } 
        vizWireframe.lines
            .style("stroke", function(d, i) { 
                // var retval = colorPalette(d[attrName1] - d[attrName2]);
                var retval = color;
                return retval;
            }) 
            .style("stroke-width", function(d, i) {
                var retval;
                retval = widthPalette(d[attrName1] - d[attrName2]);
                // console.log('Segment: ' + d.unique_id + ' width = ' + retval);
                return retval;
            });
            
       vizWireframe.volume_txt
            // Textual display of NO DATA values should be blank
            .text(function(d, i) { 
                var retval;
                // Do not 'lablel':
                //     1. segments with NO DATA values (i.e., <= 0)
                //     2. segments with type 'ramphov'
                if (d[attrName1] <= 0 || d[attrName2] <= 0  || d.type == 'ramphov') {         // *** This statement needs attention
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
            widthPalette = widthPalettes.awdt;      // Now ignored
        } else {
            colorPalette = colorPalettes.hourly;    // Now ignored
            widthPalette = widthPalettes.hourly;        
        }    
        vizWireframe.lines
            .style("stroke", function(d, i) { 
                var retval = color;
                // return colorPalette(d[attrName1]); 
                return retval;
            }) 
            .style("stroke-width", function(d, i) { 
                var retval = widthPalette(d[attrName1]);
                // console.log('Segment: ' + d.unique_id + ' width = ' + retval);
                return retval;
            });
            
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
