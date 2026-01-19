function toggle3D(is3DEnabled) {
    isSyncingZoom = true;
    is3DModeActive = is3DEnabled;
    const mapElement = document.getElementById("map");
    const cesiumContainerElement = document.getElementById("cesiumContainer");

    if (is3DEnabled) {
        let targetLonlat = [127.0276, 37.4979];
        let targetHeight = 15000;
        
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
        } else {
            if (cesiumViewer) {
                let hasCameraListener = false;
                if (cesiumViewer.camera._changed) {
                    hasCameraListener = true;
                }
                if (!hasCameraListener) {
                    cesiumViewer.camera.changed.addEventListener(function() {
                        const cameraHeight = cesiumViewer.camera.positionCartographic.height;
                        const levelInfoElement = document.getElementById("level-info");
                        if (levelInfoElement) {
                            const roundedHeight = Math.round(cameraHeight);
                            levelInfoElement.innerText = "위치: " + roundedHeight + "m";
                        }
                        
                        if (isSyncingZoom) {
                            return;
                        }
                        if (is3DModeActive && map && mainView) {
                            const cameraPosition = cesiumViewer.camera.positionCartographic;
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
                    });
                }
            }
            if (cesiumEventHandler === null) {
                cesiumEventHandler = new Cesium.ScreenSpaceEventHandler(cesiumViewer.scene.canvas);
            }
            cesiumEventHandler.setInputAction(function(movementEvent) {
                const pickedCartesian = cesiumViewer.camera.pickEllipsoid(movementEvent.endPosition, cesiumViewer.scene.globe.ellipsoid);
                if (pickedCartesian) {
                    const cartographicPosition = Cesium.Cartographic.fromCartesian(pickedCartesian);
                    const longitudeDegrees = Cesium.Math.toDegrees(cartographicPosition.longitude);
                    const latitudeDegrees = Cesium.Math.toDegrees(cartographicPosition.latitude);
                    const coordinateInfoElement = document.getElementById("coord-info");
                    if (coordinateInfoElement) {
                        coordinateInfoElement.innerText = "위치: " + longitudeDegrees.toFixed(4) + "," + latitudeDegrees.toFixed(4);
                    }
                }
                
                if (isMeasuringNow === false) {
                    const pickedObject = cesiumViewer.scene.pick(movementEvent.endPosition);
                    const popupContentElement = document.getElementById("popup-content");
                    const popupElement = document.getElementById("popup");
                    let foundCityEntity = false;
                    let foundActiveMarker = false;
                    let closestCityEntity = null;
                    
                    if (pickedObject && pickedObject.id) {
                        const pickedEntity = pickedObject.id;
                        if (cesiumActiveMarker && pickedEntity === cesiumActiveMarker) {
                            foundActiveMarker = true;
                            const markerPosition = cesiumActiveMarker.position.getValue();
                            const markerCartographic = Cesium.Cartographic.fromCartesian(markerPosition);
                            const markerLon = Cesium.Math.toDegrees(markerCartographic.longitude);
                            const markerLat = Cesium.Math.toDegrees(markerCartographic.latitude);
                            let markerLonlat = [markerLon, markerLat];
                            if (cesiumActiveMarker.properties) {
                                if (cesiumActiveMarker.properties.lonlat) {
                                    markerLonlat = cesiumActiveMarker.properties.lonlat.getValue();
                                }
                            }
                            if (popupContentElement) {
                                const lonString = markerLonlat[0].toFixed(6);
                                const latString = markerLonlat[1].toFixed(6);
                                popupContentElement.innerHTML = "위치<br>위치?: " + lonString + "<br>위치: " + latString;
                            }
                            if (popupElement) {
                                const screenPosition = Cesium.SceneTransforms.wgs84ToWindowCoordinates(cesiumViewer.scene, markerPosition);
                                if (screenPosition) {
                                    popupElement.style.position = 'fixed';
                                    popupElement.style.left = screenPosition.x + 'px';
                                    popupElement.style.top = (screenPosition.y - 30) + 'px';
                                    popupElement.style.bottom = 'auto';
                                    popupElement.style.right = 'auto';
                                    popupElement.style.transform = 'translateX(-50%)';
                                    popupElement.style.display = 'block';
                                    popupElement.style.zIndex = '10000';
                                    popupElement.className = 'ol-popup';
                                }
                            }
                            const cesiumCanvasElement = cesiumViewer.scene.canvas;
                            if (cesiumCanvasElement) {
                                cesiumCanvasElement.style.cursor = 'pointer';
                            }
                        } else {
                            let pickedEntityType = null;
                            let pickedEntityName = null;
                            if (pickedEntity.properties) {
                                if (pickedEntity.properties.type) {
                                    pickedEntityType = pickedEntity.properties.type.getValue();
                                }
                                if (pickedEntity.properties.name) {
                                    pickedEntityName = pickedEntity.properties.name.getValue();
                                }
                            }
                            if (pickedEntityType === "city") {
                                foundCityEntity = true;
                                if (pickedEntity.label) {
                                    pickedEntity.label.show = true;
                                }
                                if (popupContentElement) {
                                    popupContentElement.innerHTML = pickedEntityName || "";
                                }
                                const pickedPosition = pickedEntity.position.getValue();
                                if (popupElement) {
                                    const screenPosition = Cesium.SceneTransforms.wgs84ToWindowCoordinates(cesiumViewer.scene, pickedPosition);
                                    if (screenPosition) {
                                        popupElement.style.position = 'fixed';
                                        popupElement.style.left = screenPosition.x + 'px';
                                        popupElement.style.top = (screenPosition.y - 30) + 'px';
                                        popupElement.style.bottom = 'auto';
                                        popupElement.style.right = 'auto';
                                        popupElement.style.transform = 'translateX(-50%)';
                                        popupElement.style.display = 'block';
                                        popupElement.style.zIndex = '10000';
                                        popupElement.className = 'ol-popup';
                                    }
                                }
                                const cesiumCanvasElement = cesiumViewer.scene.canvas;
                                if (cesiumCanvasElement) {
                                    cesiumCanvasElement.style.cursor = 'pointer';
                                }
                            } else {
                                for (let cityIndex = 0; cityIndex < cesiumCityEntitiesArray.length; cityIndex = cityIndex + 1) {
                                    if (cesiumCityEntitiesArray[cityIndex] === pickedEntity) {
                                        foundCityEntity = true;
                                        if (pickedEntity.label) {
                                            pickedEntity.label.show = true;
                                        }
                                        let cityNameForTooltip = "";
                                        if (pickedEntity.properties && pickedEntity.properties.name) {
                                            cityNameForTooltip = pickedEntity.properties.name.getValue();
                                        }
                                        if (popupContentElement) {
                                            popupContentElement.innerHTML = cityNameForTooltip;
                                        }
                                        const pickedPosition = pickedEntity.position.getValue();
                                        if (popupElement) {
                                            const screenPosition = Cesium.SceneTransforms.wgs84ToWindowCoordinates(cesiumViewer.scene, pickedPosition);
                                            if (screenPosition) {
                                                popupElement.style.position = 'fixed';
                                                popupElement.style.left = screenPosition.x + 'px';
                                                popupElement.style.top = (screenPosition.y - 30) + 'px';
                                                popupElement.style.bottom = 'auto';
                                                popupElement.style.right = 'auto';
                                                popupElement.style.transform = 'translateX(-50%)';
                                                popupElement.style.display = 'block';
                                                popupElement.style.zIndex = '10000';
                                                popupElement.className = 'ol-popup';
                                            }
                                        }
                                        const cesiumCanvasElement = cesiumViewer.scene.canvas;
                                        if (cesiumCanvasElement) {
                                            cesiumCanvasElement.style.cursor = 'pointer';
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    
                    if (foundCityEntity === false && foundActiveMarker === false) {
                        const pickedCartesian = cesiumViewer.camera.pickEllipsoid(movementEvent.endPosition, cesiumViewer.scene.globe.ellipsoid);
                        if (pickedCartesian) {
                            const cartographicPosition = Cesium.Cartographic.fromCartesian(pickedCartesian);
                            const mouseLon = Cesium.Math.toDegrees(cartographicPosition.longitude);
                            const mouseLat = Cesium.Math.toDegrees(cartographicPosition.latitude);
                            let closestCityEntity = null;
                            let closestDistance = 0.01;
                            
                            for (let cityIndex = 0; cityIndex < cesiumCityEntitiesArray.length; cityIndex = cityIndex + 1) {
                                const currentCityEntity = cesiumCityEntitiesArray[cityIndex];
                                if (currentCityEntity) {
                                    const cityPosition = currentCityEntity.position.getValue();
                                    const cityCartographic = Cesium.Cartographic.fromCartesian(cityPosition);
                                    const cityLon = Cesium.Math.toDegrees(cityCartographic.longitude);
                                    const cityLat = Cesium.Math.toDegrees(cityCartographic.latitude);
                                    
                                    const distanceLon = Math.abs(mouseLon - cityLon);
                                    const distanceLat = Math.abs(mouseLat - cityLat);
                                    const totalDistance = Math.sqrt(distanceLon * distanceLon + distanceLat * distanceLat);
                                    
                                    if (totalDistance < closestDistance) {
                                        closestDistance = totalDistance;
                                        closestCityEntity = currentCityEntity;
                                    }
                                }
                            }
                            
                            if (closestCityEntity) {
                                foundCityEntity = true;
                                if (closestCityEntity.label) {
                                    closestCityEntity.label.show = true;
                                }
                                let cityNameForPopup = "";
                                if (closestCityEntity.properties && closestCityEntity.properties.name) {
                                    cityNameForPopup = closestCityEntity.properties.name.getValue();
                                }
                                if (popupContentElement) {
                                    popupContentElement.innerHTML = cityNameForPopup;
                                }
                                const cityPosition = closestCityEntity.position.getValue();
                                if (popupElement) {
                                    const screenPosition = Cesium.SceneTransforms.wgs84ToWindowCoordinates(cesiumViewer.scene, cityPosition);
                                    if (screenPosition) {
                                        popupElement.style.position = 'fixed';
                                        popupElement.style.left = screenPosition.x + 'px';
                                        popupElement.style.top = (screenPosition.y - 30) + 'px';
                                        popupElement.style.bottom = 'auto';
                                        popupElement.style.right = 'auto';
                                        popupElement.style.transform = 'translateX(-50%)';
                                        popupElement.style.display = 'block';
                                        popupElement.style.zIndex = '10000';
                                        popupElement.className = 'ol-popup';
                                    }
                                }
                                const cesiumCanvasElement = cesiumViewer.scene.canvas;
                                if (cesiumCanvasElement) {
                                    cesiumCanvasElement.style.cursor = 'pointer';
                                }
                            }
                        }
                        
                        if (foundCityEntity === false) {
                            if (cesiumActiveMarker) {
                                const markerPosition = cesiumActiveMarker.position.getValue();
                                const markerCartographic = Cesium.Cartographic.fromCartesian(markerPosition);
                                const markerLon = Cesium.Math.toDegrees(markerCartographic.longitude);
                                const markerLat = Cesium.Math.toDegrees(markerCartographic.latitude);
                                const pickedCartesian = cesiumViewer.camera.pickEllipsoid(movementEvent.endPosition, cesiumViewer.scene.globe.ellipsoid);
                                if (pickedCartesian) {
                                    const cartographicPosition = Cesium.Cartographic.fromCartesian(pickedCartesian);
                                    const mouseLon = Cesium.Math.toDegrees(cartographicPosition.longitude);
                                    const mouseLat = Cesium.Math.toDegrees(cartographicPosition.latitude);
                                    const distanceLon = Math.abs(mouseLon - markerLon);
                                    const distanceLat = Math.abs(mouseLat - markerLat);
                                    const totalDistance = Math.sqrt(distanceLon * distanceLon + distanceLat * distanceLat);
                                    if (totalDistance < 0.01) {
                                        foundActiveMarker = true;
                                        let markerLonlat = [markerLon, markerLat];
                                        if (cesiumActiveMarker.properties && cesiumActiveMarker.properties.lonlat) {
                                            markerLonlat = cesiumActiveMarker.properties.lonlat.getValue();
                                        }
                                        if (popupContentElement) {
                                            const lonString = markerLonlat[0].toFixed(6);
                                            const latString = markerLonlat[1].toFixed(6);
                                            popupContentElement.innerHTML = "위치<br>위치?: " + lonString + "<br>위치: " + latString;
                                        }
                                        if (popupElement) {
                                            const screenPosition = Cesium.SceneTransforms.wgs84ToWindowCoordinates(cesiumViewer.scene, markerPosition);
                                            if (screenPosition) {
                                                popupElement.style.position = 'fixed';
                                                popupElement.style.left = screenPosition.x + 'px';
                                                popupElement.style.top = (screenPosition.y - 30) + 'px';
                                                popupElement.style.bottom = 'auto';
                                                popupElement.style.right = 'auto';
                                                popupElement.style.transform = 'translateX(-50%)';
                                                popupElement.style.display = 'block';
                                                popupElement.style.zIndex = '10000';
                                                popupElement.className = 'ol-popup';
                                            }
                                        }
                                        const cesiumCanvasElement = cesiumViewer.scene.canvas;
                                        if (cesiumCanvasElement) {
                                            cesiumCanvasElement.style.cursor = 'pointer';
                                        }
                                    }
                                }
                            }
                        }
                        
                        for (let cityIndex = 0; cityIndex < cesiumCityEntitiesArray.length; cityIndex = cityIndex + 1) {
                            const currentCityEntity = cesiumCityEntitiesArray[cityIndex];
                            if (currentCityEntity && currentCityEntity.label) {
                                if (foundCityEntity === false || currentCityEntity !== closestCityEntity) {
                                    currentCityEntity.label.show = false;
                                }
                            }
                        }
                        
                        if (foundCityEntity === false && foundActiveMarker === false) {
                            if (popupElement) {
                                popupElement.style.display = 'none';
                            }
                            const cesiumCanvasElement = cesiumViewer.scene.canvas;
                            if (cesiumCanvasElement) {
                                cesiumCanvasElement.style.cursor = '';
                            }
                        }
                    } else {
                        for (let cityIndex = 0; cityIndex < cesiumCityEntitiesArray.length; cityIndex = cityIndex + 1) {
                            const currentCityEntity = cesiumCityEntitiesArray[cityIndex];
                            if (currentCityEntity && currentCityEntity.label) {
                                if (!foundCityEntity) {
                                    currentCityEntity.label.show = false;
                                }
                            }
                        }
                    }
                }
            }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
            cesiumViewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
            cesiumEventHandler.setInputAction(function(clickEvent) {
                if (isMeasuringNow) {
                    finishMeasureFunction();
                } else if (isAreaMeasuringNow) {
                    finishAreaMeasureFunction();
                } else {
                    if (document.body.classList.contains("topbar-hidden")) {
                        window.toggleTopbar();
                    }
                }
            }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        }
        
        createCesiumCityEntities();
        
        moveCesiumCamera(targetLonlat, targetHeight);
        
        if (cesiumViewer) {
            for (let resultIndex = 0; resultIndex < measureResultsArray.length; resultIndex = resultIndex + 1) {
                const currentItem = measureResultsArray[resultIndex];
                if (currentItem && !currentItem.isPoint) {
                    if (currentItem.feature && currentItem.pointFeatures && currentItem.pointsArray) {
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
                if (currentItem && !currentItem.isPoint) {
                    if (currentItem.feature && currentItem.pointFeatures && currentItem.pointsArray) {
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
        
        let targetLonlat = [127.0276, 37.4979];
        let targetZoom = 13;
        
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
                targetZoom = heightToZoom(cameraHeight, latitudeRadians, mapSize);
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
                    if (Math.abs(actualZoom - targetZoom) > 0.01) {
                        mainView.setZoom(targetZoom);
                    }
                    setTimeout(function() {
                        isSyncingZoom = false;
                    }, 2000);
                }, 500);
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
        
        for (let resultIndex = 0; resultIndex < measureResultsArray.length; resultIndex = resultIndex + 1) {
            const currentItem = measureResultsArray[resultIndex];
            if (currentItem && !currentItem.isPoint && currentItem.pointsArray) {
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
