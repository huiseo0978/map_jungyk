function toggle3D(is3DEnabled) {
    isSyncingZoom = true;
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
            for (let resultIndex = 0; resultIndex < measureResultsArray.length; resultIndex = resultIndex + 1) {
                const currentItem = measureResultsArray[resultIndex];
                if (currentItem && !currentItem.isPoint && currentItem.pointsArray) {
                    if (currentItem.feature && currentItem.pointFeatures) {
                        if (currentItem.feature) {
                            measureSource.removeFeature(currentItem.feature);
                        }
                        if (currentItem.pointFeatures) {
                            for (let featureIndex = 0; featureIndex < currentItem.pointFeatures.length; featureIndex = featureIndex + 1) {
                                const currentFeature = currentItem.pointFeatures[featureIndex];
                                if (currentFeature) {
                                    measureSource.removeFeature(currentFeature);
                                }
                            }
                        }
                    }
                    if (currentItem.feature && currentItem.pointEntities) {
                        if (currentItem.feature) {
                            try {
                                cesiumViewer.entities.remove(currentItem.feature);
                            } catch (error) {
                            }
                        }
                        if (currentItem.labelEntity) {
                            try {
                                cesiumViewer.entities.remove(currentItem.labelEntity);
                            } catch (error) {
                            }
                        }
                        if (currentItem.pointEntities) {
                            for (let entityIndex = 0; entityIndex < currentItem.pointEntities.length; entityIndex = entityIndex + 1) {
                                const currentEntity = currentItem.pointEntities[entityIndex];
                                if (currentEntity) {
                                    try {
                                        cesiumViewer.entities.remove(currentEntity);
                                    } catch (error) {
                                    }
                                }
                            }
                        }
                    }
                    
                    if (currentItem.pointsArray && currentItem.pointsArray.length >= 2) {
                        
                        const positionsArrayFor3D = [];
                        const pointEntitiesArrayFor3D = [];
                        for (let pointIndex = 0; pointIndex < currentItem.pointsArray.length; pointIndex = pointIndex + 1) {
                            const currentPointLonLat = currentItem.pointsArray[pointIndex];
                            const cartographicPosition = Cesium.Cartographic.fromDegrees(currentPointLonLat[0], currentPointLonLat[1]);
                            const cartesianPosition = Cesium.Cartesian3.fromRadians(cartographicPosition.longitude, cartographicPosition.latitude);
                            positionsArrayFor3D.push(cartesianPosition);
                            
                            const pointEntity = cesiumViewer.entities.add({
                                position: cartesianPosition,
                                point: {
                                    pixelSize: 12,
                                    color: Cesium.Color.BLUE.withAlpha(0.8),
                                    outlineColor: Cesium.Color.WHITE,
                                    outlineWidth: 2,
                                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                                }
                            });
                            pointEntitiesArrayFor3D.push(pointEntity);
                        }
                        
                        let polylineEntityFor3D = null;
                        let labelEntityFor3D = null;
                        if (positionsArrayFor3D.length >= 2) {
                            polylineEntityFor3D = cesiumViewer.entities.add({
                                polyline: {
                                    positions: positionsArrayFor3D,
                                    width: 3,
                                    material: Cesium.Color.BLUE.withAlpha(0.8),
                                    clampToGround: true
                                }
                            });
                            
                            const lastPosition = positionsArrayFor3D[positionsArrayFor3D.length - 1];
                            const distanceText = currentItem.text;
                            labelEntityFor3D = cesiumViewer.entities.add({
                                position: lastPosition,
                                label: {
                                    text: distanceText,
                                    font: '12px sans-serif',
                                    fillColor: Cesium.Color.WHITE,
                                    outlineColor: Cesium.Color.BLACK,
                                    outlineWidth: 2,
                                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                                    pixelOffset: new Cesium.Cartesian2(0, -40),
                                    disableDepthTestDistance: Number.POSITIVE_INFINITY
                                }
                            });
                        }
                        
                        currentItem.feature = polylineEntityFor3D;
                        currentItem.pointFeatures = null;
                        currentItem.pointEntities = pointEntitiesArrayFor3D;
                        currentItem.labelEntity = labelEntityFor3D;
                    }
                }
            }
            
            for (let resultIndex = 0; resultIndex < areaResultsArray.length; resultIndex = resultIndex + 1) {
                const currentItem = areaResultsArray[resultIndex];
                if (currentItem && !currentItem.isPoint && currentItem.pointsArray) {
                    if (currentItem.feature && currentItem.pointFeatures) {
                        if (currentItem.feature) {
                            measureSource.removeFeature(currentItem.feature);
                        }
                        if (currentItem.pointFeatures) {
                            for (let featureIndex = 0; featureIndex < currentItem.pointFeatures.length; featureIndex = featureIndex + 1) {
                                const currentFeature = currentItem.pointFeatures[featureIndex];
                                if (currentFeature) {
                                    measureSource.removeFeature(currentFeature);
                                }
                            }
                        }
                    }
                    if (currentItem.feature && currentItem.pointEntities) {
                        if (currentItem.feature) {
                            try {
                                cesiumViewer.entities.remove(currentItem.feature);
                            } catch (error) {
                            }
                        }
                        if (currentItem.labelEntity) {
                            try {
                                cesiumViewer.entities.remove(currentItem.labelEntity);
                            } catch (error) {
                            }
                        }
                        if (currentItem.pointEntities) {
                            for (let entityIndex = 0; entityIndex < currentItem.pointEntities.length; entityIndex = entityIndex + 1) {
                                const currentEntity = currentItem.pointEntities[entityIndex];
                                if (currentEntity) {
                                    try {
                                        cesiumViewer.entities.remove(currentEntity);
                                    } catch (error) {
                                    }
                                }
                            }
                        }
                    }
                    
                    if (currentItem.pointsArray && currentItem.pointsArray.length >= 3) {
                        
                        const positionsArrayFor3D = [];
                        const pointEntitiesArrayFor3D = [];
                        for (let pointIndex = 0; pointIndex < currentItem.pointsArray.length; pointIndex = pointIndex + 1) {
                            const currentPointLonLat = currentItem.pointsArray[pointIndex];
                            const cartographicPosition = Cesium.Cartographic.fromDegrees(currentPointLonLat[0], currentPointLonLat[1]);
                            const cartesianPosition = Cesium.Cartesian3.fromRadians(cartographicPosition.longitude, cartographicPosition.latitude);
                            positionsArrayFor3D.push(cartesianPosition);
                            
                            const pointEntity = cesiumViewer.entities.add({
                                position: cartesianPosition,
                                point: {
                                    pixelSize: 10,
                                    color: Cesium.Color.RED,
                                    outlineColor: Cesium.Color.WHITE,
                                    outlineWidth: 2,
                                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                                }
                            });
                            pointEntitiesArrayFor3D.push(pointEntity);
                        }
                        
                        let polygonEntityFor3D = null;
                        let labelEntityFor3D = null;
                        if (positionsArrayFor3D.length >= 3) {
                            if (positionsArrayFor3D.length > 0) {
                                positionsArrayFor3D.push(positionsArrayFor3D[0]);
                            }
                            
                            polygonEntityFor3D = cesiumViewer.entities.add({
                                polygon: {
                                    hierarchy: new Cesium.PolygonHierarchy(positionsArrayFor3D),
                                    material: Cesium.Color.RED.withAlpha(0.3),
                                    outline: true,
                                    outlineColor: Cesium.Color.RED,
                                    height: 0,
                                    extrudedHeight: 0
                                }
                            });
                            
                            const lastPosition = positionsArrayFor3D[positionsArrayFor3D.length - 2];
                            const areaText = currentItem.text;
                            labelEntityFor3D = cesiumViewer.entities.add({
                                position: lastPosition,
                                label: {
                                    text: areaText,
                                    font: '12px sans-serif',
                                    fillColor: Cesium.Color.WHITE,
                                    outlineColor: Cesium.Color.BLACK,
                                    outlineWidth: 2,
                                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                                    pixelOffset: new Cesium.Cartesian2(0, -40),
                                    disableDepthTestDistance: Number.POSITIVE_INFINITY
                                }
                            });
                        }
                        
                        currentItem.feature = polygonEntityFor3D;
                        currentItem.pointFeatures = null;
                        currentItem.pointEntities = pointEntitiesArrayFor3D;
                        currentItem.labelEntity = labelEntityFor3D;
                    }
                }
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
                isSyncingZoom = true;
                const coordinate = ol.proj.fromLonLat(targetLonlat);
                mainView.setCenter(coordinate);
                mainView.setZoom(targetZoom);
                setTimeout(function() {
                    const actualZoom = mainView.getZoom();
                    if (Math.abs(actualZoom - targetZoom) > ZOOM_DIFFERENCE_THRESHOLD) {
                        mainView.setZoom(targetZoom);
                    }
                    setTimeout(function() {
                        isSyncingZoom = false;
                    }, 2000);
                }, 500);
            }
        }
        
        for (let resultIndex = 0; resultIndex < measureResultsArray.length; resultIndex = resultIndex + 1) {
            const currentItem = measureResultsArray[resultIndex];
            if (currentItem && !currentItem.isPoint && currentItem.pointsArray) {
                if (currentItem.feature && currentItem.pointFeatures) {
                    if (currentItem.feature) {
                        measureSource.removeFeature(currentItem.feature);
                    }
                    if (currentItem.pointFeatures) {
                        for (let featureIndex = 0; featureIndex < currentItem.pointFeatures.length; featureIndex = featureIndex + 1) {
                            const currentFeature = currentItem.pointFeatures[featureIndex];
                            if (currentFeature) {
                                measureSource.removeFeature(currentFeature);
                            }
                        }
                    }
                }
                if (currentItem.feature && currentItem.pointEntities) {
                    if (cesiumViewer) {
                        if (currentItem.feature) {
                            try {
                                cesiumViewer.entities.remove(currentItem.feature);
                            } catch (error) {
                            }
                        }
                        if (currentItem.labelEntity) {
                            try {
                                cesiumViewer.entities.remove(currentItem.labelEntity);
                            } catch (error) {
                            }
                        }
                        if (currentItem.pointEntities) {
                            for (let entityIndex = 0; entityIndex < currentItem.pointEntities.length; entityIndex = entityIndex + 1) {
                                const currentEntity = currentItem.pointEntities[entityIndex];
                                if (currentEntity) {
                                    try {
                                        cesiumViewer.entities.remove(currentEntity);
                                    } catch (error) {
                                    }
                                }
                            }
                        }
                    }
                }
                
                if (currentItem.pointsArray && currentItem.pointsArray.length >= 2) {
                    const positionsArrayFor2D = [];
                    for (let pointIndex = 0; pointIndex < currentItem.pointsArray.length; pointIndex = pointIndex + 1) {
                        const currentPointLonLat = currentItem.pointsArray[pointIndex];
                        const coordinateFor2D = ol.proj.fromLonLat(currentPointLonLat);
                        positionsArrayFor2D.push(coordinateFor2D);
                    }
                    
                    const lineGeometryFor2D = new ol.geom.LineString(positionsArrayFor2D);
                    const lineStyleFor2D = new ol.style.Style({
                        stroke: new ol.style.Stroke({
                            color: '#ffcc33',
                            width: 3
                        })
                    });
                    
                    const lineFeatureFor2D = new ol.Feature({
                        geometry: lineGeometryFor2D
                    });
                    lineFeatureFor2D.setStyle(lineStyleFor2D);
                    measureSource.addFeature(lineFeatureFor2D);
                    
                    const pointFeaturesArrayFor2D = [];
                    for (let pointIndex = 0; pointIndex < currentItem.pointsArray.length; pointIndex = pointIndex + 1) {
                        const currentPointLonLat = currentItem.pointsArray[pointIndex];
                        const coordinateFor2D = ol.proj.fromLonLat(currentPointLonLat);
                        const pointFeatureFor2D = new ol.Feature({
                            geometry: new ol.geom.Point(coordinateFor2D)
                        });
                        const pointStyleFor2D = new ol.style.Style({
                            image: new ol.style.Circle({
                                radius: 5,
                                fill: new ol.style.Fill({ color: '#ffcc33' })
                            })
                        });
                        pointFeatureFor2D.setStyle(pointStyleFor2D);
                        measureSource.addFeature(pointFeatureFor2D);
                        pointFeaturesArrayFor2D.push(pointFeatureFor2D);
                    }
                    
                    currentItem.feature = lineFeatureFor2D;
                    currentItem.pointFeatures = pointFeaturesArrayFor2D;
                    currentItem.pointEntities = null;
                    currentItem.labelEntity = null;
                }
            }
        }
        
        for (let resultIndex = 0; resultIndex < areaResultsArray.length; resultIndex = resultIndex + 1) {
            const currentItem = areaResultsArray[resultIndex];
            if (currentItem && !currentItem.isPoint && currentItem.pointsArray) {
                if (currentItem.feature && currentItem.pointFeatures) {
                    if (currentItem.feature) {
                        measureSource.removeFeature(currentItem.feature);
                    }
                    if (currentItem.pointFeatures) {
                        for (let featureIndex = 0; featureIndex < currentItem.pointFeatures.length; featureIndex = featureIndex + 1) {
                            const currentFeature = currentItem.pointFeatures[featureIndex];
                            if (currentFeature) {
                                measureSource.removeFeature(currentFeature);
                            }
                        }
                    }
                }
                if (currentItem.feature && currentItem.pointEntities) {
                    if (cesiumViewer) {
                        if (currentItem.feature) {
                            try {
                                cesiumViewer.entities.remove(currentItem.feature);
                            } catch (error) {
                            }
                        }
                        if (currentItem.labelEntity) {
                            try {
                                cesiumViewer.entities.remove(currentItem.labelEntity);
                            } catch (error) {
                            }
                        }
                        if (currentItem.pointEntities) {
                            for (let entityIndex = 0; entityIndex < currentItem.pointEntities.length; entityIndex = entityIndex + 1) {
                                const currentEntity = currentItem.pointEntities[entityIndex];
                                if (currentEntity) {
                                    try {
                                        cesiumViewer.entities.remove(currentEntity);
                                    } catch (error) {
                                    }
                                }
                            }
                        }
                    }
                }
                
                if (currentItem.pointsArray && currentItem.pointsArray.length >= 3) {
                    const polygonCoordinatesFor2D = [];
                    for (let pointIndex = 0; pointIndex < currentItem.pointsArray.length; pointIndex = pointIndex + 1) {
                        const currentPointLonLat = currentItem.pointsArray[pointIndex];
                        const coordinateFor2D = ol.proj.fromLonLat(currentPointLonLat);
                        polygonCoordinatesFor2D.push(coordinateFor2D);
                    }
                    if (polygonCoordinatesFor2D.length > 0) {
                        polygonCoordinatesFor2D.push(polygonCoordinatesFor2D[0]);
                    }
                    
                    const polygonGeometryFor2D = new ol.geom.Polygon([polygonCoordinatesFor2D]);
                    const polygonStyleFor2D = new ol.style.Style({
                        stroke: new ol.style.Stroke({
                            color: 'rgba(255, 0, 0, 0.6)',
                            width: 3
                        }),
                        fill: new ol.style.Fill({
                            color: 'rgba(255, 0, 0, 0.2)'
                        })
                    });
                    
                    const polygonFeatureFor2D = new ol.Feature({
                        geometry: polygonGeometryFor2D
                    });
                    polygonFeatureFor2D.setStyle(polygonStyleFor2D);
                    measureSource.addFeature(polygonFeatureFor2D);
                    
                    const pointFeaturesArrayFor2D = [];
                    for (let pointIndex = 0; pointIndex < currentItem.pointsArray.length; pointIndex = pointIndex + 1) {
                        const currentPointLonLat = currentItem.pointsArray[pointIndex];
                        const coordinateFor2D = ol.proj.fromLonLat(currentPointLonLat);
                        const pointFeatureFor2D = new ol.Feature({
                            geometry: new ol.geom.Point(coordinateFor2D)
                        });
                        const pointStyleFor2D = new ol.style.Style({
                            image: new ol.style.Circle({
                                radius: 6,
                                fill: new ol.style.Fill({ color: 'rgba(255, 0, 0, 0.8)' }),
                                stroke: new ol.style.Stroke({ color: 'white', width: 2 })
                            })
                        });
                        pointFeatureFor2D.setStyle(pointStyleFor2D);
                        measureSource.addFeature(pointFeatureFor2D);
                        pointFeaturesArrayFor2D.push(pointFeatureFor2D);
                    }
                    
                    currentItem.feature = polygonFeatureFor2D;
                    currentItem.pointFeatures = pointFeaturesArrayFor2D;
                    currentItem.pointEntities = null;
                    currentItem.labelEntity = null;
                }
            }
        }
        
        const allMeasureFeatures = measureSource.getFeatures();
        for (let featureIndex = allMeasureFeatures.length - 1; featureIndex >= 0; featureIndex = featureIndex - 1) {
            const currentFeature = allMeasureFeatures[featureIndex];
            let isInResults = false;
            for (let resultIndex = 0; resultIndex < measureResultsArray.length; resultIndex = resultIndex + 1) {
                const currentResult = measureResultsArray[resultIndex];
                if (currentResult && currentResult.feature === currentFeature) {
                    isInResults = true;
                    break;
                }
                if (currentResult && currentResult.pointFeatures) {
                    for (let pointIndex = 0; pointIndex < currentResult.pointFeatures.length; pointIndex = pointIndex + 1) {
                        if (currentResult.pointFeatures[pointIndex] === currentFeature) {
                            isInResults = true;
                            break;
                        }
                    }
                }
            }
            for (let resultIndex = 0; resultIndex < areaResultsArray.length; resultIndex = resultIndex + 1) {
                const currentResult = areaResultsArray[resultIndex];
                if (currentResult && currentResult.feature === currentFeature) {
                    isInResults = true;
                    break;
                }
                if (currentResult && currentResult.pointFeatures) {
                    for (let pointIndex = 0; pointIndex < currentResult.pointFeatures.length; pointIndex = pointIndex + 1) {
                        if (currentResult.pointFeatures[pointIndex] === currentFeature) {
                            isInResults = true;
                            break;
                        }
                    }
                }
            }
            if (!isInResults) {
                measureSource.removeFeature(currentFeature);
            }
        }
    }
    
    setTimeout(function() {
        isSyncingZoom = false;
    }, 4000);
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
