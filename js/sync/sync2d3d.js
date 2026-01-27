(function() {
var sync3DTo2DIsSyncing = false;
var isSyncingZoom = false;

function getCesiumFOV() {
    if (cesiumViewer && cesiumViewer.camera && cesiumViewer.camera.frustum) {
        var frustum = cesiumViewer.camera.frustum;
        if (frustum.fovy != null && typeof frustum.fovy === 'number' && frustum.fovy > 0) {
            return frustum.fovy;
        }
        if (frustum.fov != null && typeof frustum.fov === 'number' && frustum.fov > 0) {
            return frustum.fov;
        }
    }
    return Math.PI / 3;
}

function zoomToHeight(zoomLevel, lonlat, mapSize) {
    if (zoomLevel == null) {
        return DEFAULT_CAMERA_HEIGHT;
    }
    var lat = lonlat[1] * Math.PI / 180;
    var fov = getCesiumFOV();
    var tanFOV = Math.tan(fov / 2);
    
    var vh = DEFAULT_VIEWPORT_HEIGHT;
    if (mapSize && mapSize[1] > 0) {
        vh = mapSize[1];
    }
    
    var mpp = METERS_PER_PIXEL_AT_EQUATOR * Math.cos(lat) / Math.pow(2, zoomLevel);
    var vhMeters = mpp * vh;
    var height = vhMeters / (2 * tanFOV);
    
    if (height < MIN_CAMERA_HEIGHT) {
        return MIN_CAMERA_HEIGHT;
    }
    if (height > MAX_CAMERA_HEIGHT) {
        return MAX_CAMERA_HEIGHT;
    }
    return height;
}

function heightToZoom(cameraHeight, latRad, mapSize, mainView) {
    if (cameraHeight == null || !isFinite(cameraHeight) || cameraHeight <= 0) {
        return DEFAULT_ZOOM_LEVEL;
    }
    
    if (latRad == null || !isFinite(latRad)) {
        return DEFAULT_ZOOM_LEVEL;
    }
    
    var fov = getCesiumFOV();
    if (!isFinite(fov) || fov <= 0) {
        return DEFAULT_ZOOM_LEVEL;
    }
    
    var tanFOV = Math.tan(fov / 2);
    if (!isFinite(tanFOV) || tanFOV <= 0) {
        return DEFAULT_ZOOM_LEVEL;
    }
    
    var vh = DEFAULT_VIEWPORT_HEIGHT;
    if (mapSize && mapSize[0] > 0 && mapSize[1] > 0) {
        vh = mapSize[1];
    }
    if (!isFinite(vh) || vh <= 0) {
        return DEFAULT_ZOOM_LEVEL;
    }
    
    var cosLat = Math.cos(latRad);
    if (!isFinite(cosLat) || cosLat <= COS_LAT_THRESHOLD) {
        return DEFAULT_ZOOM_LEVEL;
    }
    
    var numerator = METERS_PER_PIXEL_AT_EQUATOR * cosLat * vh;
    if (!isFinite(numerator) || numerator <= 0) {
        return DEFAULT_ZOOM_LEVEL;
    }
    
    var denominator = cameraHeight * 2 * tanFOV;
    if (!isFinite(denominator) || denominator <= 0) {
        return DEFAULT_ZOOM_LEVEL;
    }
    
    var ratio = numerator / denominator;
    if (!isFinite(ratio) || ratio <= 0) {
        return DEFAULT_ZOOM_LEVEL;
    }
    
    var zoom = Math.log2(ratio);
    if (!isFinite(zoom)) {
        return DEFAULT_ZOOM_LEVEL;
    }
    
    var minZ = 0;
    var maxZ = 20;
    if (mainView) {
        var vMin = mainView.getMinZoom();
        var vMax = mainView.getMaxZoom();
        if (vMin != null) {
            minZ = vMin;
        }
        if (vMax != null) {
            maxZ = vMax;
        }
    }
    
    if (zoom < minZ) {
        zoom = minZ;
    }
    if (zoom > maxZ) {
        zoom = maxZ;
    }
    
    return zoom;
}


function sync3DTo2D(params) {
    if (!params || typeof params != 'object') {
        return;
    }
    
    var height = params.cameraHeight;
    var pos = params.cameraPosition;
    var map = params.map;
    var view = params.mainView;
    var is3D = params.is3DModeActive;
    
    if (sync3DTo2DIsSyncing) {
        return;
    }

    if (!is3D || !map || !view) {
        return;
    }
    if (!pos || height == null) {
        return;
    }
    
    var lon = Cesium.Math.toDegrees(pos.longitude);
    var lat = Cesium.Math.toDegrees(pos.latitude);
    var latRad = pos.latitude;
    var size = map.getSize();
    var targetZoom = heightToZoom(height, latRad, size, view);
    
    var currentZoom = view.getZoom();
    var zoomDiff = Math.abs(targetZoom - currentZoom);
    
    var currentCenter = view.getCenter();
    var targetCoord = ol.proj.fromLonLat([lon, lat]);
    var centerDiffMeters = 0;
    if (currentCenter) {
        var dx = targetCoord[0] - currentCenter[0];
        var dy = targetCoord[1] - currentCenter[1];
        centerDiffMeters = Math.sqrt(dx * dx + dy * dy);
    } else {
        centerDiffMeters = CENTER_SYNC_DISTANCE_THRESHOLD_METERS + 1;
    }
    
    if (zoomDiff > ZOOM_DIFFERENCE_THRESHOLD || centerDiffMeters > CENTER_SYNC_DISTANCE_THRESHOLD_METERS) {
        sync3DTo2DIsSyncing = true;
        view.animate({
            center: targetCoord,
            zoom: targetZoom,
            duration: ANIMATION_DURATION
        });
        setTimeout(function() {
            sync3DTo2DIsSyncing = false;
        }, SYNC_DELAY);
    }
}

function sync2DTo3D(params) {
    if (!params || typeof params != 'object') {
        return;
    }
    
    var lonlat = params.lonlat;
    var targetHeight = params.targetHeight;
    var cesiumViewer = params.cesiumViewer;
    var is3D = params.is3DModeActive;
    
    if (isSyncingZoom) {
        return;
    }

    if (!is3D || !cesiumViewer) {
        return;
    }
    if (!lonlat || targetHeight == null) {
        return;
    }
    
    isSyncingZoom = true;
    cesiumViewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lonlat[0], lonlat[1], targetHeight),
        duration: 0.3
    });
    setTimeout(function() {
        isSyncingZoom = false;
    }, SYNC_DELAY);
}

function getIsSyncingZoom() {
    return isSyncingZoom;
}

window.sync3DTo2D = sync3DTo2D;
window.sync2DTo3D = sync2DTo3D;
window.getIsSyncingZoom = getIsSyncingZoom;
window.zoomToHeight = zoomToHeight;
window.heightToZoom = heightToZoom;
})();
