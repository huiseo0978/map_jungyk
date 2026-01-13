window.addEventListener("error", function(event) {
    if (event.message) {
        if (event.message.indexOf("CORS") !== -1) {
            event.preventDefault();
            return false;
        }
    }
    if (event.message) {
        if (event.message.indexOf("Failed to obtain image tile") !== -1) {
            event.preventDefault();
            return false;
        }
    }
}, false);

window.addEventListener("unhandledrejection", function(event) {
    if (event.reason) {
        if (event.reason.message) {
            if (event.reason.message.indexOf("CORS") !== -1) {
                event.preventDefault();
                return false;
            }
        }
    }
    if (event.reason) {
        if (event.reason.message) {
            if (event.reason.message.indexOf("Failed to obtain image tile") !== -1) {
                event.preventDefault();
                return false;
            }
        }
    }
}, false);

const mapCenter = [127.0276, 37.4979];
const mainView = new ol.View({
    center: ol.proj.fromLonLat(mapCenter),
    zoom: 12
});

const citySource = new ol.source.Vector();
const cityLayer = new ol.layer.Vector({ 
    source: citySource,
    renderMode: 'vector',
    declutter: false
});

const measureSource = new ol.source.Vector();
const measureLayer = new ol.layer.Vector({
    source: measureSource,
    style: new ol.style.Style({
        stroke: new ol.style.Stroke({ color: '#ffcc33', width: 3 }),
        image: new ol.style.Circle({
            radius: 5,
            fill: new ol.style.Fill({ color: '#ffcc33' })
        })
    })
});

const map = new ol.Map({
    target: "map",
    layers: [
        new ol.layer.Tile({ source: new ol.source.OSM() }), 
        cityLayer, 
        measureLayer
    ],
    view: mainView
});

const doubleClickZoomInteraction = map.getInteractions().getArray().find(function(interaction) {
    return interaction instanceof ol.interaction.DoubleClickZoom;
});
if (doubleClickZoomInteraction) {
    map.removeInteraction(doubleClickZoomInteraction);
}

const cityInfos = {
    seoul: { name: "서울", lonlat: [126.9780, 37.5665] },
    daegu: { name: "대구", lonlat: [128.6014, 35.8714] },
    busan: { name: "부산", lonlat: [129.0756, 35.1796] },
    jeju: { name: "제주", lonlat: [126.5312, 33.4996] }
};

const cityPointStyle = new ol.style.Style({
    image: new ol.style.Circle({
        radius: 7,
        fill: new ol.style.Fill({ color: "rgba(0, 123, 255, 1)" }),
        stroke: new ol.style.Stroke({ color: "white", width: 2 })
    })
});

const redMarkerStyle = new ol.style.Style({
    image: new ol.style.Circle({
        radius: 10,
        fill: new ol.style.Fill({ color: "rgba(255, 0, 0, 1)" }),
        stroke: new ol.style.Stroke({ color: "white", width: 3 })
    })
});

const cityKeysArray = Object.keys(cityInfos);
for (let cityIndex = 0; cityIndex < cityKeysArray.length; cityIndex = cityIndex + 1) {
    const cityKey = cityKeysArray[cityIndex];
    const cityData = cityInfos[cityKey];
    const cityFeaturePoint = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat(cityData.lonlat)),
        type: "city",
        name: cityData.name,
        lonlat: cityData.lonlat
    });
    cityFeaturePoint.setStyle(cityPointStyle);
    citySource.addFeature(cityFeaturePoint);
}

let activeMarker = null;
let markerBlinker = null;
let is3DModeActive = false;
let cesiumViewer = null;
let cesiumCityEntitiesArray = [];
let cesiumActiveMarker = null;
let cesiumEventHandler = null;

const popupElement = document.getElementById("popup");
const cityPopup = new ol.Overlay({
    element: popupElement,
    positioning: 'bottom-center',
    stopEvent: false
});
map.addOverlay(cityPopup);

let lastPointerMoveTime = 0;
let pointerMoveThrottleDelay = 50;

function handlePointerMoveEvent(event) {
    const currentTime = Date.now();
    if (currentTime - lastPointerMoveTime < pointerMoveThrottleDelay) {
        return;
    }
    lastPointerMoveTime = currentTime;
    
    const coordinateInfoElement = document.getElementById("coord-info");
    const coordinateLonLat = ol.proj.toLonLat(event.coordinate);
    if (coordinateInfoElement) {
        coordinateInfoElement.innerText = "위치: " + coordinateLonLat[0].toFixed(4) + "," + coordinateLonLat[1].toFixed(4);
    }

    if (is3DModeActive) {
        return;
    }
    if (isMeasuringNow) {
        return;
    }

    const featureAtPixel = map.forEachFeatureAtPixel(event.pixel, function(foundFeature) {
        return foundFeature;
    }, {
        layerFilter: function(targetLayer) {
            if (targetLayer === cityLayer) {
                return true;
            } else {
                return false;
            }
        },
        hitTolerance: 3
    });

    const popupContentElement = document.getElementById("popup-content");
    if (featureAtPixel) {
        const featureType = featureAtPixel.get("type");
        if (featureType === "city") {
            if (popupContentElement) {
                const cityNameValue = featureAtPixel.get("name");
                popupContentElement.innerHTML = cityNameValue;
            }
            cityPopup.setPosition(event.coordinate);
            const mapTargetElement = map.getTargetElement();
            if (mapTargetElement) {
                mapTargetElement.style.cursor = 'pointer';
            }
        } else {
            cityPopup.setPosition(undefined);
            const mapTargetElement = map.getTargetElement();
            if (mapTargetElement) {
                mapTargetElement.style.cursor = '';
            }
        }
    } else {
        cityPopup.setPosition(undefined);
        const mapTargetElement = map.getTargetElement();
        if (mapTargetElement) {
            mapTargetElement.style.cursor = '';
        }
    }
}

map.on("pointermove", handlePointerMoveEvent);

map.getView().on('change:resolution', function() {
    if (is3DModeActive) {
        return;
    }
    const levelInfoElement = document.getElementById("level-info");
    if (levelInfoElement) {
        const currentZoom = mainView.getZoom();
        const roundedZoom = Math.round(currentZoom);
        levelInfoElement.innerText = "줌 레벨: " + roundedZoom;
    }
});

function moveMap(lonlat, zoomLevel) {
    if (is3DModeActive) {
        if (cesiumViewer) {
            cesiumViewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(lonlat[0], lonlat[1], 15000),
                duration: 1.5
            });
        }
    } else {
        if (zoomLevel === undefined) {
            zoomLevel = 13;
        }
        const coordinate = ol.proj.fromLonLat(lonlat);
        mainView.animate({ center: coordinate, zoom: zoomLevel, duration: 700 });
    }
}

function setMarker(lonlat) {
    if (is3DModeActive) {
        if (cesiumViewer) {
            if (cesiumActiveMarker) {
                cesiumViewer.entities.remove(cesiumActiveMarker);
            }
            const cartographicPosition = Cesium.Cartographic.fromDegrees(lonlat[0], lonlat[1]);
            const cartesianPosition = Cesium.Cartesian3.fromRadians(cartographicPosition.longitude, cartographicPosition.latitude);
            cesiumActiveMarker = cesiumViewer.entities.add({
                position: cartesianPosition,
                point: {
                    pixelSize: 20,
                    color: Cesium.Color.RED,
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 3,
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                }
            });
        }
    } else {
        const coord = ol.proj.fromLonLat(lonlat);
        if (activeMarker === null) {
            activeMarker = new ol.Feature(new ol.geom.Point(coord));
            activeMarker.setStyle(redMarkerStyle);
            citySource.addFeature(activeMarker);
        } else {
            activeMarker.getGeometry().setCoordinates(coord);
        }
    }
}

function blinkMarker(featureToBlink, styleToApply) {
    if (is3DModeActive) {
        if (cesiumActiveMarker) {
            if (markerBlinker) {
                clearInterval(markerBlinker);
            }
            let blinkCount = 0;
            let isVisible = true;
            markerBlinker = setInterval(function() {
                if (isVisible) {
                    isVisible = false;
                } else {
                    isVisible = true;
                }
                if (isVisible) {
                    cesiumActiveMarker.point.pixelSize = 20;
                } else {
                    cesiumActiveMarker.point.pixelSize = 0;
                }
                blinkCount = blinkCount + 1;
                if (blinkCount >= 10) {
                    clearInterval(markerBlinker);
                    markerBlinker = null;
                    cesiumActiveMarker.point.pixelSize = 20;
                }
            }, 250);
        }
    } else {
        if (markerBlinker) {
            clearInterval(markerBlinker);
        }
        let blinkCount = 0;
        let isVisible = true;
        markerBlinker = setInterval(function() {
            if (isVisible) {
                isVisible = false;
            } else {
                isVisible = true;
            }
            if (isVisible) {
                featureToBlink.setStyle(styleToApply);
            } else {
                featureToBlink.setStyle(null);
            }
            blinkCount = blinkCount + 1;
            if (blinkCount >= 10) {
                clearInterval(markerBlinker);
                markerBlinker = null;
                featureToBlink.setStyle(styleToApply);
            }
        }, 250);
    }
}

let measureDrawInteraction = null;
let measureTooltipOverlayElement = null;
let measureTooltipOverlay = null;
let measureResultsArray = [];
let isMeasuringNow = false;
let measurePointsArray = [];
let measureCurrentLineFeature = null;
let measureClickEventHandler = null;
let measurePointFeaturesArray = [];
let cesiumMeasureEntitiesArray = [];
let cesiumMeasurePolylineEntity = null;
let cesiumMeasureClickHandler = null;
let cesiumMeasureTooltipLabel = null;
let isMoveModalOpen = false;
let moveMapClickHandler = null;
let cesiumMoveMapClickHandler = null;
let lastMeasureResult = null;

function openMeasureModal() {
    const measureModalElement = document.getElementById("measureModal");
    if (measureModalElement) {
        measureModalElement.style.display = "block";
    }
    setTimeout(function() {
        makeModalDraggable();
    }, 10);
}

function closeMeasureModal() {
    const measureModalElement = document.getElementById("measureModal");
    if (measureModalElement) {
        measureModalElement.style.display = "none";
    }
    stopMeasureFunction();
}

function stopMeasureFunction() {
    isMeasuringNow = false;
    
    if (is3DModeActive) {
        stopMeasure3DFunction();
    } else {
        stopMeasure2DFunction();
    }
    
    measurePointsArray = [];
}

function stopMeasure2DFunction() {
    if (measureClickEventHandler) {
        try {
            map.un('click', measureClickEventHandler);
        } catch (error) {
        }
        measureClickEventHandler = null;
    }
    if (measureDrawInteraction) {
        map.removeInteraction(measureDrawInteraction);
        measureDrawInteraction = null;
    }
    if (measureTooltipOverlayElement) {
        if (measureTooltipOverlayElement.parentNode) {
            measureTooltipOverlayElement.parentNode.removeChild(measureTooltipOverlayElement);
        }
        measureTooltipOverlayElement = null;
    }
    if (measureTooltipOverlay) {
        map.removeOverlay(measureTooltipOverlay);
        measureTooltipOverlay = null;
    }
    if (measureCurrentLineFeature) {
        measureSource.removeFeature(measureCurrentLineFeature);
        measureCurrentLineFeature = null;
    }
    for (let pointIndex = 0; pointIndex < measurePointFeaturesArray.length; pointIndex = pointIndex + 1) {
        const currentPointFeature = measurePointFeaturesArray[pointIndex];
        if (currentPointFeature) {
            measureSource.removeFeature(currentPointFeature);
        }
    }
    measurePointFeaturesArray = [];
    const mapElement = map.getTargetElement();
    if (mapElement) {
        mapElement.style.cursor = '';
    }
}

function stopMeasure3DFunction() {
    if (cesiumMeasureClickHandler) {
        cesiumMeasureClickHandler.destroy();
        cesiumMeasureClickHandler = null;
    }
    if (cesiumViewer) {
        const cesiumCanvasElement = cesiumViewer.scene.canvas;
        if (cesiumCanvasElement) {
            cesiumCanvasElement.style.cursor = '';
        }
        for (let entityIndex = 0; entityIndex < cesiumMeasureEntitiesArray.length; entityIndex = entityIndex + 1) {
            const currentEntity = cesiumMeasureEntitiesArray[entityIndex];
            if (currentEntity) {
                cesiumViewer.entities.remove(currentEntity);
            }
        }
        if (cesiumMeasurePolylineEntity) {
            cesiumViewer.entities.remove(cesiumMeasurePolylineEntity);
            cesiumMeasurePolylineEntity = null;
        }
        if (cesiumMeasureTooltipLabel) {
            cesiumViewer.entities.remove(cesiumMeasureTooltipLabel);
            cesiumMeasureTooltipLabel = null;
        }
    }
    cesiumMeasureEntitiesArray = [];
}

function startMeasure() {
    if (isMeasuringNow) {
        return;
    }
    
    isMeasuringNow = true;
    measurePointsArray = [];
    measurePointFeaturesArray = [];
    cesiumMeasureEntitiesArray = [];
    lastMeasureResult = null;
    
    if (is3DModeActive) {
        startMeasure3D();
    } else {
        startMeasure2D();
    }
}

function continueMeasureFromResult(targetResultId) {
    if (isMeasuringNow) {
        return;
    }
    
    for (let searchIndex = 0; searchIndex < measureResultsArray.length; searchIndex = searchIndex + 1) {
        const currentItem = measureResultsArray[searchIndex];
        if (currentItem.id === targetResultId && !currentItem.isPoint) {
            if (currentItem.pointsArray && currentItem.pointsArray.length > 0) {
                isMeasuringNow = true;
                measurePointsArray = [];
                measurePointFeaturesArray = [];
                cesiumMeasureEntitiesArray = [];
                
                if (is3DModeActive) {
                    for (let pointIndex = 0; pointIndex < currentItem.pointsArray.length; pointIndex = pointIndex + 1) {
                        const currentPoint = currentItem.pointsArray[pointIndex];
                        const cartographicPosition = Cesium.Cartographic.fromDegrees(currentPoint[0], currentPoint[1]);
                        const cartesianPosition = Cesium.Cartesian3.fromRadians(cartographicPosition.longitude, cartographicPosition.latitude);
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
                        cesiumMeasureEntitiesArray.push(pointEntity);
                        measurePointsArray.push(currentPoint);
                    }
                    if (cesiumMeasureEntitiesArray.length >= 2) {
                        const positionsArray = [];
                        for (let entityIndex = 0; entityIndex < cesiumMeasureEntitiesArray.length; entityIndex = entityIndex + 1) {
                            positionsArray.push(cesiumMeasureEntitiesArray[entityIndex].position.getValue());
                        }
                        if (cesiumMeasurePolylineEntity) {
                            cesiumViewer.entities.remove(cesiumMeasurePolylineEntity);
                        }
                        cesiumMeasurePolylineEntity = cesiumViewer.entities.add({
                            polyline: {
                                positions: positionsArray,
                                width: 3,
                                material: Cesium.Color.BLUE.withAlpha(0.4),
                                clampToGround: true
                            }
                        });
                        const totalDistance = calculateCesiumDistance();
                        const distanceText = formatCesiumDistance(totalDistance);
                        const lastEntity = cesiumMeasureEntitiesArray[cesiumMeasureEntitiesArray.length - 1];
                        const lastPosition = lastEntity.position.getValue();
                        if (cesiumMeasureTooltipLabel) {
                            cesiumViewer.entities.remove(cesiumMeasureTooltipLabel);
                        }
                        cesiumMeasureTooltipLabel = cesiumViewer.entities.add({
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
                    startMeasure3D();
                } else {
                    for (let pointIndex = 0; pointIndex < currentItem.pointsArray.length; pointIndex = pointIndex + 1) {
                        const currentPoint = currentItem.pointsArray[pointIndex];
                        const coordinate = ol.proj.fromLonLat(currentPoint);
                        const clickedPointFeature = new ol.Feature({
                            geometry: new ol.geom.Point(coordinate)
                        });
                        const pointStyleForMeasure = new ol.style.Style({
                            image: new ol.style.Circle({
                                radius: 6,
                                fill: new ol.style.Fill({ color: 'rgba(0, 0, 255, 0.8)' }),
                                stroke: new ol.style.Stroke({ color: 'white', width: 2 })
                            })
                        });
                        clickedPointFeature.setStyle(pointStyleForMeasure);
                        measureSource.addFeature(clickedPointFeature);
                        measurePointFeaturesArray.push(clickedPointFeature);
                        measurePointsArray.push(coordinate);
                    }
                    if (measurePointsArray.length >= 2) {
                        if (measureCurrentLineFeature) {
                            measureSource.removeFeature(measureCurrentLineFeature);
                        }
                        const measureLineStyleObject = new ol.style.Style({
                            stroke: new ol.style.Stroke({
                                color: 'rgba(0, 0, 255, 0.6)',
                                width: 3
                            })
                        });
                        measureCurrentLineFeature = new ol.Feature({
                            geometry: new ol.geom.LineString(measurePointsArray)
                        });
                        measureCurrentLineFeature.setStyle(measureLineStyleObject);
                        measureSource.addFeature(measureCurrentLineFeature);
                        createMeasureTooltipFunction();
                        const currentLineGeometry = new ol.geom.LineString(measurePointsArray);
                        const calculatedDistance = formatLength(currentLineGeometry);
                        if (measureTooltipOverlayElement) {
                            measureTooltipOverlayElement.innerHTML = calculatedDistance;
                            measureTooltipOverlay.setPosition(measurePointsArray[measurePointsArray.length - 1]);
                        }
                    }
                    startMeasure2D();
                }
            }
            break;
        }
    }
}

function startMeasure2D() {
    measureClickEventHandler = function(clickEvent) {
        handleMeasureClickFunction(clickEvent);
    };
    
    map.on('click', measureClickEventHandler);
    createMeasureTooltipFunction();
    
    const mapElement = map.getTargetElement();
    if (mapElement) {
        mapElement.style.cursor = 'crosshair';
    }
    
    const measureLineStyleObject = new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: 'rgba(0, 0, 255, 0.6)',
            width: 3
        })
    });
    
    measureCurrentLineFeature = new ol.Feature({
        geometry: new ol.geom.LineString([])
    });
    measureCurrentLineFeature.setStyle(measureLineStyleObject);
    measureSource.addFeature(measureCurrentLineFeature);
}

function startMeasure3D() {
    if (cesiumViewer === null) {
        return;
    }
    
    const cesiumCanvasElement = cesiumViewer.scene.canvas;
    if (cesiumCanvasElement) {
        cesiumCanvasElement.style.cursor = 'crosshair';
    }
    
    cesiumMeasureClickHandler = new Cesium.ScreenSpaceEventHandler(cesiumCanvasElement);
    cesiumMeasureClickHandler.setInputAction(function(clickEvent) {
        handleMeasureClick3DFunction(clickEvent);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    
    cesiumMeasurePolylineEntity = cesiumViewer.entities.add({
        polyline: {
            positions: [],
            width: 3,
            material: Cesium.Color.BLUE.withAlpha(0.4),
            clampToGround: true
        }
    });
}

function handleMeasureClickFunction(event) {
    if (!isMeasuringNow) {
        return;
    }
    
    const clickedCoordinate = event.coordinate;
    measurePointsArray.push(clickedCoordinate);
    
    const clickedPointFeature = new ol.Feature({
        geometry: new ol.geom.Point(clickedCoordinate)
    });
    const pointStyleForMeasure = new ol.style.Style({
        image: new ol.style.Circle({
            radius: 6,
            fill: new ol.style.Fill({ color: 'rgba(0, 0, 255, 0.8)' }),
            stroke: new ol.style.Stroke({ color: 'white', width: 2 })
        })
    });
    clickedPointFeature.setStyle(pointStyleForMeasure);
    measureSource.addFeature(clickedPointFeature);
    measurePointFeaturesArray.push(clickedPointFeature);
    
    const clickedLonLat = ol.proj.toLonLat(clickedCoordinate);
    
    let displayText = "";
    if (measurePointsArray.length >= 2) {
        const currentLineGeometry = new ol.geom.LineString(measurePointsArray);
        const calculatedDistance = formatLength(currentLineGeometry);
        displayText = calculatedDistance;
        
        measureCurrentLineFeature.setGeometry(currentLineGeometry);
        if (measureTooltipOverlayElement) {
            measureTooltipOverlayElement.innerHTML = calculatedDistance;
            measureTooltipOverlay.setPosition(clickedCoordinate);
        }
    } else {
        displayText = clickedLonLat[0].toFixed(4) + "," + clickedLonLat[1].toFixed(4);
    }
    
    const pointResultId = Date.now() + measurePointsArray.length;
    measureResultsArray.push({
        id: pointResultId,
        text: displayText,
        coord: clickedLonLat,
        feature: clickedPointFeature,
        isPoint: true
    });
    updateMeasureListFunction();
}

function finishMeasureFunction() {
    if (!isMeasuringNow) {
        return;
    }
    
    if (is3DModeActive) {
        finishMeasure3DFunction();
    } else {
        finishMeasure2DFunction();
    }
}

function finishMeasure2DFunction() {
    if (measurePointsArray.length >= 2) {
        const lineGeometry = new ol.geom.LineString(measurePointsArray);
        const distanceText = formatLength(lineGeometry);
        const resultId = Date.now();
        const lastPointCoordinate = measurePointsArray[measurePointsArray.length - 1];
        const lastPointLonLat = ol.proj.toLonLat(lastPointCoordinate);
        
        for (let resultIndex = measureResultsArray.length - 1; resultIndex >= 0; resultIndex = resultIndex - 1) {
            const currentResult = measureResultsArray[resultIndex];
            if (currentResult.isPoint) {
                measureResultsArray.splice(resultIndex, 1);
            }
        }
        
        const pointsArrayCopy = [];
        for (let pointIndex = 0; pointIndex < measurePointsArray.length; pointIndex = pointIndex + 1) {
            const currentPoint = measurePointsArray[pointIndex];
            const pointLonLat = ol.proj.toLonLat(currentPoint);
            pointsArrayCopy.push(pointLonLat);
        }
        
        let savedLineFeatureForResult = null;
        if (measureCurrentLineFeature) {
            savedLineFeatureForResult = measureCurrentLineFeature;
        }
        
        const savedPointFeaturesArray = [];
        for (let pointIndex = 0; pointIndex < measurePointFeaturesArray.length; pointIndex = pointIndex + 1) {
            const currentPointFeature = measurePointFeaturesArray[pointIndex];
            if (currentPointFeature) {
                savedPointFeaturesArray.push(currentPointFeature);
            }
        }
        
        lastMeasureResult = {
            id: resultId,
            text: distanceText,
            coord: lastPointLonLat,
            feature: savedLineFeatureForResult,
            pointFeatures: savedPointFeaturesArray,
            pointsArray: pointsArrayCopy,
            isPoint: false
        };
        
        measureResultsArray.push(lastMeasureResult);
        updateMeasureListFunction();
        
        if (measureCurrentLineFeature) {
            measureCurrentLineFeature = null;
        }
        if (measureTooltipOverlayElement) {
            if (measureTooltipOverlayElement.parentNode) {
                measureTooltipOverlayElement.parentNode.removeChild(measureTooltipOverlayElement);
            }
            measureTooltipOverlayElement = null;
        }
        if (measureTooltipOverlay) {
            map.removeOverlay(measureTooltipOverlay);
            measureTooltipOverlay = null;
        }
        
        if (activeMarker) {
            citySource.removeFeature(activeMarker);
            activeMarker = null;
        }
        if (markerBlinker) {
            clearInterval(markerBlinker);
            markerBlinker = null;
        }
        
        measurePointFeaturesArray = [];
        measurePointsArray = [];
    }
    
    isMeasuringNow = false;
    if (measureClickEventHandler) {
        try {
            map.un('click', measureClickEventHandler);
        } catch (error) {
        }
        measureClickEventHandler = null;
    }
    if (measureDrawInteraction) {
        map.removeInteraction(measureDrawInteraction);
        measureDrawInteraction = null;
    }
    const mapElement = map.getTargetElement();
    if (mapElement) {
        mapElement.style.cursor = '';
    }
}

function finishMeasure3DFunction() {
    if (cesiumMeasureEntitiesArray.length >= 2) {
        const totalDistance = calculateCesiumDistance();
        const distanceText = formatCesiumDistance(totalDistance);
        const resultId = Date.now();
        const lastEntity = cesiumMeasureEntitiesArray[cesiumMeasureEntitiesArray.length - 1];
        const lastPosition = lastEntity.position.getValue();
        const lastCartographic = Cesium.Cartographic.fromCartesian(lastPosition);
        const lastLonLat = [Cesium.Math.toDegrees(lastCartographic.longitude), Cesium.Math.toDegrees(lastCartographic.latitude)];
        
        for (let resultIndex = measureResultsArray.length - 1; resultIndex >= 0; resultIndex = resultIndex - 1) {
            const currentResult = measureResultsArray[resultIndex];
            if (currentResult.isPoint) {
                measureResultsArray.splice(resultIndex, 1);
            }
        }
        
        const pointsArrayCopy = [];
        for (let pointIndex = 0; pointIndex < measurePointsArray.length; pointIndex = pointIndex + 1) {
            const currentPoint = measurePointsArray[pointIndex];
            pointsArrayCopy.push([currentPoint[0], currentPoint[1]]);
        }
        
        let savedPolylineEntityForResult = null;
        if (cesiumMeasurePolylineEntity) {
            savedPolylineEntityForResult = cesiumMeasurePolylineEntity;
        }
        
        const savedPointEntitiesArray = [];
        for (let entityIndex = 0; entityIndex < cesiumMeasureEntitiesArray.length; entityIndex = entityIndex + 1) {
            const currentEntity = cesiumMeasureEntitiesArray[entityIndex];
            if (currentEntity) {
                savedPointEntitiesArray.push(currentEntity);
            }
        }
        
        lastMeasureResult = {
            id: resultId,
            text: distanceText,
            coord: lastLonLat,
            feature: savedPolylineEntityForResult,
            pointEntities: savedPointEntitiesArray,
            pointsArray: pointsArrayCopy,
            isPoint: false
        };
        
        measureResultsArray.push(lastMeasureResult);
        updateMeasureListFunction();
        
        if (cesiumMeasurePolylineEntity) {
            cesiumMeasurePolylineEntity = null;
        }
        if (cesiumMeasureTooltipLabel) {
            cesiumViewer.entities.remove(cesiumMeasureTooltipLabel);
            cesiumMeasureTooltipLabel = null;
        }
        
        if (activeMarker) {
            citySource.removeFeature(activeMarker);
            activeMarker = null;
        }
        if (markerBlinker) {
            clearInterval(markerBlinker);
            markerBlinker = null;
        }
        
        cesiumMeasureEntitiesArray = [];
        measurePointsArray = [];
    }
    
    isMeasuringNow = false;
    if (cesiumMeasureClickHandler) {
        cesiumMeasureClickHandler.destroy();
        cesiumMeasureClickHandler = null;
    }
    if (cesiumViewer) {
        const cesiumCanvasElement = cesiumViewer.scene.canvas;
        if (cesiumCanvasElement) {
            cesiumCanvasElement.style.cursor = '';
        }
    }
}

function handleMeasureClick3DFunction(clickEvent) {
    if (!isMeasuringNow) {
        return;
    }
    if (cesiumViewer === null) {
        return;
    }
    
    const pickedPosition = cesiumViewer.camera.pickEllipsoid(clickEvent.position, cesiumViewer.scene.globe.ellipsoid);
    if (pickedPosition === undefined) {
        return;
    }
    
    const cartographicPosition = Cesium.Cartographic.fromCartesian(pickedPosition);
    const longitudeDegrees = Cesium.Math.toDegrees(cartographicPosition.longitude);
    const latitudeDegrees = Cesium.Math.toDegrees(cartographicPosition.latitude);
    const lonLatArray = [longitudeDegrees, latitudeDegrees];
    measurePointsArray.push(lonLatArray);
    
    const pointEntity = cesiumViewer.entities.add({
        position: pickedPosition,
        point: {
            pixelSize: 12,
            color: Cesium.Color.BLUE.withAlpha(0.8),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        }
    });
    cesiumMeasureEntitiesArray.push(pointEntity);
    
    if (cesiumMeasureEntitiesArray.length >= 2) {
        const positionsArray = [];
        for (let entityIndex = 0; entityIndex < cesiumMeasureEntitiesArray.length; entityIndex = entityIndex + 1) {
            const currentEntity = cesiumMeasureEntitiesArray[entityIndex];
            if (currentEntity) {
                const entityPosition = currentEntity.position.getValue();
                positionsArray.push(entityPosition);
            }
        }
        if (cesiumMeasurePolylineEntity && cesiumMeasurePolylineEntity.polyline) {
            cesiumMeasurePolylineEntity.polyline.positions = positionsArray;
        }
    }
    
    let displayText = "";
    if (cesiumMeasureEntitiesArray.length >= 2) {
        const totalDistance = calculateCesiumDistance();
        const distanceText = formatCesiumDistance(totalDistance);
        displayText = distanceText;
        
        if (cesiumMeasureTooltipLabel) {
            cesiumViewer.entities.remove(cesiumMeasureTooltipLabel);
        }
        cesiumMeasureTooltipLabel = cesiumViewer.entities.add({
            position: pickedPosition,
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
    } else {
        displayText = longitudeDegrees.toFixed(4) + "," + latitudeDegrees.toFixed(4);
        if (cesiumMeasureEntitiesArray.length === 1) {
            if (cesiumMeasureTooltipLabel) {
                cesiumViewer.entities.remove(cesiumMeasureTooltipLabel);
                cesiumMeasureTooltipLabel = null;
            }
        }
    }
    
    const pointResultId = Date.now() + cesiumMeasureEntitiesArray.length;
    measureResultsArray.push({
        id: pointResultId,
        text: displayText,
        coord: lonLatArray,
        feature: pointEntity,
        isPoint: true
    });
    updateMeasureListFunction();
}

function calculateCesiumDistance() {
    let totalDistanceValue = 0;
    for (let pointIndex = 0; pointIndex < cesiumMeasureEntitiesArray.length - 1; pointIndex = pointIndex + 1) {
        const currentEntity = cesiumMeasureEntitiesArray[pointIndex];
        const nextEntity = cesiumMeasureEntitiesArray[pointIndex + 1];
        const currentPosition = currentEntity.position.getValue();
        const nextPosition = nextEntity.position.getValue();
        const segmentDistance = Cesium.Cartesian3.distance(currentPosition, nextPosition);
        totalDistanceValue = totalDistanceValue + segmentDistance;
    }
    return totalDistanceValue;
}

function formatCesiumDistance(totalDistanceValue) {
    if (totalDistanceValue > 1000) {
        const kilometersValue = totalDistanceValue / 1000;
        const roundedKilometers = Math.round(kilometersValue * 100) / 100;
        return roundedKilometers + ' km';
    } else {
        const roundedMeters = Math.round(totalDistanceValue);
        return roundedMeters + ' m';
    }
}

function formatLength(lineGeometry) {
    const totalLength = ol.sphere.getLength(lineGeometry);
    if (totalLength > 1000) {
        const kilometersValue = totalLength / 1000;
        const roundedKilometers = Math.round(kilometersValue * 100) / 100;
        return roundedKilometers + ' km';
    } else {
        const roundedMeters = Math.round(totalLength);
        return roundedMeters + ' m';
    }
}

function createMeasureTooltipFunction() {
    if (measureTooltipOverlay) {
        map.removeOverlay(measureTooltipOverlay);
        measureTooltipOverlay = null;
    }
    if (measureTooltipOverlayElement) {
        if (measureTooltipOverlayElement.parentNode) {
            measureTooltipOverlayElement.parentNode.removeChild(measureTooltipOverlayElement);
            measureTooltipOverlayElement = null;
        }
    }
    measureTooltipOverlayElement = document.createElement('div');
    measureTooltipOverlayElement.className = 'ol-tooltip';
    measureTooltipOverlay = new ol.Overlay({
        element: measureTooltipOverlayElement,
        offset: [0, -15],
        positioning: 'bottom-center'
    });
    map.addOverlay(measureTooltipOverlay);
}

function updateMeasureListFunction() {
    const resultsContainer = document.getElementById("measure-results");
    if (!resultsContainer) {
        return;
    }
    resultsContainer.innerHTML = "";
    if (measureResultsArray.length === 0) {
        resultsContainer.innerHTML = "결과가 여기에 표시됩니다.";
        return;
    }
    for (let resultIndex = 0; resultIndex < measureResultsArray.length; resultIndex = resultIndex + 1) {
        const currentResultItem = measureResultsArray[resultIndex];
        const measureItemDiv = document.createElement("div");
        measureItemDiv.className = "measure-item";
        
        const measureTextSpan = document.createElement("span");
        measureTextSpan.className = "measure-text";
        measureTextSpan.textContent = currentResultItem.text;
        measureTextSpan.onclick = function() {
            goToMeasureEndPoint(currentResultItem.id);
        };
        
        const measureDeleteSpan = document.createElement("span");
        measureDeleteSpan.className = "measure-delete";
        measureDeleteSpan.textContent = "삭제";
        measureDeleteSpan.onclick = function() {
            removeMeasureItem(currentResultItem.id);
        };
        
        measureItemDiv.appendChild(measureTextSpan);
        measureItemDiv.appendChild(measureDeleteSpan);
        
        resultsContainer.appendChild(measureItemDiv);
    }
}

function goToMeasureEndPoint(targetResultId) {
    for (let searchIndex = 0; searchIndex < measureResultsArray.length; searchIndex = searchIndex + 1) {
        const currentItem = measureResultsArray[searchIndex];
        if (currentItem.id === targetResultId) {
            moveMap(currentItem.coord, 15);
            setMarker(currentItem.coord);
            if (is3DModeActive) {
                if (cesiumActiveMarker) {
                    blinkMarker(null, null);
                    setTimeout(function() {
                        if (cesiumActiveMarker) {
                            cesiumViewer.entities.remove(cesiumActiveMarker);
                            cesiumActiveMarker = null;
                        }
                        if (markerBlinker) {
                            clearInterval(markerBlinker);
                            markerBlinker = null;
                        }
                    }, 5000);
                }
            } else {
                if (activeMarker) {
                    blinkMarker(activeMarker, redMarkerStyle);
                    setTimeout(function() {
                        if (activeMarker) {
                            citySource.removeFeature(activeMarker);
                            activeMarker = null;
                        }
                        if (markerBlinker) {
                            clearInterval(markerBlinker);
                            markerBlinker = null;
                        }
                    }, 5000);
                }
            }
            break;
        }
    }
}

function removeMeasureItem(targetResultId) {
    for (let searchIndex = 0; searchIndex < measureResultsArray.length; searchIndex = searchIndex + 1) {
        const currentItem = measureResultsArray[searchIndex];
        if (currentItem.id === targetResultId) {
            if (currentItem.isPoint) {
                if (is3DModeActive) {
                    if (cesiumViewer) {
                        if (currentItem.feature) {
                            cesiumViewer.entities.remove(currentItem.feature);
                        }
                    }
                } else {
                    if (currentItem.feature) {
                        measureSource.removeFeature(currentItem.feature);
                    }
                }
                
                const removedCoord = currentItem.coord;
                let removedPointIndex = -1;
                
                for (let pointIndex = 0; pointIndex < measurePointsArray.length; pointIndex = pointIndex + 1) {
                    if (is3DModeActive) {
                        if (measurePointsArray[pointIndex][0] === removedCoord[0] && measurePointsArray[pointIndex][1] === removedCoord[1]) {
                            removedPointIndex = pointIndex;
                            measurePointsArray.splice(pointIndex, 1);
                            break;
                        }
                    } else {
                        const currentPointLonLat = ol.proj.toLonLat(measurePointsArray[pointIndex]);
                        if (currentPointLonLat[0] === removedCoord[0] && currentPointLonLat[1] === removedCoord[1]) {
                            removedPointIndex = pointIndex;
                            measurePointsArray.splice(pointIndex, 1);
                            break;
                        }
                    }
                }
                
                if (removedPointIndex >= 0) {
                    if (is3DModeActive) {
                        if (removedPointIndex < cesiumMeasureEntitiesArray.length) {
                            const removedEntity = cesiumMeasureEntitiesArray[removedPointIndex];
                            if (removedEntity) {
                                cesiumViewer.entities.remove(removedEntity);
                            }
                            cesiumMeasureEntitiesArray.splice(removedPointIndex, 1);
                        }
                        
                        if (cesiumMeasurePolylineEntity) {
                            cesiumViewer.entities.remove(cesiumMeasurePolylineEntity);
                            cesiumMeasurePolylineEntity = null;
                        }
                        
                        if (measurePointsArray.length >= 2) {
                            const positionsArray = [];
                            for (let entityIndex = 0; entityIndex < cesiumMeasureEntitiesArray.length; entityIndex = entityIndex + 1) {
                                const currentEntity = cesiumMeasureEntitiesArray[entityIndex];
                                if (currentEntity) {
                                    positionsArray.push(currentEntity.position.getValue());
                                }
                            }
                            cesiumMeasurePolylineEntity = cesiumViewer.entities.add({
                                polyline: {
                                    positions: positionsArray,
                                    width: 3,
                                    material: Cesium.Color.BLUE.withAlpha(0.4),
                                    clampToGround: true
                                }
                            });
                            
                            const totalDistance = calculateCesiumDistance();
                            const distanceText = formatCesiumDistance(totalDistance);
                            if (cesiumMeasureTooltipLabel) {
                                cesiumViewer.entities.remove(cesiumMeasureTooltipLabel);
                            }
                            if (cesiumMeasureEntitiesArray.length > 0) {
                                const lastEntity = cesiumMeasureEntitiesArray[cesiumMeasureEntitiesArray.length - 1];
                                const lastPosition = lastEntity.position.getValue();
                                cesiumMeasureTooltipLabel = cesiumViewer.entities.add({
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
                        } else {
                            if (cesiumMeasureTooltipLabel) {
                                cesiumViewer.entities.remove(cesiumMeasureTooltipLabel);
                                cesiumMeasureTooltipLabel = null;
                            }
                        }
                    } else {
                        if (removedPointIndex < measurePointFeaturesArray.length) {
                            const removedFeature = measurePointFeaturesArray[removedPointIndex];
                            if (removedFeature) {
                                measureSource.removeFeature(removedFeature);
                            }
                            measurePointFeaturesArray.splice(removedPointIndex, 1);
                        }
                        
                        if (measureCurrentLineFeature) {
                            measureSource.removeFeature(measureCurrentLineFeature);
                            measureCurrentLineFeature = null;
                        }
                        
                        if (measurePointsArray.length >= 2) {
                            if (!measureTooltipOverlay) {
                                createMeasureTooltipFunction();
                            }
                            const measureLineStyleObject = new ol.style.Style({
                                stroke: new ol.style.Stroke({
                                    color: 'rgba(0, 0, 255, 0.6)',
                                    width: 3
                                })
                            });
                            
                            measureCurrentLineFeature = new ol.Feature({
                                geometry: new ol.geom.LineString(measurePointsArray)
                            });
                            measureCurrentLineFeature.setStyle(measureLineStyleObject);
                            measureSource.addFeature(measureCurrentLineFeature);
                            
                            const currentLineGeometry = new ol.geom.LineString(measurePointsArray);
                            const calculatedDistance = formatLength(currentLineGeometry);
                            if (measureTooltipOverlayElement) {
                                measureTooltipOverlayElement.innerHTML = calculatedDistance;
                                if (measurePointsArray.length > 0) {
                                    const lastPointCoordinate = measurePointsArray[measurePointsArray.length - 1];
                                    measureTooltipOverlay.setPosition(lastPointCoordinate);
                                }
                            }
                        } else {
                            if (measureTooltipOverlayElement) {
                                if (measureTooltipOverlayElement.parentNode) {
                                    measureTooltipOverlayElement.parentNode.removeChild(measureTooltipOverlayElement);
                                }
                                measureTooltipOverlayElement = null;
                            }
                            if (measureTooltipOverlay) {
                                map.removeOverlay(measureTooltipOverlay);
                                measureTooltipOverlay = null;
                            }
                        }
                    }
                    
                    for (let resultIndex = 0; resultIndex < measureResultsArray.length; resultIndex = resultIndex + 1) {
                        const currentResultItem = measureResultsArray[resultIndex];
                        if (currentResultItem.isPoint && currentResultItem.id !== targetResultId) {
                            if (is3DModeActive) {
                                if (measurePointsArray.length >= 2) {
                                    const totalDistance = calculateCesiumDistance();
                                    const distanceText = formatCesiumDistance(totalDistance);
                                    currentResultItem.text = distanceText;
                                } else {
                                    if (currentResultItem.coord) {
                                        currentResultItem.text = currentResultItem.coord[0].toFixed(4) + "," + currentResultItem.coord[1].toFixed(4);
                                    }
                                }
                            } else {
                                if (measurePointsArray.length >= 2) {
                                    const currentLineGeometry = new ol.geom.LineString(measurePointsArray);
                                    const calculatedDistance = formatLength(currentLineGeometry);
                                    currentResultItem.text = calculatedDistance;
                                } else {
                                    if (currentResultItem.coord) {
                                        currentResultItem.text = currentResultItem.coord[0].toFixed(4) + "," + currentResultItem.coord[1].toFixed(4);
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                if (currentItem.feature) {
                    if (is3DModeActive) {
                        if (cesiumViewer) {
                            cesiumViewer.entities.remove(currentItem.feature);
                        }
                    } else {
                        measureSource.removeFeature(currentItem.feature);
                    }
                }
                if (currentItem.pointEntities) {
                    if (cesiumViewer) {
                        for (let pointIndex = 0; pointIndex < currentItem.pointEntities.length; pointIndex = pointIndex + 1) {
                            const currentPointEntity = currentItem.pointEntities[pointIndex];
                            if (currentPointEntity) {
                                cesiumViewer.entities.remove(currentPointEntity);
                            }
                        }
                    }
                }
                if (currentItem.pointFeatures) {
                    for (let pointIndex = 0; pointIndex < currentItem.pointFeatures.length; pointIndex = pointIndex + 1) {
                        const currentPointFeature = currentItem.pointFeatures[pointIndex];
                        if (currentPointFeature) {
                            measureSource.removeFeature(currentPointFeature);
                        }
                    }
                }
                
                if (is3DModeActive) {
                    if (cesiumActiveMarker) {
                        const markerPosition = cesiumActiveMarker.position.getValue();
                        const markerCartographic = Cesium.Cartographic.fromCartesian(markerPosition);
                        const markerLon = Cesium.Math.toDegrees(markerCartographic.longitude);
                        const markerLat = Cesium.Math.toDegrees(markerCartographic.latitude);
                        const coordDiffLon = Math.abs(markerLon - currentItem.coord[0]);
                        const coordDiffLat = Math.abs(markerLat - currentItem.coord[1]);
                        if (coordDiffLon < 0.0001 && coordDiffLat < 0.0001) {
                            cesiumViewer.entities.remove(cesiumActiveMarker);
                            cesiumActiveMarker = null;
                            if (markerBlinker) {
                                clearInterval(markerBlinker);
                                markerBlinker = null;
                            }
                        }
                    }
                } else {
                    if (activeMarker) {
                        const markerCoord = ol.proj.toLonLat(activeMarker.getGeometry().getCoordinates());
                        const coordDiffLon = Math.abs(markerCoord[0] - currentItem.coord[0]);
                        const coordDiffLat = Math.abs(markerCoord[1] - currentItem.coord[1]);
                        if (coordDiffLon < 0.0001 && coordDiffLat < 0.0001) {
                            citySource.removeFeature(activeMarker);
                            activeMarker = null;
                            if (markerBlinker) {
                                clearInterval(markerBlinker);
                                markerBlinker = null;
                            }
                        }
                    }
                }
            }
            
            measureResultsArray.splice(searchIndex, 1);
            updateMeasureListFunction();
            break;
        }
    }
}

function clearMeasures() {
    if (is3DModeActive) {
        if (cesiumViewer) {
            for (let resultIndex = 0; resultIndex < measureResultsArray.length; resultIndex = resultIndex + 1) {
                const currentResult = measureResultsArray[resultIndex];
                if (currentResult.feature) {
                    cesiumViewer.entities.remove(currentResult.feature);
                }
                if (currentResult.pointEntities) {
                    for (let pointIndex = 0; pointIndex < currentResult.pointEntities.length; pointIndex = pointIndex + 1) {
                        const currentPointEntity = currentResult.pointEntities[pointIndex];
                        if (currentPointEntity) {
                            cesiumViewer.entities.remove(currentPointEntity);
                        }
                    }
                }
            }
            if (cesiumMeasureTooltipLabel) {
                cesiumViewer.entities.remove(cesiumMeasureTooltipLabel);
                cesiumMeasureTooltipLabel = null;
            }
            for (let entityIndex = 0; entityIndex < cesiumMeasureEntitiesArray.length; entityIndex = entityIndex + 1) {
                const currentEntity = cesiumMeasureEntitiesArray[entityIndex];
                if (currentEntity) {
                    cesiumViewer.entities.remove(currentEntity);
                }
            }
            if (cesiumMeasurePolylineEntity) {
                cesiumViewer.entities.remove(cesiumMeasurePolylineEntity);
                cesiumMeasurePolylineEntity = null;
            }
        }
        cesiumMeasureEntitiesArray = [];
        measurePointsArray = [];
    } else {
        for (let resultIndex = 0; resultIndex < measureResultsArray.length; resultIndex = resultIndex + 1) {
            const currentResult = measureResultsArray[resultIndex];
            if (currentResult.feature) {
                measureSource.removeFeature(currentResult.feature);
            }
            if (currentResult.pointFeatures) {
                for (let pointIndex = 0; pointIndex < currentResult.pointFeatures.length; pointIndex = pointIndex + 1) {
                    const currentPointFeature = currentResult.pointFeatures[pointIndex];
                    if (currentPointFeature) {
                        measureSource.removeFeature(currentPointFeature);
                    }
                }
            }
        }
        for (let pointIndex = 0; pointIndex < measurePointFeaturesArray.length; pointIndex = pointIndex + 1) {
            const currentPointFeature = measurePointFeaturesArray[pointIndex];
            if (currentPointFeature) {
                measureSource.removeFeature(currentPointFeature);
            }
        }
        if (measureCurrentLineFeature) {
            measureSource.removeFeature(measureCurrentLineFeature);
            measureCurrentLineFeature = null;
        }
        if (measureTooltipOverlayElement) {
            if (measureTooltipOverlayElement.parentNode) {
                measureTooltipOverlayElement.parentNode.removeChild(measureTooltipOverlayElement);
            }
            measureTooltipOverlayElement = null;
        }
        if (measureTooltipOverlay) {
            map.removeOverlay(measureTooltipOverlay);
            measureTooltipOverlay = null;
        }
        measurePointFeaturesArray = [];
        measurePointsArray = [];
    }
    
    isMeasuringNow = false;
    if (measureClickEventHandler) {
        try {
            map.un('click', measureClickEventHandler);
        } catch (error) {
        }
        measureClickEventHandler = null;
    }
    if (measureDrawInteraction) {
        map.removeInteraction(measureDrawInteraction);
        measureDrawInteraction = null;
    }
    if (cesiumMeasureClickHandler) {
        cesiumMeasureClickHandler.destroy();
        cesiumMeasureClickHandler = null;
    }
    
    const mapElement = map.getTargetElement();
    if (mapElement) {
        mapElement.style.cursor = '';
    }
    if (cesiumViewer) {
        const cesiumCanvasElement = cesiumViewer.scene.canvas;
        if (cesiumCanvasElement) {
            cesiumCanvasElement.style.cursor = '';
        }
    }
    
    measureResultsArray = [];
    lastMeasureResult = null;
    if (activeMarker) {
        citySource.removeFeature(activeMarker);
        activeMarker = null;
    }
    if (markerBlinker) {
        clearInterval(markerBlinker);
        markerBlinker = null;
    }
    updateMeasureListFunction();
}

function openMoveModal() {
    const moveModalElement = document.getElementById("moveModal");
    if (moveModalElement) {
        moveModalElement.style.display = "block";
    }
    isMoveModalOpen = true;
    
    setTimeout(function() {
        makeModalDraggable();
    }, 10);
    
    if (is3DModeActive) {
        startMoveMap3D();
    } else {
        startMoveMap2D();
    }
}

function closeMoveModal() {
    const moveModalElement = document.getElementById("moveModal");
    if (moveModalElement) {
        moveModalElement.style.display = "none";
    }
    isMoveModalOpen = false;
    stopMoveMap();
}

function startMoveMap2D() {
    if (moveMapClickHandler) {
        map.un('click', moveMapClickHandler);
    }
    moveMapClickHandler = function(clickEvent) {
        handleMoveMapClick2D(clickEvent);
    };
    map.on('click', moveMapClickHandler);
    const mapElement = map.getTargetElement();
    if (mapElement) {
        mapElement.style.cursor = 'pointer';
    }
}

function startMoveMap3D() {
    if (cesiumViewer === null) {
        return;
    }
    if (cesiumMoveMapClickHandler) {
        cesiumMoveMapClickHandler.destroy();
    }
    const cesiumCanvasElement = cesiumViewer.scene.canvas;
    if (cesiumCanvasElement) {
        cesiumCanvasElement.style.cursor = 'pointer';
    }
    cesiumMoveMapClickHandler = new Cesium.ScreenSpaceEventHandler(cesiumCanvasElement);
    cesiumMoveMapClickHandler.setInputAction(function(clickEvent) {
        handleMoveMapClick3D(clickEvent);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

function stopMoveMap() {
    if (moveMapClickHandler) {
        map.un('click', moveMapClickHandler);
        moveMapClickHandler = null;
    }
    if (cesiumMoveMapClickHandler) {
        cesiumMoveMapClickHandler.destroy();
        cesiumMoveMapClickHandler = null;
    }
    if (is3DModeActive) {
        if (cesiumViewer) {
            const cesiumCanvasElement = cesiumViewer.scene.canvas;
            if (cesiumCanvasElement) {
                cesiumCanvasElement.style.cursor = '';
            }
        }
    } else {
        const mapElement = map.getTargetElement();
        if (mapElement) {
            mapElement.style.cursor = '';
        }
    }
}

function handleMoveMapClick2D(event) {
    if (!isMoveModalOpen) {
        return;
    }
    if (isMeasuringNow) {
        return;
    }
    const clickedCoordinate = event.coordinate;
    const clickedLonLat = ol.proj.toLonLat(clickedCoordinate);
    moveMap(clickedLonLat);
    setMarker(clickedLonLat);
    if (is3DModeActive) {
        if (cesiumActiveMarker) {
            blinkMarker(null, null);
        }
    } else {
        if (activeMarker) {
            blinkMarker(activeMarker, redMarkerStyle);
        }
    }
    const inputLongitudeElement = document.getElementById("inputLongitude");
    const inputLatitudeElement = document.getElementById("inputLatitude");
    if (inputLongitudeElement) {
        inputLongitudeElement.value = clickedLonLat[0].toFixed(2);
    }
    if (inputLatitudeElement) {
        inputLatitudeElement.value = clickedLonLat[1].toFixed(2);
    }
}

function handleMoveMapClick3D(clickEvent) {
    if (!isMoveModalOpen) {
        return;
    }
    if (isMeasuringNow) {
        return;
    }
    if (cesiumViewer === null) {
        return;
    }
    const pickedPosition = cesiumViewer.camera.pickEllipsoid(clickEvent.position, cesiumViewer.scene.globe.ellipsoid);
    if (pickedPosition === undefined) {
        return;
    }
    const cartographicPosition = Cesium.Cartographic.fromCartesian(pickedPosition);
    const longitudeDegrees = Cesium.Math.toDegrees(cartographicPosition.longitude);
    const latitudeDegrees = Cesium.Math.toDegrees(cartographicPosition.latitude);
    const lonLatArray = [longitudeDegrees, latitudeDegrees];
    moveMap(lonLatArray);
    setMarker(lonLatArray);
    if (is3DModeActive) {
        if (cesiumActiveMarker) {
            blinkMarker(null, null);
        }
    } else {
        if (activeMarker) {
            blinkMarker(activeMarker, redMarkerStyle);
        }
    }
    const inputLongitudeElement = document.getElementById("inputLongitude");
    const inputLatitudeElement = document.getElementById("inputLatitude");
    if (inputLongitudeElement) {
        inputLongitudeElement.value = longitudeDegrees.toFixed(2);
    }
    if (inputLatitudeElement) {
        inputLatitudeElement.value = latitudeDegrees.toFixed(2);
    }
}

function moveToCoordinates() {
    const inputLongitudeElement = document.getElementById("inputLongitude");
    const inputLatitudeElement = document.getElementById("inputLatitude");
    let longitudeValue = 0;
    let latitudeValue = 0;
    if (inputLongitudeElement) {
        longitudeValue = parseFloat(inputLongitudeElement.value);
    }
    if (inputLatitudeElement) {
        latitudeValue = parseFloat(inputLatitudeElement.value);
    }
    if (isNaN(longitudeValue)) {
        return;
    }
    if (isNaN(latitudeValue)) {
        return;
    }
    if (longitudeValue < -180) {
        longitudeValue = -180;
    }
    if (longitudeValue > 180) {
        longitudeValue = 180;
    }
    if (latitudeValue < -90) {
        latitudeValue = -90;
    }
    if (latitudeValue > 90) {
        latitudeValue = 90;
    }
    longitudeValue = Math.round(longitudeValue * 100) / 100;
    latitudeValue = Math.round(latitudeValue * 100) / 100;
    
    if (inputLongitudeElement) {
        if (longitudeValue < -180) {
            inputLongitudeElement.value = -180;
            longitudeValue = -180;
        } else if (longitudeValue > 180) {
            inputLongitudeElement.value = 180;
            longitudeValue = 180;
        } else {
            inputLongitudeElement.value = longitudeValue.toFixed(2);
        }
    }
    if (inputLatitudeElement) {
        if (latitudeValue < -90) {
            inputLatitudeElement.value = -90;
            latitudeValue = -90;
        } else if (latitudeValue > 90) {
            inputLatitudeElement.value = 90;
            latitudeValue = 90;
        } else {
            inputLatitudeElement.value = latitudeValue.toFixed(2);
        }
    }
    
    const coordinateArray = [longitudeValue, latitudeValue];
    moveMap(coordinateArray);
    setMarker(coordinateArray);
    if (is3DModeActive) {
        if (cesiumActiveMarker) {
            blinkMarker(null, null);
        }
    } else {
        if (activeMarker) {
            blinkMarker(activeMarker, redMarkerStyle);
        }
    }
}

function moveToCenter() {
    const centerLongitude = 127.77;
    const centerLatitude = 36.34;
    const centerCoordinateArray = [centerLongitude, centerLatitude];
    moveMap(centerCoordinateArray);
    setMarker(centerCoordinateArray);
    if (is3DModeActive) {
        if (cesiumActiveMarker) {
            blinkMarker(null, null);
        }
    } else {
        if (activeMarker) {
            blinkMarker(activeMarker, redMarkerStyle);
        }
    }
}

function makeModalDraggable() {
    const modalHeaderElements = document.querySelectorAll(".modal-header");
    for (let headerIndex = 0; headerIndex < modalHeaderElements.length; headerIndex = headerIndex + 1) {
        const headerElement = modalHeaderElements[headerIndex];
        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;
        const popupElement = headerElement.parentElement;
        
        const handleMouseMoveFunction = function(mouseEvent) {
            if (!isDragging) {
                return;
            }
            const newLeftPosition = (mouseEvent.clientX - offsetX) + "px";
            const newTopPosition = (mouseEvent.clientY - offsetY) + "px";
            popupElement.style.left = newLeftPosition;
            popupElement.style.top = newTopPosition;
            popupElement.style.transform = "none";
        };
        
        const handleMouseUpFunction = function() {
            isDragging = false;
            document.removeEventListener('mousemove', handleMouseMoveFunction);
            document.removeEventListener('mouseup', handleMouseUpFunction);
        };
        
        headerElement.onmousedown = function(mouseEvent) {
            if (mouseEvent.target.className === "modal-close") {
                return;
            }
            isDragging = true;
            const popupRect = popupElement.getBoundingClientRect();
            offsetX = mouseEvent.clientX - popupRect.left;
            offsetY = mouseEvent.clientY - popupRect.top;
            document.addEventListener('mousemove', handleMouseMoveFunction);
            document.addEventListener('mouseup', handleMouseUpFunction);
        };
    }
}
makeModalDraggable();

window.toggleTopbar = function() {
    const bodyElement = document.body;
    const hasTopbarHidden = bodyElement.classList.contains("topbar-hidden");
    if (hasTopbarHidden) {
        bodyElement.classList.remove("topbar-hidden");
    } else {
        bodyElement.classList.add("topbar-hidden");
    }
    const isHiddenNow = bodyElement.classList.contains("topbar-hidden");
    const showTopbarButton = document.getElementById("showTopbar");
    if (showTopbarButton) {
        if (isHiddenNow) {
            showTopbarButton.style.display = "block";
        } else {
            showTopbarButton.style.display = "none";
        }
    }
    setTimeout(function() {
        map.updateSize();
        if (cesiumViewer) {
            cesiumViewer.resize();
        }
    }, 10);
};

map.on("dblclick", function(event) {
    event.preventDefault();
    if (isMeasuringNow) {
        finishMeasureFunction();
        return;
    }
    if (document.body.classList.contains("topbar-hidden")) {
        window.toggleTopbar();
    }
});

function toggle3D(is3DEnabled) {
    is3DModeActive = is3DEnabled;
    const mapElement = document.getElementById("map");
    const cesiumContainerElement = document.getElementById("cesiumContainer");

    if (is3DEnabled) {
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
                        console.log("Ion imagery from asset ID failed:", error);
                    });
                }
            } catch (error) {
                console.log("Ion imagery setup failed:", error);
            }

            try {
                if (typeof Cesium.CesiumTerrainProvider.fromIonAssetId === 'function') {
                    Cesium.CesiumTerrainProvider.fromIonAssetId(1).then(function(provider) {
                        if (cesiumViewer && !cesiumViewer.isDestroyed()) {
                            cesiumViewer.terrainProvider = provider;
                            console.log("World Terrain loaded successfully");
                        }
                    }).catch(function(err) {
                        console.error("Failed to load World Terrain:", err);
                    });
                } else {
                    console.log("CesiumTerrainProvider.fromIonAssetId not available");
                }
            } catch (e) {
                console.error("Error setting up terrain:", e);
            }

            try {
                if (typeof Cesium.createOsmBuildings === 'function') {
                    const osmBuildings = Cesium.createOsmBuildings();
                    cesiumViewer.scene.primitives.add(osmBuildings);
                    console.log("OSM Buildings added successfully");
                } else {
                    console.log("Cesium.createOsmBuildings not available");
                }
            } catch (e) {
                console.error("Error adding OSM Buildings:", e);
            }

            const initialCenter = [127.0276, 37.4979];
            cesiumViewer.camera.setView({
                destination: Cesium.Cartesian3.fromDegrees(initialCenter[0], initialCenter[1], 15000),
                orientation: {
                    heading: Cesium.Math.toRadians(0),
                    pitch: Cesium.Math.toRadians(-45),
                    roll: 0.0
                }
            });
            
            cesiumViewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
            if (cesiumViewer.selectionIndicator) {
                cesiumViewer.selectionIndicator.viewModel.selectionIndicatorElement.style.display = 'none';
            }
            cesiumViewer.camera.changed.addEventListener(function() {
                const cameraHeight = cesiumViewer.camera.positionCartographic.height;
                const levelInfoElement = document.getElementById("level-info");
                if (levelInfoElement) {
                    const roundedHeight = Math.round(cameraHeight);
                    levelInfoElement.innerText = "높이: " + roundedHeight + "m";
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
                    if (pickedObject && pickedObject.id) {
                        const pickedEntity = pickedObject.id;
                        for (let cityIndex = 0; cityIndex < cesiumCityEntitiesArray.length; cityIndex = cityIndex + 1) {
                            if (cesiumCityEntitiesArray[cityIndex] === pickedEntity) {
                                foundCityEntity = true;
                                const cityKeysArray = Object.keys(cityInfos);
                                for (let keyIndex = 0; keyIndex < cityKeysArray.length; keyIndex = keyIndex + 1) {
                                    const cityKey = cityKeysArray[keyIndex];
                                    const cityData = cityInfos[cityKey];
                                    const pickedPosition = pickedEntity.position.getValue();
                                    const cartographicPositionForCity = Cesium.Cartographic.fromDegrees(cityData.lonlat[0], cityData.lonlat[1]);
                                    const cartesianPositionForCity = Cesium.Cartesian3.fromRadians(cartographicPositionForCity.longitude, cartographicPositionForCity.latitude);
                                    const positionDistance = Cesium.Cartesian3.distance(pickedPosition, cartesianPositionForCity);
                                    if (positionDistance < 100) {
                                        if (popupContentElement) {
                                            popupContentElement.innerHTML = cityData.name;
                                        }
                                        if (popupElement) {
                                            const screenPosition = Cesium.SceneTransforms.wgs84ToWindowCoordinates(cesiumViewer.scene, pickedPosition);
                                            if (screenPosition) {
                                                popupElement.style.position = 'fixed';
                                                popupElement.style.left = screenPosition.x + 'px';
                                                popupElement.style.top = (screenPosition.y - 30) + 'px';
                                                popupElement.style.bottom = 'auto';
                                                popupElement.style.display = 'block';
                                                popupElement.style.zIndex = '10000';
                                            }
                                        }
                                        const cesiumCanvasElement = cesiumViewer.scene.canvas;
                                        if (cesiumCanvasElement) {
                                            cesiumCanvasElement.style.cursor = 'pointer';
                                        }
                                        break;
                                    }
                                }
                                break;
                            }
                        }
                    }
                    if (foundCityEntity === false) {
                        if (popupElement) {
                            popupElement.style.display = 'none';
                        }
                        const cesiumCanvasElement = cesiumViewer.scene.canvas;
                        if (cesiumCanvasElement) {
                            cesiumCanvasElement.style.cursor = '';
                        }
                    }
                }
            }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
            cesiumViewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
            cesiumEventHandler.setInputAction(function(clickEvent) {
                if (isMeasuringNow) {
                    finishMeasureFunction();
                } else {
                    if (document.body.classList.contains("topbar-hidden")) {
                        window.toggleTopbar();
                    }
                }
            }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        } else {
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
                    if (pickedObject && pickedObject.id) {
                        const pickedEntity = pickedObject.id;
                        for (let cityIndex = 0; cityIndex < cesiumCityEntitiesArray.length; cityIndex = cityIndex + 1) {
                            if (cesiumCityEntitiesArray[cityIndex] === pickedEntity) {
                                foundCityEntity = true;
                                const cityKeysArray = Object.keys(cityInfos);
                                for (let keyIndex = 0; keyIndex < cityKeysArray.length; keyIndex = keyIndex + 1) {
                                    const cityKey = cityKeysArray[keyIndex];
                                    const cityData = cityInfos[cityKey];
                                    const pickedPosition = pickedEntity.position.getValue();
                                    const cartographicPositionForCity = Cesium.Cartographic.fromDegrees(cityData.lonlat[0], cityData.lonlat[1]);
                                    const cartesianPositionForCity = Cesium.Cartesian3.fromRadians(cartographicPositionForCity.longitude, cartographicPositionForCity.latitude);
                                    const positionDistance = Cesium.Cartesian3.distance(pickedPosition, cartesianPositionForCity);
                                    if (positionDistance < 100) {
                                        if (popupContentElement) {
                                            popupContentElement.innerHTML = cityData.name;
                                        }
                                        if (popupElement) {
                                            const screenPosition = Cesium.SceneTransforms.wgs84ToWindowCoordinates(cesiumViewer.scene, pickedPosition);
                                            if (screenPosition) {
                                                popupElement.style.position = 'fixed';
                                                popupElement.style.left = screenPosition.x + 'px';
                                                popupElement.style.top = (screenPosition.y - 30) + 'px';
                                                popupElement.style.bottom = 'auto';
                                                popupElement.style.display = 'block';
                                                popupElement.style.zIndex = '10000';
                                            }
                                        }
                                        const cesiumCanvasElement = cesiumViewer.scene.canvas;
                                        if (cesiumCanvasElement) {
                                            cesiumCanvasElement.style.cursor = 'pointer';
                                        }
                                        break;
                                    }
                                }
                                break;
                            }
                        }
                    }
                    if (foundCityEntity === false) {
                        if (popupElement) {
                            popupElement.style.display = 'none';
                        }
                        const cesiumCanvasElement = cesiumViewer.scene.canvas;
                        if (cesiumCanvasElement) {
                            cesiumCanvasElement.style.cursor = '';
                        }
                    }
                }
            }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
            cesiumViewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
            cesiumEventHandler.setInputAction(function(clickEvent) {
                if (isMeasuringNow) {
                    finishMeasureFunction();
                } else {
                    if (document.body.classList.contains("topbar-hidden")) {
                        window.toggleTopbar();
                    }
                }
            }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        }
        
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
                    point: {
                        pixelSize: 14,
                        color: Cesium.Color.fromBytes(0, 123, 255, 255),
                        outlineColor: Cesium.Color.WHITE,
                        outlineWidth: 2,
                        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                    },
                    label: {
                        text: cityDataForCesium.name,
                        font: '14px sans-serif',
                        fillColor: Cesium.Color.WHITE,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 2,
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        pixelOffset: new Cesium.Cartesian2(0, -30),
                        disableDepthTestDistance: Number.POSITIVE_INFINITY,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM
                    }
                });
                cesiumCityEntitiesArray.push(cityEntityForCesium);
            }
        }
    }
    
    if (is3DEnabled) {
        if (mapElement) {
            mapElement.style.display = "none";
        }
        if (cesiumContainerElement) {
            cesiumContainerElement.style.display = "block";
        }
    } else {
        if (cesiumContainerElement) {
            cesiumContainerElement.style.display = "none";
        }
        if (mapElement) {
            mapElement.style.display = "block";
            map.updateSize();
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

window.goCity = function(cityName) {
    const cityInfo = cityInfos[cityName];
    if (cityInfo) {
        moveMap(cityInfo.lonlat, 13);
        setMarker(cityInfo.lonlat);
        if (is3DModeActive) {
            if (cesiumActiveMarker) {
                blinkMarker(null, null);
            }
        } else {
            if (activeMarker) {
                blinkMarker(activeMarker, redMarkerStyle);
            }
        }
    }
};

window.goCityZoom = function(cityName) {
    const cityInfo = cityInfos[cityName];
    if (cityInfo) {
        const cityCoordinate = cityInfo.lonlat;
        moveMap(cityCoordinate, 16);
        setMarker(cityCoordinate);
        if (is3DModeActive) {
            if (cesiumActiveMarker) {
                blinkMarker(null, null);
            }
        } else {
            if (activeMarker) {
                blinkMarker(activeMarker, redMarkerStyle);
            }
        }
    }
};

window.openMoveModal = openMoveModal;
window.closeMoveModal = closeMoveModal;
window.openMeasureModal = openMeasureModal;
window.closeMeasureModal = closeMeasureModal;
window.moveToCoordinates = moveToCoordinates;
window.moveToCenter = moveToCenter;
window.startMeasure = startMeasure;
window.clearMeasures = clearMeasures;
window.goToMeasureEndPoint = goToMeasureEndPoint;
window.removeMeasureItem = removeMeasureItem;
window.continueMeasureFromResult = continueMeasureFromResult;