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

function svgToDataUri(svgText) {
    return "data:image/svg+xml;utf8," + encodeURIComponent(svgText);
}

const cityPinSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
    <path fill="#e53935" stroke="#ffffff" stroke-width="1.5" d="M12 2c-3.314 0-6 2.686-6 6 0 4.418 6 14 6 14s6-9.582 6-14c0-3.314-2.686-6-6-6z"/>
    <circle cx="12" cy="8" r="2.4" fill="#ffffff"/>
</svg>`.trim();

const cityPinDataUri = svgToDataUri(cityPinSvg);

const markerIconImageUrl = 'https://maps.google.com/mapfiles/ms/icons/red-dot.png';

const cityStyleCache = {};
const cityPointStyle = function(feature) {
    const cityName = feature.get("name") || "";
    if (cityStyleCache[cityName]) return cityStyleCache[cityName];
  
    const styleObject = new ol.style.Style({
      image: new ol.style.Icon({
        src: markerIconImageUrl,
        anchor: [0.5, 1],
        anchorXUnits: 'fraction',
        anchorYUnits: 'fraction',
        scale: 1
      })
    });
  
    cityStyleCache[cityName] = styleObject;
    return styleObject;
  };

const redMarkerStyle = new ol.style.Style({
    image: new ol.style.Icon({
        src: markerIconImageUrl,
        anchor: [0.5, 1],
        scale: 1,
        anchorXUnits: 'fraction',
        anchorYUnits: 'fraction'
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
let isSyncingZoom = false;
let last2DZoomLevel = null;

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
        hitTolerance: 10
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
        } else if (featureType === "marker") {
            if (popupContentElement) {
                const markerLonlat = featureAtPixel.get("lonlat");
                if (markerLonlat) {
                    popupContentElement.innerHTML = `위치<br>경도: ${markerLonlat[0].toFixed(6)}<br>위도: ${markerLonlat[1].toFixed(6)}`;
                } else {
                    popupContentElement.innerHTML = "위치 마커";
                }
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
    
    const currentZoom = mainView.getZoom();
    if (currentZoom !== undefined && currentZoom !== null) {
        last2DZoomLevel = currentZoom;
    }
    
    if (isSyncingZoom) {
        return;
    }
    if (cesiumViewer && !is3DModeActive) {
        const currentCenter = mainView.getCenter();
        if (currentCenter) {
            const currentLonLat = ol.proj.toLonLat(currentCenter);
            const currentZoom = mainView.getZoom();
            const latitudeRadians = currentLonLat[1] * Math.PI / 180;
            const metersPerPixelAtEquator = 156543.03392;
            const metersPerPixel = metersPerPixelAtEquator * Math.cos(latitudeRadians) / Math.pow(2, currentZoom);
            const mapSize = map.getSize();
            const cesiumFOV = Math.PI / 3;
            const tanHalfFOV = Math.tan(cesiumFOV / 2);
            
            let viewportHeight = 512;
            if (mapSize && mapSize[1] > 0) {
                viewportHeight = mapSize[1];
            }
            
            const viewportHeightInMeters = metersPerPixel * viewportHeight;
            const targetHeight = viewportHeightInMeters / (2 * tanHalfFOV);
            const clampedHeight = Math.max(100, Math.min(40000000, targetHeight));
            
            const currentCameraHeight = cesiumViewer.camera.positionCartographic.height;
            const heightDifference = Math.abs(clampedHeight - currentCameraHeight);
            const heightDifferencePercent = heightDifference / Math.max(currentCameraHeight, 1);
            
            if (heightDifferencePercent > 0.01) {
                isSyncingZoom = true;
                cesiumViewer.camera.flyTo({
                    destination: Cesium.Cartesian3.fromDegrees(currentLonLat[0], currentLonLat[1], clampedHeight),
                    duration: 0.3
                });
                setTimeout(function() {
                    isSyncingZoom = false;
                }, 400);
            }
        }
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
    } else {
        const coord = ol.proj.fromLonLat(lonlat);
        if (activeMarker === null) {
            activeMarker = new ol.Feature(new ol.geom.Point(coord));
            activeMarker.setStyle(redMarkerStyle);
            activeMarker.set("type", "marker");
            activeMarker.set("lonlat", lonlat);
            citySource.addFeature(activeMarker);
        } else {
            activeMarker.getGeometry().setCoordinates(coord);
            activeMarker.set("lonlat", lonlat);
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
                if (cesiumActiveMarker && cesiumActiveMarker.billboard) {
                    cesiumActiveMarker.billboard.show = isVisible;
                }
                blinkCount = blinkCount + 1;
                if (blinkCount >= 10) {
                    clearInterval(markerBlinker);
                    markerBlinker = null;
                    if (cesiumActiveMarker && cesiumActiveMarker.billboard) {
                        cesiumActiveMarker.billboard.show = true;
                    }
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

let areaResultsArray = [];
let isAreaMeasuringNow = false;
let areaPointsArray = [];
let areaCurrentPolygonFeature = null;
let areaClickEventHandler = null;
let areaPointFeaturesArray = [];
let cesiumAreaEntitiesArray = [];
let cesiumAreaPolygonEntity = null;
let cesiumAreaClickHandler = null;
let cesiumAreaTooltipLabel = null;
let lastAreaResult = null;

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
        let savedLabelEntityForResult = null;
        if (cesiumMeasurePolylineEntity) {
            savedPolylineEntityForResult = cesiumMeasurePolylineEntity;
            
            if (cesiumMeasureTooltipLabel) {
                savedLabelEntityForResult = cesiumMeasureTooltipLabel;
                cesiumMeasureTooltipLabel = null;
            }
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
            labelEntity: savedLabelEntityForResult,
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
    const tabResultsContainer = document.getElementById("tab-measure-results");
    
    const containers = [];
    if (resultsContainer) {
        containers.push(resultsContainer);
    }
    if (tabResultsContainer) {
        containers.push(tabResultsContainer);
    }
    
    if (containers.length === 0) {
        return;
    }
    
    let htmlContent = "";
    if (measureResultsArray.length === 0) {
        htmlContent = "결과가 여기에 표시됩니다.";
    } else {
        for (let resultIndex = 0; resultIndex < measureResultsArray.length; resultIndex = resultIndex + 1) {
            const currentResultItem = measureResultsArray[resultIndex];
            htmlContent = htmlContent + "<div class='measure-item'>";
            htmlContent = htmlContent + "<span class='measure-text' onclick='goToMeasureEndPoint(" + currentResultItem.id + ")'>" + currentResultItem.text + "</span>";
            htmlContent = htmlContent + "<span class='measure-delete' onclick='removeMeasureItem(" + currentResultItem.id + ")'>삭제</span>";
            htmlContent = htmlContent + "</div>";
        }
    }
    
    for (let containerIndex = 0; containerIndex < containers.length; containerIndex = containerIndex + 1) {
        containers[containerIndex].innerHTML = htmlContent;
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
                if (currentResult.labelEntity) {
                    cesiumViewer.entities.remove(currentResult.labelEntity);
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
    if (isAreaMeasuringNow) {
        finishAreaMeasureFunction();
        return;
    }
    if (document.body.classList.contains("topbar-hidden")) {
        window.toggleTopbar();
    }
});

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
                
                const latitudeRadians = targetLonlat[1] * Math.PI / 180;
                const metersPerPixelAtEquator = 156543.03392;
                const mapSize = map.getSize();
                const cesiumFOV = Math.PI / 3;
                const tanHalfFOV = Math.tan(cesiumFOV / 2);
                
                let viewportHeight = 512;
                if (mapSize && mapSize[1] > 0) {
                    viewportHeight = mapSize[1];
                }
                
                const metersPerPixel = metersPerPixelAtEquator * Math.cos(latitudeRadians) / Math.pow(2, currentZoom);
                const viewportHeightInMeters = metersPerPixel * viewportHeight;
                const calculatedHeight = viewportHeightInMeters / (2 * tanHalfFOV);
                
                if (calculatedHeight < 100) {
                    targetHeight = 100;
                } else if (calculatedHeight > 40000000) {
                    targetHeight = 40000000;
                } else {
                    targetHeight = calculatedHeight;
                }
            }
        }
        
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
                    levelInfoElement.innerText = "높이: " + roundedHeight + "m";
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
                            levelInfoElement.innerText = "높이: " + roundedHeight + "m";
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
    
    if (is3DEnabled) {
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
    } else {
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
                const calculatedZoom = Math.log2(metersPerPixelAtZoom0 / metersPerPixelAtCurrentHeight);
                
                if (calculatedZoom < 0) {
                    targetZoom = 0;
                } else if (calculatedZoom > 20) {
                    targetZoom = 20;
                } else {
                    targetZoom = calculatedZoom;
                }
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

function openAreaModal() {
    const areaModalElement = document.getElementById("areaModal");
    if (areaModalElement) {
        areaModalElement.style.display = "block";
    }
    setTimeout(function() {
        makeModalDraggable();
    }, 10);
}

function closeAreaModal() {
    const areaModalElement = document.getElementById("areaModal");
    if (areaModalElement) {
        areaModalElement.style.display = "none";
    }
    stopAreaMeasureFunction();
}

function stopAreaMeasureFunction() {
    isAreaMeasuringNow = false;
    
    if (is3DModeActive) {
        stopAreaMeasure3DFunction();
    } else {
        stopAreaMeasure2DFunction();
    }
    
    areaPointsArray = [];
}

function stopAreaMeasure2DFunction() {
    if (areaClickEventHandler) {
        try {
            map.un('click', areaClickEventHandler);
        } catch (error) {
        }
        areaClickEventHandler = null;
    }
    if (areaCurrentPolygonFeature) {
        measureSource.removeFeature(areaCurrentPolygonFeature);
        areaCurrentPolygonFeature = null;
    }
    for (let pointIndex = 0; pointIndex < areaPointFeaturesArray.length; pointIndex = pointIndex + 1) {
        const currentPointFeature = areaPointFeaturesArray[pointIndex];
        if (currentPointFeature) {
            measureSource.removeFeature(currentPointFeature);
        }
    }
    areaPointFeaturesArray = [];
    const mapElement = map.getTargetElement();
    if (mapElement) {
        mapElement.style.cursor = '';
    }
}

function stopAreaMeasure3DFunction() {
    if (cesiumAreaClickHandler) {
        cesiumAreaClickHandler.destroy();
        cesiumAreaClickHandler = null;
    }
    if (cesiumViewer) {
        const cesiumCanvasElement = cesiumViewer.scene.canvas;
        if (cesiumCanvasElement) {
            cesiumCanvasElement.style.cursor = '';
        }
        for (let entityIndex = 0; entityIndex < cesiumAreaEntitiesArray.length; entityIndex = entityIndex + 1) {
            const currentEntity = cesiumAreaEntitiesArray[entityIndex];
            if (currentEntity) {
                cesiumViewer.entities.remove(currentEntity);
            }
        }
        if (cesiumAreaPolygonEntity) {
            cesiumViewer.entities.remove(cesiumAreaPolygonEntity);
            cesiumAreaPolygonEntity = null;
        }
}
    cesiumAreaEntitiesArray = [];
}

function startAreaMeasure() {
    if (isAreaMeasuringNow) {
        return;
    }
    if (isMeasuringNow) {
        return;
    }
    
    isAreaMeasuringNow = true;
    areaPointsArray = [];
    areaPointFeaturesArray = [];
    cesiumAreaEntitiesArray = [];
    
    if (is3DModeActive) {
        startAreaMeasure3D();
    } else {
        startAreaMeasure2D();
    }
}

function startAreaMeasure2D() {
    areaClickEventHandler = function(clickEvent) {
        handleAreaClickFunction(clickEvent);
    };
    
    map.on('click', areaClickEventHandler);
    
    const mapElement = map.getTargetElement();
    if (mapElement) {
        mapElement.style.cursor = 'crosshair';
    }
    
    const areaPolygonStyleObject = new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: 'rgba(255, 0, 0, 0.6)',
            width: 3
        }),
        fill: new ol.style.Fill({
            color: 'rgba(255, 0, 0, 0.2)'
        })
    });
    
    areaCurrentPolygonFeature = new ol.Feature({
        geometry: new ol.geom.Polygon([])
    });
    areaCurrentPolygonFeature.setStyle(areaPolygonStyleObject);
    measureSource.addFeature(areaCurrentPolygonFeature);
}

function startAreaMeasure3D() {
    if (cesiumViewer === null) {
        return;
    }
    
    const cesiumCanvasElement = cesiumViewer.scene.canvas;
    if (cesiumCanvasElement) {
        cesiumCanvasElement.style.cursor = 'crosshair';
    }
    
    cesiumAreaClickHandler = new Cesium.ScreenSpaceEventHandler(cesiumCanvasElement);
    cesiumAreaClickHandler.setInputAction(function(clickEvent) {
        handleAreaClick3DFunction(clickEvent);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    
    cesiumAreaPolygonEntity = cesiumViewer.entities.add({
        polygon: {
            hierarchy: [],
            material: Cesium.Color.RED.withAlpha(0.3),
            outline: true,
            outlineColor: Cesium.Color.RED,
            height: 0,
            extrudedHeight: 0
        }
    });
}

function handleAreaClickFunction(event) {
    if (!isAreaMeasuringNow) {
        return;
    }
    
    const clickedCoordinate = event.coordinate;
    areaPointsArray.push(clickedCoordinate);
    
    const clickedPointFeature = new ol.Feature({
        geometry: new ol.geom.Point(clickedCoordinate)
    });
    const pointStyleForArea = new ol.style.Style({
        image: new ol.style.Circle({
            radius: 6,
            fill: new ol.style.Fill({ color: 'rgba(255, 0, 0, 0.8)' }),
            stroke: new ol.style.Stroke({ color: 'white', width: 2 })
        })
    });
    clickedPointFeature.setStyle(pointStyleForArea);
    measureSource.addFeature(clickedPointFeature);
    areaPointFeaturesArray.push(clickedPointFeature);
    
    const clickedLonLat = ol.proj.toLonLat(clickedCoordinate);
    
    let displayText = "";
    if (areaPointsArray.length >= 3) {
        const polygonCoordinates = [];
        for (let pointIndex = 0; pointIndex < areaPointsArray.length; pointIndex = pointIndex + 1) {
            polygonCoordinates.push(areaPointsArray[pointIndex]);
        }
        polygonCoordinates.push(areaPointsArray[0]);
        const polygonGeometry = new ol.geom.Polygon([polygonCoordinates]);
        const calculatedArea = formatArea(polygonGeometry);
        displayText = calculatedArea;
        
        areaCurrentPolygonFeature.setGeometry(polygonGeometry);
    } else {
        displayText = clickedLonLat[0].toFixed(4) + "," + clickedLonLat[1].toFixed(4);
    }
    
    const pointResultId = Date.now() + areaPointsArray.length;
    areaResultsArray.push({
        id: pointResultId,
        text: displayText,
        coord: clickedLonLat,
        feature: clickedPointFeature,
        isPoint: true
    });
    updateAreaListFunction();
}

function handleAreaClick3DFunction(clickEvent) {
    if (!isAreaMeasuringNow) {
        return;
    }
    
    const pickedCartesian = cesiumViewer.camera.pickEllipsoid(clickEvent.position, cesiumViewer.scene.globe.ellipsoid);
    if (!pickedCartesian) {
        return;
    }
    
    const cartographicPosition = Cesium.Cartographic.fromCartesian(pickedCartesian);
    const longitudeDegrees = Cesium.Math.toDegrees(cartographicPosition.longitude);
    const latitudeDegrees = Cesium.Math.toDegrees(cartographicPosition.latitude);
    
    areaPointsArray.push([longitudeDegrees, latitudeDegrees]);
    
    const pointEntity = cesiumViewer.entities.add({
        position: pickedCartesian,
        point: {
            pixelSize: 10,
            color: Cesium.Color.RED,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        }
    });
    cesiumAreaEntitiesArray.push(pointEntity);
    
    let displayText = "";
    if (areaPointsArray.length >= 3) {
        const calculatedArea = calculateCesiumArea();
        displayText = formatCesiumArea(calculatedArea);
        
        const positionsArray = [];
        for (let pointIndex = 0; pointIndex < cesiumAreaEntitiesArray.length; pointIndex = pointIndex + 1) {
            const currentEntity = cesiumAreaEntitiesArray[pointIndex];
            if (currentEntity) {
                const currentPosition = currentEntity.position.getValue();
                positionsArray.push(currentPosition);
            }
        }
        if (positionsArray.length > 0) {
            positionsArray.push(positionsArray[0]);
        }
        
        cesiumAreaPolygonEntity.polygon.hierarchy = new Cesium.CallbackProperty(function() {
            return new Cesium.PolygonHierarchy(positionsArray);
        }, false);
    } else {
        displayText = longitudeDegrees.toFixed(4) + "," + latitudeDegrees.toFixed(4);
    }
    
    if (cesiumViewer) {
        if (areaPointsArray.length >= 3) {
            const totalAreaNow = calculateCesiumArea();
            const areaTextNow = formatCesiumArea(totalAreaNow);

            if (cesiumAreaTooltipLabel) {
                cesiumViewer.entities.remove(cesiumAreaTooltipLabel);
                cesiumAreaTooltipLabel = null;
            }

            cesiumAreaTooltipLabel = cesiumViewer.entities.add({
                position: pickedCartesian,
                label: {
                    text: areaTextNow,
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
            if (cesiumAreaTooltipLabel) {
                cesiumViewer.entities.remove(cesiumAreaTooltipLabel);
                cesiumAreaTooltipLabel = null;
            }
        }
    }

    const pointResultId = Date.now() + areaPointsArray.length;
    areaResultsArray.push({
        id: pointResultId,
        text: displayText,
        coord: [longitudeDegrees, latitudeDegrees],
        feature: pointEntity,
        isPoint: true
    });
    updateAreaListFunction();
}

function finishAreaMeasureFunction() {
    if (!isAreaMeasuringNow) {
        return;
    }
    
    if (areaPointsArray.length < 3) {
        alert("면적 계산을 위해서는 최소 3개의 점이 필요합니다.");
        return;
    }
    
    if (is3DModeActive) {
        finishAreaMeasure3DFunction();
    } else {
        finishAreaMeasure2DFunction();
    }
}

function finishAreaMeasure2DFunction() {
    if (areaPointsArray.length >= 3) {
        const polygonCoordinates = [];
        for (let pointIndex = 0; pointIndex < areaPointsArray.length; pointIndex = pointIndex + 1) {
            polygonCoordinates.push(areaPointsArray[pointIndex]);
        }
        polygonCoordinates.push(areaPointsArray[0]);
        const polygonGeometry = new ol.geom.Polygon([polygonCoordinates]);
        const areaText = formatArea(polygonGeometry);
        const resultId = Date.now();
        const lastPointCoordinate = areaPointsArray[areaPointsArray.length - 1];
        const lastPointLonLat = ol.proj.toLonLat(lastPointCoordinate);
        
        for (let resultIndex = areaResultsArray.length - 1; resultIndex >= 0; resultIndex = resultIndex - 1) {
            const currentResult = areaResultsArray[resultIndex];
            if (currentResult.isPoint) {
                areaResultsArray.splice(resultIndex, 1);
            }
        }
        
        const pointsArrayCopy = [];
        for (let pointIndex = 0; pointIndex < areaPointsArray.length; pointIndex = pointIndex + 1) {
            const currentPoint = areaPointsArray[pointIndex];
            const pointLonLat = ol.proj.toLonLat(currentPoint);
            pointsArrayCopy.push(pointLonLat);
        }
        
        let savedPolygonFeatureForResult = null;
        if (areaCurrentPolygonFeature) {
            savedPolygonFeatureForResult = areaCurrentPolygonFeature;
        }
        
        const savedPointFeaturesArray = [];
        for (let pointIndex = 0; pointIndex < areaPointFeaturesArray.length; pointIndex = pointIndex + 1) {
            const currentPointFeature = areaPointFeaturesArray[pointIndex];
            if (currentPointFeature) {
                savedPointFeaturesArray.push(currentPointFeature);
            }
        }
        
        lastAreaResult = {
            id: resultId,
            text: areaText,
            coord: lastPointLonLat,
            feature: savedPolygonFeatureForResult,
            pointFeatures: savedPointFeaturesArray,
            pointsArray: pointsArrayCopy,
            isPoint: false
        };
        
        areaResultsArray.push(lastAreaResult);
        updateAreaListFunction();
        
        if (areaCurrentPolygonFeature) {
            areaCurrentPolygonFeature = null;
        }
        
        if (activeMarker) {
            citySource.removeFeature(activeMarker);
            activeMarker = null;
        }
        if (markerBlinker) {
            clearInterval(markerBlinker);
            markerBlinker = null;
        }
        
        areaPointFeaturesArray = [];
        areaPointsArray = [];
    }
    
    isAreaMeasuringNow = false;
    if (areaClickEventHandler) {
        try {
            map.un('click', areaClickEventHandler);
        } catch (error) {
        }
        areaClickEventHandler = null;
    }
    const mapElement = map.getTargetElement();
    if (mapElement) {
        mapElement.style.cursor = '';
    }
}

function finishAreaMeasure3DFunction() {
    if (cesiumAreaEntitiesArray.length >= 3) {
        const totalArea = calculateCesiumArea();
        const areaText = formatCesiumArea(totalArea);
        const resultId = Date.now();
        const lastEntity = cesiumAreaEntitiesArray[cesiumAreaEntitiesArray.length - 1];
        const lastPosition = lastEntity.position.getValue();
        const lastCartographic = Cesium.Cartographic.fromCartesian(lastPosition);
        const lastLonLat = [Cesium.Math.toDegrees(lastCartographic.longitude), Cesium.Math.toDegrees(lastCartographic.latitude)];
        
        for (let resultIndex = areaResultsArray.length - 1; resultIndex >= 0; resultIndex = resultIndex - 1) {
            const currentResult = areaResultsArray[resultIndex];
            if (currentResult.isPoint) {
                areaResultsArray.splice(resultIndex, 1);
            }
        }
        
        const pointsArrayCopy = [];
        for (let pointIndex = 0; pointIndex < areaPointsArray.length; pointIndex = pointIndex + 1) {
            const currentPoint = areaPointsArray[pointIndex];
            pointsArrayCopy.push([currentPoint[0], currentPoint[1]]);
        }
        
        let savedPolygonEntityForResult = null;
        let savedLabelEntityForResult = null;
        if (cesiumAreaPolygonEntity) {
            const finalPositionsArray = [];
            for (let pointIndex = 0; pointIndex < cesiumAreaEntitiesArray.length; pointIndex = pointIndex + 1) {
                const currentEntity = cesiumAreaEntitiesArray[pointIndex];
                if (currentEntity) {
                    const currentPosition = currentEntity.position.getValue();
                    finalPositionsArray.push(currentPosition);
                }
            }
            if (finalPositionsArray.length > 0) {
                finalPositionsArray.push(finalPositionsArray[0]);
            }
            
            cesiumAreaPolygonEntity.polygon.hierarchy = new Cesium.PolygonHierarchy(finalPositionsArray);
            
            savedPolygonEntityForResult = cesiumAreaPolygonEntity;
            
            if (cesiumAreaTooltipLabel) {
                savedLabelEntityForResult = cesiumAreaTooltipLabel;
                cesiumAreaTooltipLabel = null;
            }
        }
        
        const savedPointEntitiesArray = [];
        for (let entityIndex = 0; entityIndex < cesiumAreaEntitiesArray.length; entityIndex = entityIndex + 1) {
            const currentEntity = cesiumAreaEntitiesArray[entityIndex];
            if (currentEntity) {
                savedPointEntitiesArray.push(currentEntity);
            }
        }
        
        lastAreaResult = {
            id: resultId,
            text: areaText,
            coord: lastLonLat,
            feature: savedPolygonEntityForResult,
            pointEntities: savedPointEntitiesArray,
            labelEntity: savedLabelEntityForResult,
            pointsArray: pointsArrayCopy,
            isPoint: false
        };
        
        areaResultsArray.push(lastAreaResult);
        updateAreaListFunction();
        
        if (cesiumAreaPolygonEntity) {
            cesiumAreaPolygonEntity = null;
        }
        if (cesiumAreaTooltipLabel) {
            cesiumViewer.entities.remove(cesiumAreaTooltipLabel);
            cesiumAreaTooltipLabel = null;
        }
        
        if (cesiumActiveMarker) {
            cesiumViewer.entities.remove(cesiumActiveMarker);
            cesiumActiveMarker = null;
        }
        
        cesiumAreaEntitiesArray = [];
        areaPointsArray = [];
    }
    
    isAreaMeasuringNow = false;
    if (cesiumAreaClickHandler) {
        cesiumAreaClickHandler.destroy();
        cesiumAreaClickHandler = null;
    }
    const cesiumCanvasElement = cesiumViewer.scene.canvas;
    if (cesiumCanvasElement) {
        cesiumCanvasElement.style.cursor = '';
    }
}

function formatArea(polygon) {
    const area = ol.sphere.getArea(polygon);
    let output;
    if (area > 10000) {
        output = (Math.round((area / 1000000) * 100) / 100) + ' km²';
    } else {
        output = (Math.round(area * 100) / 100) + ' m²';
    }
    return output;
}

function calculateCesiumArea() {
    if (cesiumAreaEntitiesArray.length < 3) {
        return 0;
    }
    
    const cartographicArray = [];
    for (let entityIndex = 0; entityIndex < cesiumAreaEntitiesArray.length; entityIndex = entityIndex + 1) {
        const currentEntity = cesiumAreaEntitiesArray[entityIndex];
        if (currentEntity) {
            const currentPosition = currentEntity.position.getValue();
            const cartographic = Cesium.Cartographic.fromCartesian(currentPosition);
            cartographicArray.push(cartographic);
        }
    }
    
    if (cartographicArray.length < 3) {
        return 0;
    }
    
    let totalArea = 0;
    for (let pointIndex = 0; pointIndex < cartographicArray.length; pointIndex = pointIndex + 1) {
        const currentCartographic = cartographicArray[pointIndex];
        const nextCartographic = cartographicArray[(pointIndex + 1) % cartographicArray.length];
        
        const lon1 = currentCartographic.longitude;
        const lat1 = currentCartographic.latitude;
        const lon2 = nextCartographic.longitude;
        const lat2 = nextCartographic.latitude;
        
        totalArea = totalArea + (lon1 * lat2 - lon2 * lat1);
    }
    
    totalArea = Math.abs(totalArea) / 2;
    const earthRadius = 6378137;
    const areaInSquareMeters = totalArea * earthRadius * earthRadius;
    
    return areaInSquareMeters;
}

function formatCesiumArea(areaInSquareMeters) {
    let output;
    if (areaInSquareMeters > 10000) {
        output = (Math.round((areaInSquareMeters / 1000000) * 100) / 100) + ' km²';
    } else {
        output = (Math.round(areaInSquareMeters * 100) / 100) + ' m²';
    }
    return output;
}

function updateAreaListFunction() {
    const areaResultsElement = document.getElementById("area-results");
    const tabAreaResultsElement = document.getElementById("tab-area-results");
    
    const containers = [];
    if (areaResultsElement) {
        containers.push(areaResultsElement);
    }
    if (tabAreaResultsElement) {
        containers.push(tabAreaResultsElement);
    }
    
    if (containers.length === 0) {
        return;
    }
    
    let htmlContent = "";
    if (areaResultsArray.length === 0) {
        htmlContent = "결과가 여기에 표시됩니다. (점 3개 이상 필요)";
    } else {
        for (let resultIndex = 0; resultIndex < areaResultsArray.length; resultIndex = resultIndex + 1) {
            const currentItem = areaResultsArray[resultIndex];
            htmlContent = htmlContent + "<div class='measure-item'>";
            if (currentItem.isPoint) {
                htmlContent = htmlContent + "<span>" + currentItem.text + "</span>";
            } else {
                htmlContent = htmlContent + "<span class='measure-text' onclick='goToAreaEndPoint(" + currentItem.id + ")'>" + currentItem.text + "</span>";
            }
            htmlContent = htmlContent + "<span class='measure-delete' onclick='removeAreaItem(" + currentItem.id + ")'>삭제</span>";
            htmlContent = htmlContent + "</div>";
        }
    }
    
    for (let containerIndex = 0; containerIndex < containers.length; containerIndex = containerIndex + 1) {
        containers[containerIndex].innerHTML = htmlContent;
    }
}

function clearAreas() {
    if (isAreaMeasuringNow) {
        stopAreaMeasureFunction();
    }
    
    for (let resultIndex = 0; resultIndex < areaResultsArray.length; resultIndex = resultIndex + 1) {
        const currentItem = areaResultsArray[resultIndex];
        if (currentItem.feature) {
            if (is3DModeActive) {
                if (currentItem.feature && cesiumViewer) {
                    cesiumViewer.entities.remove(currentItem.feature);
                }
                if (currentItem.labelEntity && cesiumViewer) {
                    cesiumViewer.entities.remove(currentItem.labelEntity);
                }
                if (currentItem.pointEntities) {
                    for (let entityIndex = 0; entityIndex < currentItem.pointEntities.length; entityIndex = entityIndex + 1) {
                        const currentEntity = currentItem.pointEntities[entityIndex];
                        if (currentEntity && cesiumViewer) {
                            cesiumViewer.entities.remove(currentEntity);
                        }
                    }
                }
            } else {
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
        }
    }
    
    areaResultsArray = [];
    lastAreaResult = null;
    updateAreaListFunction();
}

function removeAreaItem(itemId) {
    let foundIndex = -1;
    for (let resultIndex = 0; resultIndex < areaResultsArray.length; resultIndex = resultIndex + 1) {
        if (areaResultsArray[resultIndex].id === itemId) {
            foundIndex = resultIndex;
            break;
        }
    }
    
    if (foundIndex === -1) {
        return;
    }
    
    const currentItem = areaResultsArray[foundIndex];
    if (currentItem.feature) {
        if (is3DModeActive) {
            if (currentItem.feature && cesiumViewer) {
                cesiumViewer.entities.remove(currentItem.feature);
            }
            if (currentItem.labelEntity && cesiumViewer) {
                cesiumViewer.entities.remove(currentItem.labelEntity);
            }
            if (currentItem.labelEntity && cesiumViewer) {
                cesiumViewer.entities.remove(currentItem.labelEntity);
            }
            if (currentItem.pointEntities) {
                for (let entityIndex = 0; entityIndex < currentItem.pointEntities.length; entityIndex = entityIndex + 1) {
                    const currentEntity = currentItem.pointEntities[entityIndex];
                    if (currentEntity && cesiumViewer) {
                        cesiumViewer.entities.remove(currentEntity);
                    }
                }
            }
        } else {
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
    }
    
    areaResultsArray.splice(foundIndex, 1);
    updateAreaListFunction();
}

function goToAreaEndPoint(itemId) {
    let foundItem = null;
    for (let resultIndex = 0; resultIndex < areaResultsArray.length; resultIndex = resultIndex + 1) {
        if (areaResultsArray[resultIndex].id === itemId) {
            foundItem = areaResultsArray[resultIndex];
            break;
        }
    }
    
    if (!foundItem) {
        return;
    }
    
    if (foundItem.isPoint) {
        return;
    }
    
    moveMap(foundItem.coord);
    setMarker(foundItem.coord);
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
window.openAreaModal = openAreaModal;
window.closeAreaModal = closeAreaModal;
window.startAreaMeasure = startAreaMeasure;
window.clearAreas = clearAreas;
window.removeAreaItem = removeAreaItem;
window.goToAreaEndPoint = goToAreaEndPoint;

function openTabExampleModal() {
    const tabExampleModalDiv = document.getElementById("tabExampleModal");
    if (tabExampleModalDiv != null) {
        tabExampleModalDiv.style.display = "block";
        updateMeasureListFunction();
        updateAreaListFunction();
    }
    setTimeout(function() {
        makeModalDraggable();
    }, 10);
}

function closeTabExampleModal() {
    const tabExampleModalDiv = document.getElementById("tabExampleModal");
    if (tabExampleModalDiv != null) {
        tabExampleModalDiv.style.display = "none";
    }
}

function switchTab(tabName) {
    const tabExampleModalDiv = document.getElementById("tabExampleModal");
    if (tabExampleModalDiv == null) {
        return;
    }
    const allTabButtonElements = tabExampleModalDiv.querySelectorAll(".tab-btn");
    for (let i = 0; i < allTabButtonElements.length; i = i + 1) {
        const currentButton = allTabButtonElements[i];
        currentButton.classList.remove("active");
    }
    const allTabPaneElements = tabExampleModalDiv.querySelectorAll(".tab-pane");
    for (let j = 0; j < allTabPaneElements.length; j = j + 1) {
        const currentPane = allTabPaneElements[j];
        currentPane.classList.remove("active");
    }
    const tabNavigationDiv = tabExampleModalDiv.querySelector(".tab-nav");
    if (tabNavigationDiv != null) {
        const tabNavigationButtons = tabNavigationDiv.querySelectorAll(".tab-btn");
        if (tabName === "distance") {
            if (tabNavigationButtons[0] != null) {
                tabNavigationButtons[0].classList.add("active");
            }
        }
        else if (tabName === "area") {
            if (tabNavigationButtons[1] != null) {
                tabNavigationButtons[1].classList.add("active");
            }
        }
    }
    const selectedTabPaneId = "tab-" + tabName;
    const selectedTabPaneElement = document.getElementById(selectedTabPaneId);
    if (selectedTabPaneElement != null) {
        selectedTabPaneElement.classList.add("active");
    }
    
    const tabDistanceFooter = document.getElementById("tab-distance-footer");
    const tabAreaFooter = document.getElementById("tab-area-footer");
    
    if (tabName === "distance") {
        if (tabDistanceFooter != null) {
            tabDistanceFooter.style.display = "flex";
        }
        if (tabAreaFooter != null) {
            tabAreaFooter.style.display = "none";
        }
    }
    else if (tabName === "area") {
        if (tabDistanceFooter != null) {
            tabDistanceFooter.style.display = "none";
        }
        if (tabAreaFooter != null) {
            tabAreaFooter.style.display = "flex";
        }
    }
}

function startMeasureFromTab() {
    startMeasure();
}

function clearMeasuresFromTab() {
    clearMeasures();
}

function startAreaMeasureFromTab() {
    startAreaMeasure();
}

function clearAreasFromTab() {
    clearAreas();
}

function handleTabDelete() {
    const tabExampleModalDiv = document.getElementById("tabExampleModal");
    if (tabExampleModalDiv == null) {
        return;
    }
    const activeTabPane = tabExampleModalDiv.querySelector(".tab-pane.active");
    if (activeTabPane == null) {
        return;
    }
    const activeTabId = activeTabPane.id;
    if (activeTabId === "tab-distance") {
        clearMeasures();
    } else if (activeTabId === "tab-area") {
        clearAreas();
    }
}

function handleTabReset() {
    clearMeasures();
    clearAreas();
}

window.openTabExampleModal = openTabExampleModal;
window.closeTabExampleModal = closeTabExampleModal;
window.switchTab = switchTab;
window.startMeasureFromTab = startMeasureFromTab;
window.clearMeasuresFromTab = clearMeasuresFromTab;
window.startAreaMeasureFromTab = startAreaMeasureFromTab;
window.clearAreasFromTab = clearAreasFromTab;
window.handleTabDelete = handleTabDelete;
window.handleTabReset = handleTabReset;