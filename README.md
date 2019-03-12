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
6. Google Maps JavaScript API version 3.x
7. ctpsGoogleMapsUtils.js version 1.0
