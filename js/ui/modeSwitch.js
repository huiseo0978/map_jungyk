function toggle3D(is3DEnabled) {
    is3DModeActive = is3DEnabled;
    const mapElement = document.getElementById("map");
    const cesiumContainerElement = document.getElementById("cesiumContainer");

    if (is3DEnabled) {
        let targetLonlat = mapCenter;
        let targetHeight = DEFAULT_CAMERA_HEIGHT;
        
        if (map && mainView) {
            const currentCenter = mainView.getCenter();
            if (currentCenter) {
                targetLonlat = ol.proj.toLonLat(currentCenter);
            }
            const currentZoom = mainView.getZoom();
            if (currentZoom !== undefined && currentZoom !== null) {
                last2DZoomLevel = currentZoom;
                const mapSize = map.getSize();
                targetHeight = zoomToHeight(currentZoom, targetLonlat, mapSize);
            }
        }
        
        if (cesiumViewer === null) {
            initializeCesiumViewer(targetLonlat, targetHeight);
        }
        
        createCesiumCityEntities();
        
        moveCesiumCamera(targetLonlat, targetHeight);
        
        if (cesiumViewer) {
            if (typeof setupCesiumEvents === 'function') {
                setupCesiumEvents();
            }
            
            if (typeof setupCesiumEventCoordination === 'function') {
                setupCesiumEventCoordination();
            }
            
            if (typeof convertMeasureResultsTo3D === 'function') {
                convertMeasureResultsTo3D();
            }
            if (typeof convertAreaResultsTo3D === 'function') {
                convertAreaResultsTo3D();
            }
        }
        
        if (mapElement) {
            mapElement.style.display = "none";
        }
        if (cesiumContainerElement) {
            cesiumContainerElement.style.display = "block";
        }
    }
    
    if (!is3DEnabled) {
        if (typeof teardownCesiumEvents === 'function') {
            teardownCesiumEvents();
        }
        
        if (window.__cesiumEventCoordinationSetup) {
            window.__cesiumEventCoordinationSetup = false;
        }
        
        let targetLonlat = mapCenter;
        let targetZoom = DEFAULT_ZOOM_LEVEL;
        
        if (cesiumViewer) {
            const cameraPosition = cesiumViewer.camera.positionCartographic;
            targetLonlat = [
                Cesium.Math.toDegrees(cameraPosition.longitude),
                Cesium.Math.toDegrees(cameraPosition.latitude)
            ];
            
            if (last2DZoomLevel !== null && last2DZoomLevel !== undefined) {
                targetZoom = last2DZoomLevel;
            } else {
                const cameraHeight = cameraPosition.height;
                const latitudeRadians = cameraPosition.latitude;
                const mapSize = map.getSize();
                targetZoom = heightToZoom(cameraHeight, latitudeRadians, mapSize, mainView);
            }
        }
        
        if (cesiumContainerElement) {
            cesiumContainerElement.style.display = "none";
        }
        if (mapElement) {
            mapElement.style.display = "block";
            map.updateSize();
            if (map && mainView) {
                const coordinate = ol.proj.fromLonLat(targetLonlat);
                mainView.setCenter(coordinate);
                mainView.setZoom(targetZoom);
                setTimeout(function() {
                    const actualZoom = mainView.getZoom();
                    if (Math.abs(actualZoom - targetZoom) > ZOOM_DIFFERENCE_THRESHOLD) {
                        mainView.setZoom(targetZoom);
                    }
                }, 500);
            }
        }
        
        if (typeof convertMeasureResultsTo2D === 'function') {
            convertMeasureResultsTo2D();
        }
        if (typeof convertAreaResultsTo2D === 'function') {
            convertAreaResultsTo2D();
        }
    }
}

const modeSwitch = document.getElementById("modeSwitch");
if (modeSwitch) {
    modeSwitch.onchange = function() {
        toggle3D(this.checked);
    };
}

const inputLongitudeElement = document.getElementById("inputLongitude");
if (inputLongitudeElement) {
    inputLongitudeElement.addEventListener("input", function() {
        let currentValue = parseFloat(this.value);
        if (!isNaN(currentValue)) {
            if (currentValue < -180) {
                this.value = -180;
            } else if (currentValue > 180) {
                this.value = 180;
            }
        }
    });
    inputLongitudeElement.addEventListener("change", function() {
        let currentValue = parseFloat(this.value);
        if (!isNaN(currentValue)) {
            if (currentValue < -180) {
                this.value = -180;
            } else if (currentValue > 180) {
                this.value = 180;
            } else {
                this.value = Math.round(currentValue * 100) / 100;
            }
        }
    });
    inputLongitudeElement.addEventListener("blur", function() {
        let currentValue = parseFloat(this.value);
        if (!isNaN(currentValue)) {
            if (currentValue < -180) {
                this.value = -180;
            } else if (currentValue > 180) {
                this.value = 180;
            } else {
                this.value = Math.round(currentValue * 100) / 100;
            }
        }
    });
}

const inputLatitudeElement = document.getElementById("inputLatitude");
if (inputLatitudeElement) {
    inputLatitudeElement.addEventListener("input", function() {
        let currentValue = parseFloat(this.value);
        if (!isNaN(currentValue)) {
            if (currentValue < -90) {
                this.value = -90;
            } else if (currentValue > 90) {
                this.value = 90;
            }
        }
    });
    inputLatitudeElement.addEventListener("change", function() {
        let currentValue = parseFloat(this.value);
        if (!isNaN(currentValue)) {
            if (currentValue < -90) {
                this.value = -90;
            } else if (currentValue > 90) {
                this.value = 90;
            } else {
                this.value = Math.round(currentValue * 100) / 100;
            }
        }
    });
    inputLatitudeElement.addEventListener("blur", function() {
        let currentValue = parseFloat(this.value);
        if (!isNaN(currentValue)) {
            if (currentValue < -90) {
                this.value = -90;
            } else if (currentValue > 90) {
                this.value = 90;
            } else {
                this.value = Math.round(currentValue * 100) / 100;
            }
        }
    });
}
