let sync3DTo2DIsSyncing = false;

function getCesiumFOV() {
    if (typeof cesiumViewer !== 'undefined' && cesiumViewer && cesiumViewer.camera && cesiumViewer.camera.frustum) {
        const frustum = cesiumViewer.camera.frustum;
        if (frustum.fovy !== undefined && frustum.fovy !== null && !isNaN(frustum.fovy)) {
            return frustum.fovy;
        }
        if (frustum.fov !== undefined && frustum.fov !== null && !isNaN(frustum.fov)) {
            return frustum.fov;
        }
    }
    return Math.PI / 3;
}

function zoomToHeight(zoomLevel, lonlat, mapSize) {
    if (typeof zoomLevel === 'undefined' || zoomLevel === null) {
        return 15000;
    }
    const latitudeRadians = lonlat[1] * Math.PI / 180;
    const metersPerPixelAtEquator = 156543.03392;
    const cesiumFOV = getCesiumFOV();
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

function heightToZoom(cameraHeight, latitudeRadians, mapSize, mainView) {
    const metersPerPixelAtEquator = 156543.03392;
    const cesiumFOV = getCesiumFOV();
    const tanHalfFOV = Math.tan(cesiumFOV / 2);
    
    let viewportHeight = 512;
    if (mapSize && mapSize[0] > 0 && mapSize[1] > 0) {
        viewportHeight = mapSize[1];
    }
    
    const viewportHeightInMeters = cameraHeight * 2 * tanHalfFOV;
    const metersPerPixelAtCurrentHeight = viewportHeightInMeters / viewportHeight;
    const metersPerPixelAtZoom0 = metersPerPixelAtEquator * Math.cos(latitudeRadians);
    let targetZoom = Math.log2(metersPerPixelAtZoom0 / metersPerPixelAtCurrentHeight);
    
    let minZoom = 0;
    let maxZoom = 20;
    if (mainView) {
        const viewMinZoom = mainView.getMinZoom();
        const viewMaxZoom = mainView.getMaxZoom();
        if (viewMinZoom !== undefined && viewMinZoom !== null) {
            minZoom = viewMinZoom;
        }
        if (viewMaxZoom !== undefined && viewMaxZoom !== null) {
            maxZoom = viewMaxZoom;
        }
    }
    
    if (targetZoom < minZoom) {
        targetZoom = minZoom;
    }
    if (targetZoom > maxZoom) {
        targetZoom = maxZoom;
    }
    
    return targetZoom;
}

function sync3DTo2D({ cameraHeight, cameraPosition, map, mainView, is3DModeActive }) {
    if (sync3DTo2DIsSyncing) {
        return;
    }
    if (!is3DModeActive || typeof map === 'undefined' || !map || typeof mainView === 'undefined' || !mainView) {
        return;
    }
    
    const cameraLon = Cesium.Math.toDegrees(cameraPosition.longitude);
    const cameraLat = Cesium.Math.toDegrees(cameraPosition.latitude);
    const latitudeRadians = cameraPosition.latitude;
    const mapSize = map.getSize();
    const targetZoom = heightToZoom(cameraHeight, latitudeRadians, mapSize, mainView);
    
    const currentZoom = mainView.getZoom();
    const zoomDifference = Math.abs(targetZoom - currentZoom);
    
    if (zoomDifference > 0.01) {
        sync3DTo2DIsSyncing = true;
        const coordinate = ol.proj.fromLonLat([cameraLon, cameraLat]);
        mainView.animate({
            center: coordinate,
            zoom: targetZoom,
            duration: 300
        });
        setTimeout(function() {
            sync3DTo2DIsSyncing = false;
        }, 400);
    }
}
    