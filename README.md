# balancedVolumes

This repository is devoted to the visualizations of balanced traffic volume data.

The raw balanced volume data and data used to generate a schematic visualization of the routes in question (currently I-93 northbound and southbound and Massachusetts SR-3 northbound and southbound) are found in the subdiretory data/csv. The balanced volume data for 2018 was produced by Bill Kuttner; the balanced volume data for 2010 and 199 was produced by Tom Lisco.

The geojson data representing the routes in question is found in the subdirectory data/geojson.

This application relies upon the following libraries that are not part of this repository:
1. jQuery version 2.2.4 (see https://jquery.com/)
2. d3.js version 4.5.0 (see https://d3js.org/)
3. underscore.js version 1.9.1 (see https://underscorejs.org/)
4. turf.js version 5.2.0 (see https://turfjs.org/)
5. es6string.js (see https://github.com/jabez128/es6string)
6. syncscroll.js version 0.0.3 (see https://github.com/asvd/syncscroll)
7. download.js version 4.2 (see http://danml.com/download.html)
8. jquery.scrollTo.js version 2.1.2 (see http://flesler.blogspot.com/2007/10/jqueryscrollto.html)
9. Google Maps JavaScript API version 3.x (see https://developers.google.com/maps/documentation/javascript/tutorial)
10. ctpsGoogleMapsUtils.js version 2.0 (see https://github.com/bkrepp-ctps/ctpsGoogleMapsUtils)

Several previous versions of this application relied upon a special version of the 'd3-tip' library that was originally 
written by Justin Palmer (http://github.com/Caged/d3-tip). This library was migrated to support D3 Version 4 by Constantin
Gavrilete (https://github.com/cgav/d3-tip). That version, however, relies upon ES6 features that are not supported by most
current (2019) browsers. It was modified by David Gotz (https://github.com/VACLab/d3-tip) to work in current browsers. 
That version was the baseline version used in previous versions of this app. 
The app was subsequently modified to use a simpler tooltip mechanism, eliminating the need for the special version of the
d3-tip library. The source file for this library (d3-tip-d3v4-VACLab-version.js), however, is being kept as part of this
repository should the need/want arise to build earlier versions of the app.
