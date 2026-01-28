let measureDrawInteraction = null;
let measureTooltipOverlayElement = null;
let measureTooltipOverlay = null;
let measureResultsArray = [];
let measurePointsArray = [];
let measureCurrentLineFeature = null;
let measureClickEventHandler = null;
let measurePointFeaturesArray = [];
let cesiumMeasureEntitiesArray = [];
let cesiumMeasurePolylineEntity = null;
let cesiumMeasureClickHandler = null;
let cesiumMeasureTooltipLabel = null;
let lastMeasureResult = null; 

let areaResultsArray = [];
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
        modalZIndex += 10;
        measureModalElement.style.zIndex = modalZIndex;
        measureModalElement.style.display = "block";
        bringModalToFront(measureModalElement);
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
    if (!map) {
        measureClickEventHandler = null;
        measureDrawInteraction = null;
        measureTooltipOverlayElement = null;
        measureTooltipOverlay = null;
        measureCurrentLineFeature = null;
        measurePointFeaturesArray = [];
        return;
    }
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
    
    const clickedCoordinate = map.getCoordinateFromPixel(event.pixel);
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
                if (currentEntity.point) {
                    currentEntity.point.pixelSize = 12;
                }
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
    
    let pickedPosition = null;
    
    const ray = cesiumViewer.camera.getPickRay(clickEvent.position);
    if (ray) {
        pickedPosition = cesiumViewer.scene.globe.pick(ray, cesiumViewer.scene);
    }
    
    if (!pickedPosition) {
        pickedPosition = cesiumViewer.scene.pickPosition(clickEvent.position);
    }
    
    if (!pickedPosition) {
        pickedPosition = cesiumViewer.camera.pickEllipsoid(clickEvent.position, cesiumViewer.scene.globe.ellipsoid);
    }
    
    if (!pickedPosition) {
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
    
    measureResultsArray = [];
    lastMeasureResult = null;
    
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
    if (markerBlinker) {
        clearInterval(markerBlinker);
        markerBlinker = null;
    }
    updateMeasureListFunction();
}

function convertMeasureResultsTo3D() {
    if (!cesiumViewer) {
        return;
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
}

function convertMeasureResultsTo2D() {
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
            
            if (currentItem.pointsArray && currentItem.pointsArray.length >= 2 && (!currentItem.feature || currentItem.pointEntities)) {
                const positionsArrayFor2D = [];
                for (let pointIndex = 0; pointIndex < currentItem.pointsArray.length; pointIndex = pointIndex + 1) {
                    const currentPointLonLat = currentItem.pointsArray[pointIndex];
                    const coordinateFor2D = ol.proj.fromLonLat(currentPointLonLat);
                    positionsArrayFor2D.push(coordinateFor2D);
                }
                
                const lineGeometryFor2D = new ol.geom.LineString(positionsArrayFor2D);
                const lineStyleFor2D = new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'rgba(0, 0, 255, 0.6)',
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
                            radius: 6,
                            fill: new ol.style.Fill({ color: 'rgba(0, 0, 255, 0.8)' }),
                            stroke: new ol.style.Stroke({ color: 'white', width: 2 })
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

window.startMeasure = startMeasure;
window.clearMeasures = clearMeasures;
window.removeMeasureItem = removeMeasureItem;
window.goToMeasureEndPoint = goToMeasureEndPoint;
window.updateMeasureListFunction = updateMeasureListFunction;
window.convertMeasureResultsTo3D = convertMeasureResultsTo3D;
window.convertMeasureResultsTo2D = convertMeasureResultsTo2D;