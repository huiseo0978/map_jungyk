function svgToDataUri(svg) {
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

function formatCoordinate(lon, lat) {
    var p = 4;
    if (arguments.length > 2) {
        p = arguments[2];
    }
    return lon.toFixed(p) + "," + lat.toFixed(p);
}

function getElementById(id) {
    return document.getElementById(id);
}

function querySelector(sel, parent) {
    if (!parent) {
        parent = document;
    }
    return parent.querySelector(sel);
}

function querySelectorAll(sel, parent) {
    if (!parent) {
        parent = document;
    }
    return parent.querySelectorAll(sel);
}

function blinkMarker(feature, style) {
    if (is3DModeActive) {
        if (cesiumActiveMarker) {
            if (markerBlinker) {
                clearInterval(markerBlinker);
            }
            var count = 0;
            var visible = true;
            markerBlinker = setInterval(function() {
                visible = !visible;
                if (cesiumActiveMarker && cesiumActiveMarker.billboard) {
                    cesiumActiveMarker.billboard.show = visible;
                }
                count++;
                if (count >= BLINK_COUNT) {
                    clearInterval(markerBlinker);
                    markerBlinker = null;
                    if (cesiumActiveMarker && cesiumActiveMarker.billboard) {
                        cesiumActiveMarker.billboard.show = true;
                    }
                }
            }, BLINK_INTERVAL);
        }
    } else {
        if (markerBlinker) {
            clearInterval(markerBlinker);
        }
        var count = 0;
        var visible = true;
        markerBlinker = setInterval(function() {
            visible = !visible;
            if (visible) {
                feature.setStyle(style);
            } else {
                feature.setStyle(null);
            }
            count++;
            if (count >= BLINK_COUNT) {
                clearInterval(markerBlinker);
                markerBlinker = null;
                feature.setStyle(style);
            }
        }, BLINK_INTERVAL);
    }
}
