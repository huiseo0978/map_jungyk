function zoomToHeight(zoomLevel, lonlat, mapSize) {
    const latitudeRadians = lonlat[1] * Math.PI / 180;
    const metersPerPixelAtEquator = 156543.03392;
    const cesiumFOV = Math.PI / 3;
    const tanHalfFOV = Math.tan(cesiumFOV / 2);
    
    let viewportHeight = 512;
    if (mapSize && mapSize[1] > 0) {
        viewportHeight = mapSize[1];
    }
    
    const metersPerPixel = metersPerPixelAtEquator * Math.cos(latitudeRadians) / Math.pow(2, zoomLevel);
    const viewportHeightInMeters = metersPerPixel * viewportHeight;
    const calculatedHeight = viewportHeightInMeters / (2 * tanHalfFOV);
    
    if (calculatedHeight < 100) {
        return 100;
    } else if (calculatedHeight > 40000000) {
        return 40000000;
    } else {
        return calculatedHeight;
    }
}

function heightToZoom(cameraHeight, latitudeRadians, mapSize) {
    const metersPerPixelAtEquator = 156543.03392;
    const cesiumFOV = Math.PI / 3;
    const tanHalfFOV = Math.tan(cesiumFOV / 2);
    
    let viewportHeight = 512;
    if (mapSize && mapSize[0] > 0 && mapSize[1] > 0) {
        viewportHeight = mapSize[1];
    }
    
    const viewportHeightInMeters = cameraHeight * 2 * tanHalfFOV;
    const metersPerPixelAtCurrentHeight = viewportHeightInMeters / viewportHeight;
    const metersPerPixelAtZoom0 = metersPerPixelAtEquator * Math.cos(latitudeRadians);
    let targetZoom = Math.log2(metersPerPixelAtZoom0 / metersPerPixelAtCurrentHeight);
    
    if (targetZoom < 0) {
        targetZoom = 0;
    }
    if (targetZoom > 20) {
        targetZoom = 20;
    }
    
    return targetZoom;
}

function sync3DTo2D(cameraHeight, cameraPosition) {
    if (isSyncingZoom) {
        return;
    }
    if (!is3DModeActive || typeof map === 'undefined' || !map || typeof mainView === 'undefined' || !mainView) {
        return;
    }
    
    const cameraLon = Cesium.Math.toDegrees(cameraPosition.longitude);
    const cameraLat = Cesium.Math.toDegrees(cameraPosition.latitude);
    const latitudeRadians = cameraPosition.latitude;
    const mapSize = map.getSize();
    const targetZoom = heightToZoom(cameraHeight, latitudeRadians, mapSize);
    
    const currentZoom = mainView.getZoom();
    const zoomDifference = Math.abs(targetZoom - currentZoom);
    
    if (zoomDifference > 0.01) {
        isSyncingZoom = true;
        const coordinate = ol.proj.fromLonLat([cameraLon, cameraLat]);
        mainView.animate({
            center: coordinate,
            zoom: targetZoom,
            duration: 300
        });
        setTimeout(function() {
            isSyncingZoom = false;
        }, 400);
    }
}
