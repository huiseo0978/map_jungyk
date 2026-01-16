function setupCesiumEvents() {
    if (!cesiumViewer) {
        return;
    }
    
    cesiumViewer.camera.changed.addEventListener(function() {
        const cameraHeight = cesiumViewer.camera.positionCartographic.height;
        const levelInfoElement = document.getElementById("level-info");
        if (levelInfoElement) {
            const roundedHeight = Math.round(cameraHeight);
            levelInfoElement.innerText = "높이: " + roundedHeight + "m";
        }
        
        if (typeof sync3DTo2D === 'function') {
            sync3DTo2D(cameraHeight, cesiumViewer.camera.positionCartographic);
        }
    });
    
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
                        popupContentElement.innerHTML = "위치<br>경도: " + lonString + "<br>위도: " + latString;
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
                                    popupContentElement.innerHTML = "위치<br>경도: " + lonString + "<br>위도: " + latString;
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
