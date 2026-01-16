function initializeCesiumViewer(targetLonlat, targetHeight) {
        if (cesiumViewer === null) {
            Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0NjI0YTQwNC0wMTYyLTQ4N2EtOTMzZi01OTE5OGUxOTc1NGEiLCJpZCI6Mzc3OTMzLCJpYXQiOjE3NjgyODU3NTF9.PKa3bqkvaE_GoFPI7HK9a3bONYA5A5fQjjJuq-pnyXE';

            cesiumViewer = new Cesium.Viewer("cesiumContainer", {
                geocoder: false,
                animation: false,
                timeline: false,
                infoBox: false,
                baseLayerPicker: false,
                selectionIndicator: false,
                terrainProvider: new Cesium.EllipsoidTerrainProvider()
            });
            
            try {
                if (typeof Cesium.IonImageryProvider !== 'undefined' && typeof Cesium.IonImageryProvider.fromAssetId === 'function') {
                    Cesium.IonImageryProvider.fromAssetId(2).then(function(provider) {
                        if (cesiumViewer && !cesiumViewer.isDestroyed()) {
                            cesiumViewer.imageryLayers.removeAll();
                            cesiumViewer.imageryLayers.addImageryProvider(provider);
                        }
                    }).catch(function(error) {
                    });
                }
            } catch (error) {
            }

            try {
                if (typeof Cesium.CesiumTerrainProvider.fromIonAssetId === 'function') {
                    Cesium.CesiumTerrainProvider.fromIonAssetId(1).then(function(provider) {
                        if (cesiumViewer && !cesiumViewer.isDestroyed()) {
                            cesiumViewer.terrainProvider = provider;
                        }
                    }).catch(function(err) {
                    });
                } else {
                }
            } catch (e) {
            }

            try {
                if (typeof Cesium.createOsmBuildings === 'function') {
                    const osmBuildings = Cesium.createOsmBuildings();
                    cesiumViewer.scene.primitives.add(osmBuildings);
                } else {
               }
            } catch (e) {
            }

            isSyncingZoom = true;
            const destinationCartesian = Cesium.Cartesian3.fromDegrees(targetLonlat[0], targetLonlat[1], targetHeight);
            cesiumViewer.camera.setView({
                destination: destinationCartesian,
                orientation: {
                    heading: Cesium.Math.toRadians(0),
                    pitch: Cesium.Math.toRadians(-45),
                    roll: 0.0
                }
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
                setTimeout(function() {
                    isSyncingZoom = false;
                }, 2000);
            }, 1500);
            
            cesiumViewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
            if (cesiumViewer.selectionIndicator) {
                cesiumViewer.selectionIndicator.viewModel.selectionIndicatorElement.style.display = 'none';
            }
            cesiumViewer.camera.changed.addEventListener(function() {
                const cameraHeight = cesiumViewer.camera.positionCartographic.height;
                const levelInfoElement = document.getElementById("level-info");
                if (levelInfoElement) {
                    const roundedHeight = Math.round(cameraHeight);
                    levelInfoElement.innerText = "????�: " + roundedHeight + "m";
                }
                
                if (isSyncingZoom) {
                    return;
                }
                if (is3DModeActive && map && mainView) {
                    const cameraPosition = cesiumViewer.camera.positionCartographic;
                    const cameraLon = Cesium.Math.toDegrees(cameraPosition.longitude);
                    const cameraLat = Cesium.Math.toDegrees(cameraPosition.latitude);
                    const latitudeRadians = cameraPosition.latitude;
                    const metersPerPixelAtEquator = 156543.03392;
                    const mapSize = map.getSize();
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
            cesiumEventHandler = new Cesium.ScreenSpaceEventHandler(cesiumViewer.scene.canvas);
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
                                popupContentElement.innerHTML = "???�?<br>???�??: " + lonString + "<br>??�??: " + latString;
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
                                            popupContentElement.innerHTML = "???�?<br>???�??: " + lonString + "<br>??�??: " + latString;
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
}

function createCesiumCityEntities() {
        if (cesiumViewer) {
            for (let cityIndex = 0; cityIndex < cesiumCityEntitiesArray.length; cityIndex = cityIndex + 1) {
                const currentCityEntity = cesiumCityEntitiesArray[cityIndex];
                if (currentCityEntity) {
                    cesiumViewer.entities.remove(currentCityEntity);
                }
            }
            cesiumCityEntitiesArray = [];
            
            const cityKeysForCesiumArray = Object.keys(cityInfos);
            for (let cityIndex = 0; cityIndex < cityKeysForCesiumArray.length; cityIndex = cityIndex + 1) {
                const cityKeyForCesium = cityKeysForCesiumArray[cityIndex];
                const cityDataForCesium = cityInfos[cityKeyForCesium];
                const cartographicPositionForCity = Cesium.Cartographic.fromDegrees(cityDataForCesium.lonlat[0], cityDataForCesium.lonlat[1]);
                const cartesianPositionForCity = Cesium.Cartesian3.fromRadians(cartographicPositionForCity.longitude, cartographicPositionForCity.latitude);
                const cityEntityForCesium = cesiumViewer.entities.add({
                    position: cartesianPositionForCity,
                    billboard: {
                        image: markerIconImageUrl,
                        width: 32,
                        height: 32,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                        disableDepthTestDistance: Number.POSITIVE_INFINITY
                    },
                    label: {
                        text: cityDataForCesium.name,
                        font: 'bold 13px sans-serif',
                        fillColor: Cesium.Color.BLACK,
                        outlineColor: Cesium.Color.WHITE,
                        outlineWidth: 1,
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        showBackground: true,
                        backgroundColor: Cesium.Color.WHITE,
                        backgroundPadding: new Cesium.Cartesian2(6, 2),
                        pixelOffset: new Cesium.Cartesian2(0, -34),
                        disableDepthTestDistance: Number.POSITIVE_INFINITY,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        show: false
                    },
                    properties: {
                        type: "city",
                        name: cityDataForCesium.name,
                        lonlat: cityDataForCesium.lonlat
                    }
                });
                cesiumCityEntitiesArray.push(cityEntityForCesium);
            }
        }
}

function moveCesiumCamera(targetLonlat, targetHeight) {
        if (cesiumViewer && !cesiumViewer.isDestroyed()) {
            isSyncingZoom = true;
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
                setTimeout(function() {
                    isSyncingZoom = false;
                }, 2000);
            }, 1500);
        }
}

function moveMap3D(lonlat, zoomLevel) {
    if (cesiumViewer) {
        let targetHeight = 15000;
        if (zoomLevel !== undefined) {
            const mapSize = map ? map.getSize() : null;
            targetHeight = zoomToHeight(zoomLevel, lonlat, mapSize);
        }
        cesiumViewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(lonlat[0], lonlat[1], targetHeight),
            duration: 1.5
        });
    }
}

function setMarker3D(lonlat) {
    if (cesiumViewer) {
        if (cesiumActiveMarker) {
            cesiumViewer.entities.remove(cesiumActiveMarker);
        }
        const cartographicPosition = Cesium.Cartographic.fromDegrees(lonlat[0], lonlat[1], 0);
        const cartesianPosition = cesiumViewer.scene.globe.ellipsoid.cartographicToCartesian(cartographicPosition);
        cesiumActiveMarker = cesiumViewer.entities.add({
            position: cartesianPosition,
            billboard: {
                image: markerIconImageUrl,
                width: 32,
                height: 32,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            },
            properties: {
                lonlat: lonlat
            }
        });
    }
}
