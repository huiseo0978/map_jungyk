function moveCesiumCamera(targetLonlat, targetHeight) {
    if (cesiumViewer && !cesiumViewer.isDestroyed()) {
        const destinationCartesian = Cesium.Cartesian3.fromDegrees(targetLonlat[0], targetLonlat[1], targetHeight);
        cesiumViewer.camera.flyTo({
            destination: destinationCartesian,
            duration: 0.5
        });
        setTimeout(function() {
            const actualHeight = cesiumViewer.camera.positionCartographic.height;
            if (Math.abs(actualHeight - targetHeight) > 1) {
                cesiumViewer.camera.setView({
                    destination: destinationCartesian,
                    orientation: {
                        heading: Cesium.Math.toRadians(0),
                        pitch: Cesium.Math.toRadians(-45),
                        roll: 0.0
                    }
                });
            }
        }, 1500);
    }
}

function moveMap3D(lonlat, zoomLevel) {
    if (cesiumViewer) {
        let targetHeight = DEFAULT_CAMERA_HEIGHT;
        if (zoomLevel !== undefined) {
            let mapSize = null;
            if (typeof map !== 'undefined' && map) {
                mapSize = map.getSize();
            }
            targetHeight = zoomToHeight(zoomLevel, lonlat, mapSize);
        }
        cesiumViewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(lonlat[0], lonlat[1], targetHeight),
            duration: 1.5
        });
    }
}
