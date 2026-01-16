function svgToDataUri(svgText) {
    return "data:image/svg+xml;utf8," + encodeURIComponent(svgText);
}

function formatCoordinate(lon, lat, precision = 4) {
    return lon.toFixed(precision) + "," + lat.toFixed(precision);
}

function getElementById(id) {
    return document.getElementById(id);
}

function querySelector(selector, parent = document) {
    return parent.querySelector(selector);
}

function querySelectorAll(selector, parent = document) {
    return parent.querySelectorAll(selector);
}

function blinkMarker(featureToBlink, styleToApply) {
    if (is3DModeActive) {
        if (cesiumActiveMarker) {
            if (markerBlinker) {
                clearInterval(markerBlinker);
            }
            let blinkCount = 0;
            let isVisible = true;
            markerBlinker = setInterval(function() {
                if (isVisible) {
                    isVisible = false;
                } else {
                    isVisible = true;
                }
                if (cesiumActiveMarker && cesiumActiveMarker.billboard) {
                    cesiumActiveMarker.billboard.show = isVisible;
                }
                blinkCount = blinkCount + 1;
                if (blinkCount >= BLINK_COUNT) {
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
        let blinkCount = 0;
        let isVisible = true;
        markerBlinker = setInterval(function() {
            if (isVisible) {
                isVisible = false;
            } else {
                isVisible = true;
            }
            if (isVisible) {
                featureToBlink.setStyle(styleToApply);
            } else {
                featureToBlink.setStyle(null);
            }
            blinkCount = blinkCount + 1;
            if (blinkCount >= BLINK_COUNT) {
                clearInterval(markerBlinker);
                markerBlinker = null;
                featureToBlink.setStyle(styleToApply);
            }
        }, BLINK_INTERVAL);
    }
}
