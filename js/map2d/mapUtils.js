function moveMap2D(lonlat, zoomLevel) {
    if (zoomLevel === undefined) {
        zoomLevel = 13;
    }
    const coordinate = ol.proj.fromLonLat(lonlat);
    mainView.animate({ center: coordinate, zoom: zoomLevel, duration: 700 });
}

function setMarker2D(lonlat) {
    const coord = ol.proj.fromLonLat(lonlat);
    if (activeMarker === null) {
        activeMarker = new ol.Feature(new ol.geom.Point(coord));
        activeMarker.setStyle(redMarkerStyle);
        activeMarker.set("type", "marker");
        activeMarker.set("lonlat", lonlat);
        citySource.addFeature(activeMarker);
    } else {
        activeMarker.getGeometry().setCoordinates(coord);
        activeMarker.set("lonlat", lonlat);
    }
}

function moveMap(lonlat, zoomLevel) {
    if (is3DModeActive) {
        if (typeof moveMap3D === 'function') {
            moveMap3D(lonlat, zoomLevel);
        }
    } else {
        moveMap2D(lonlat, zoomLevel);
    }
}

function setMarker(lonlat) {
    if (is3DModeActive) {
        if (typeof setMarker3D === 'function') {
            setMarker3D(lonlat);
        }
    } else {
        setMarker2D(lonlat);
    }
}


window.goCity = function(cityName) {
    const cityInfo = cityInfos[cityName];
    if (cityInfo) {
        moveMap(cityInfo.lonlat, 13);
        setMarker(cityInfo.lonlat);
        if (is3DModeActive) {
            if (cesiumActiveMarker) {
                blinkMarker(null, null);
            }
        } else {
            if (activeMarker) {
                blinkMarker(activeMarker, redMarkerStyle);
            }
        }
    }
};

window.goCityZoom = function(cityName) {
    const cityInfo = cityInfos[cityName];
    if (cityInfo) {
        const cityCoordinate = cityInfo.lonlat;
        moveMap(cityCoordinate, 16);
        setMarker(cityCoordinate);
        if (is3DModeActive) {
            if (cesiumActiveMarker) {
                blinkMarker(null, null);
            }
        } else {
            if (activeMarker) {
                blinkMarker(activeMarker, redMarkerStyle);
            }
        }
    }
};
