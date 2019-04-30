# balancedVolumes

This repository is devoted to the visualizations of balanced traffic volume data.

The raw balanced volume data and data used to generate a schematic visualization of the routes in question (currently I-93 northbound and southbound and Massachusetts SR-3 northbound and southbound) are found in the subdiretory data/csv. The balanced volume data itself was produced by Bill Kuttner.

The geojson data representing the routes in question is found in the subdirectory data/geojson.

This application relies upon the following libraries that are not part of this repository:
1. jQuery version 2.2.4
2. jQueryUI version 1.12.1
3. d3.js version 4.5.0
4. underscore.js version 1.9.1
5. turf.js version 5.2.0
6. es6string.js (downloaded from Mozilla.org)
7. Google Maps JavaScript API version 3.x
8. ctpsGoogleMapsUtils.js version 1.0

NOTE: This application relies upon a special vesrion of the 'd3-tip' library that was originally 
written by Justin Palmer (http://github.com/Caged/d3-tip). This library was migrated to support D3
Version 4 by (Constantin Gavrilete)  https://github.com/cgav/d3-tip. That version, however, relies
upon ES6 features that are not supported by most current (2019) browsers. It was modified by
David Gotz (https://github.com/VACLab/d3-tip) to work in current browsers. That version is the
baseline version used in this app. It is TBD whether it will require further customization for
this application.
