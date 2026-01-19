let cesiumEventCallbacks = {
    onCameraChanged: null,
    onMouseMove: null,
    onDoubleClick: null
};

let cesiumEventsInitialized = false;
let cesiumCameraListener = null;

function setCesiumEventCallbacks(callbacks) {
    if (callbacks.onCameraChanged) {
        cesiumEventCallbacks.onCameraChanged = callbacks.onCameraChanged;
    }
    if (callbacks.onMouseMove) {
        cesiumEventCallbacks.onMouseMove = callbacks.onMouseMove;
    }
    if (callbacks.onDoubleClick) {
        cesiumEventCallbacks.onDoubleClick = callbacks.onDoubleClick;
    }
}

function getCesiumEventCallbacks() {
    return {
        onCameraChanged: cesiumEventCallbacks.onCameraChanged,
        onMouseMove: cesiumEventCallbacks.onMouseMove,
        onDoubleClick: cesiumEventCallbacks.onDoubleClick
    };
}

function setupCesiumEvents() {
    if (!cesiumViewer) {
        return;
    }
    
    if (cesiumEventsInitialized) {
        return;
    }
    
    const cameraChangedHandler = function() {
        const cameraHeight = cesiumViewer.camera.positionCartographic.height;
        const cameraPosition = cesiumViewer.camera.positionCartographic;
        
        if (cesiumEventCallbacks.onCameraChanged) {
            cesiumEventCallbacks.onCameraChanged({
                height: cameraHeight,
                position: cameraPosition
            });
        }
    };
    
    cesiumCameraListener = cesiumViewer.camera.changed.addEventListener(cameraChangedHandler);
    
    if (cesiumEventHandler === null) {
        cesiumEventHandler = new Cesium.ScreenSpaceEventHandler(cesiumViewer.scene.canvas);
    }
    
    cesiumEventHandler.setInputAction(function(movementEvent) {
        const pickedCartesian = cesiumViewer.camera.pickEllipsoid(movementEvent.endPosition, cesiumViewer.scene.globe.ellipsoid);
        let coordinateData = null;
        
        if (pickedCartesian) {
            const cartographicPosition = Cesium.Cartographic.fromCartesian(pickedCartesian);
            coordinateData = {
                lon: Cesium.Math.toDegrees(cartographicPosition.longitude),
                lat: Cesium.Math.toDegrees(cartographicPosition.latitude)
            };
        }
        
        let shouldProcessEntity = true;
        if (cesiumEventCallbacks.onMouseMove) {
            const callbackResult = cesiumEventCallbacks.onMouseMove({ coordinate: coordinateData });
            if (callbackResult && callbackResult.shouldProcessEntity === false) {
                shouldProcessEntity = false;
            }
        }
        
        if (shouldProcessEntity) {
            const pickedObject = cesiumViewer.scene.pick(movementEvent.endPosition);
            let eventData = {
                coordinate: coordinateData,
                pickedEntity: null,
                foundCityEntity: false,
                foundActiveMarker: false,
                closestCityEntity: null,
                markerData: null,
                cityData: null
            };
            
            if (pickedObject && pickedObject.id) {
                const pickedEntity = pickedObject.id;
                
                if (cesiumActiveMarker && pickedEntity === cesiumActiveMarker) {
                    eventData.foundActiveMarker = true;
                    const markerPosition = cesiumActiveMarker.position.getValue();
                    const markerCartographic = Cesium.Cartographic.fromCartesian(markerPosition);
                    const markerLon = Cesium.Math.toDegrees(markerCartographic.longitude);
                    const markerLat = Cesium.Math.toDegrees(markerCartographic.latitude);
                    let markerLonlat = [markerLon, markerLat];
                    
                    if (cesiumActiveMarker.properties && cesiumActiveMarker.properties.lonlat) {
                        markerLonlat = cesiumActiveMarker.properties.lonlat.getValue();
                    }
                    
                    eventData.pickedEntity = cesiumActiveMarker;
                    eventData.markerData = {
                        lonlat: markerLonlat,
                        position: markerPosition,
                        screenPosition: Cesium.SceneTransforms.wgs84ToWindowCoordinates(cesiumViewer.scene, markerPosition)
                    };
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
                        eventData.foundCityEntity = true;
                        eventData.pickedEntity = pickedEntity;
                        const pickedPosition = pickedEntity.position.getValue();
                        eventData.cityData = {
                            name: pickedEntityName || "",
                            entity: pickedEntity,
                            position: pickedPosition,
                            screenPosition: Cesium.SceneTransforms.wgs84ToWindowCoordinates(cesiumViewer.scene, pickedPosition)
                        };
                    } else {
                        for (let cityIndex = 0; cityIndex < cesiumCityEntitiesArray.length; cityIndex = cityIndex + 1) {
                            if (cesiumCityEntitiesArray[cityIndex] === pickedEntity) {
                                eventData.foundCityEntity = true;
                                eventData.pickedEntity = pickedEntity;
                                let cityNameForTooltip = "";
                                if (pickedEntity.properties && pickedEntity.properties.name) {
                                    cityNameForTooltip = pickedEntity.properties.name.getValue();
                                }
                                const pickedPosition = pickedEntity.position.getValue();
                                eventData.cityData = {
                                    name: cityNameForTooltip,
                                    entity: pickedEntity,
                                    position: pickedPosition,
                                    screenPosition: Cesium.SceneTransforms.wgs84ToWindowCoordinates(cesiumViewer.scene, pickedPosition)
                                };
                                break;
                            }
                        }
                    }
                }
            }
            
            if (eventData.foundCityEntity === false && eventData.foundActiveMarker === false) {
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
                        eventData.foundCityEntity = true;
                        eventData.closestCityEntity = closestCityEntity;
                        let cityNameForPopup = "";
                        if (closestCityEntity.properties && closestCityEntity.properties.name) {
                            cityNameForPopup = closestCityEntity.properties.name.getValue();
                        }
                        const cityPosition = closestCityEntity.position.getValue();
                        eventData.cityData = {
                            name: cityNameForPopup,
                            entity: closestCityEntity,
                            position: cityPosition,
                            screenPosition: Cesium.SceneTransforms.wgs84ToWindowCoordinates(cesiumViewer.scene, cityPosition)
                        };
                    }
                }
                
                if (eventData.foundCityEntity === false && cesiumActiveMarker) {
                    const markerPosition = cesiumActiveMarker.position.getValue();
                    const markerCartographic = Cesium.Cartographic.fromCartesian(markerPosition);
                    const markerLon = Cesium.Math.toDegrees(markerCartographic.longitude);
                    const markerLat = Cesium.Math.toDegrees(markerCartographic.latitude);
                    
                    if (pickedCartesian) {
                        const cartographicPosition = Cesium.Cartographic.fromCartesian(pickedCartesian);
                        const mouseLon = Cesium.Math.toDegrees(cartographicPosition.longitude);
                        const mouseLat = Cesium.Math.toDegrees(cartographicPosition.latitude);
                        const distanceLon = Math.abs(mouseLon - markerLon);
                        const distanceLat = Math.abs(mouseLat - markerLat);
                        const totalDistance = Math.sqrt(distanceLon * distanceLon + distanceLat * distanceLat);
                        
                        if (totalDistance < 0.01) {
                            eventData.foundActiveMarker = true;
                            let markerLonlat = [markerLon, markerLat];
                            if (cesiumActiveMarker.properties && cesiumActiveMarker.properties.lonlat) {
                                markerLonlat = cesiumActiveMarker.properties.lonlat.getValue();
                            }
                            eventData.markerData = {
                                lonlat: markerLonlat,
                                position: markerPosition,
                                screenPosition: Cesium.SceneTransforms.wgs84ToWindowCoordinates(cesiumViewer.scene, markerPosition)
                            };
                        }
                    }
                }
            }
            
            for (let cityIndex = 0; cityIndex < cesiumCityEntitiesArray.length; cityIndex = cityIndex + 1) {
                const currentCityEntity = cesiumCityEntitiesArray[cityIndex];
                if (currentCityEntity && currentCityEntity.label) {
                    const shouldShow = (eventData.foundCityEntity && 
                        (currentCityEntity === eventData.pickedEntity || currentCityEntity === eventData.closestCityEntity));
                    eventData.cityLabelStates = eventData.cityLabelStates || [];
                    eventData.cityLabelStates.push({
                        entity: currentCityEntity,
                        show: shouldShow
                    });
                }
            }
            
            if (cesiumEventCallbacks.onMouseMove) {
                cesiumEventCallbacks.onMouseMove(eventData);
            }
        } else {
            if (coordinateData && cesiumEventCallbacks.onMouseMove) {
                cesiumEventCallbacks.onMouseMove({ coordinate: coordinateData });
            }
        }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    
    cesiumViewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    cesiumEventHandler.setInputAction(function(clickEvent) {
        if (cesiumEventCallbacks.onDoubleClick) {
            cesiumEventCallbacks.onDoubleClick();
        }
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    
    cesiumEventsInitialized = true;
}

function teardownCesiumEvents() {
    if (cesiumViewer && cesiumCameraListener) {
        cesiumViewer.camera.changed.removeEventListener(cesiumCameraListener);
        cesiumCameraListener = null;
    }
    
    if (cesiumEventHandler) {
        cesiumEventHandler.destroy();
        cesiumEventHandler = null;
    }
    
    cesiumEventsInitialized = false;
}
