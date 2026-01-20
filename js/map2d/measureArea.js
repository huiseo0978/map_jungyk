function openAreaModal() {
    const areaModalElement = document.getElementById("areaModal");
    if (areaModalElement) {
        modalZIndex += 10;
        areaModalElement.style.zIndex = modalZIndex;
        areaModalElement.style.display = "block";
        bringModalToFront(areaModalElement);
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
    
    const clickedCoordinate = map.getCoordinateFromPixel(event.pixel);
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
    
    let pickedCartesian = null;
    
    const ray = cesiumViewer.camera.getPickRay(clickEvent.position);
    if (ray) {
        pickedCartesian = cesiumViewer.scene.globe.pick(ray, cesiumViewer.scene);
    }
    
    if (!pickedCartesian) {
        pickedCartesian = cesiumViewer.scene.pickPosition(clickEvent.position);
    }
    
    if (!pickedCartesian) {
        pickedCartesian = cesiumViewer.camera.pickEllipsoid(clickEvent.position, cesiumViewer.scene.globe.ellipsoid);
    }
    
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
                    pixelOffset: new Cesium.Cartesian2(20, -40),
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
    
    if (currentItem.isPoint) {
        if (is3DModeActive) {
            if (cesiumViewer) {
                if (currentItem.feature) {
                    cesiumViewer.entities.remove(currentItem.feature);
                }
            }
            
            const removedCoord = currentItem.coord;
            let removedPointIndex = -1;
            
            for (let pointIndex = 0; pointIndex < areaPointsArray.length; pointIndex = pointIndex + 1) {
                if (areaPointsArray[pointIndex][0] === removedCoord[0] && areaPointsArray[pointIndex][1] === removedCoord[1]) {
                    removedPointIndex = pointIndex;
                    areaPointsArray.splice(pointIndex, 1);
                    break;
                }
            }
            
            if (removedPointIndex >= 0) {
                if (removedPointIndex < cesiumAreaEntitiesArray.length) {
                    const removedEntity = cesiumAreaEntitiesArray[removedPointIndex];
                    if (removedEntity) {
                        cesiumViewer.entities.remove(removedEntity);
                    }
                    cesiumAreaEntitiesArray.splice(removedPointIndex, 1);
                }
                
                if (cesiumAreaPolygonEntity) {
                    cesiumViewer.entities.remove(cesiumAreaPolygonEntity);
                    cesiumAreaPolygonEntity = null;
                }
                if (cesiumAreaTooltipLabel) {
                    cesiumViewer.entities.remove(cesiumAreaTooltipLabel);
                    cesiumAreaTooltipLabel = null;
                }
                
                if (areaPointsArray.length >= 3) {
                    const positionsArray = [];
                    for (let entityIndex = 0; entityIndex < cesiumAreaEntitiesArray.length; entityIndex = entityIndex + 1) {
                        const currentEntity = cesiumAreaEntitiesArray[entityIndex];
                        if (currentEntity) {
                            positionsArray.push(currentEntity.position.getValue());
                        }
                    }
                    if (positionsArray.length > 0) {
                        positionsArray.push(positionsArray[0]);
                    }
                    
                    cesiumAreaPolygonEntity = cesiumViewer.entities.add({
                        polygon: {
                            hierarchy: new Cesium.CallbackProperty(function() {
                                return new Cesium.PolygonHierarchy(positionsArray);
                            }, false),
                            material: Cesium.Color.RED.withAlpha(0.3),
                            outline: true,
                            outlineColor: Cesium.Color.RED,
                            height: 0,
                            extrudedHeight: 0
                        }
                    });
                    
                    const totalArea = calculateCesiumArea();
                    const areaText = formatCesiumArea(totalArea);
                    
                    if (cesiumAreaEntitiesArray.length > 0) {
                        const lastEntity = cesiumAreaEntitiesArray[cesiumAreaEntitiesArray.length - 1];
                        const lastPosition = lastEntity.position.getValue();
                        cesiumAreaTooltipLabel = cesiumViewer.entities.add({
                            position: lastPosition,
                            label: {
                                text: areaText,
                                font: '12px sans-serif',
                                fillColor: Cesium.Color.WHITE,
                                outlineColor: Cesium.Color.BLACK,
                                outlineWidth: 2,
                                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                                pixelOffset: new Cesium.Cartesian2(20, -40),
                                disableDepthTestDistance: Number.POSITIVE_INFINITY
                            }
                        });
                    }
                }
                
                for (let resultIndex = 0; resultIndex < areaResultsArray.length; resultIndex = resultIndex + 1) {
                    const currentResultItem = areaResultsArray[resultIndex];
                    if (currentResultItem.isPoint && currentResultItem.id !== itemId) {
                        if (areaPointsArray.length >= 3) {
                            const totalArea = calculateCesiumArea();
                            const areaText = formatCesiumArea(totalArea);
                            currentResultItem.text = areaText;
                        } else {
                            if (currentResultItem.coord) {
                                currentResultItem.text = currentResultItem.coord[0].toFixed(4) + "," + currentResultItem.coord[1].toFixed(4);
                            }
                        }
                    }
                }
            }
        } else {
            if (currentItem.feature) {
                measureSource.removeFeature(currentItem.feature);
            }
            
            const removedCoord = currentItem.coord;
            let removedPointIndex = -1;
            
            for (let pointIndex = 0; pointIndex < areaPointsArray.length; pointIndex = pointIndex + 1) {
                const currentPointLonLat = ol.proj.toLonLat(areaPointsArray[pointIndex]);
                if (currentPointLonLat[0] === removedCoord[0] && currentPointLonLat[1] === removedCoord[1]) {
                    removedPointIndex = pointIndex;
                    areaPointsArray.splice(pointIndex, 1);
                    break;
                }
            }
            
            if (removedPointIndex >= 0) {
                if (removedPointIndex < areaPointFeaturesArray.length) {
                    const removedFeature = areaPointFeaturesArray[removedPointIndex];
                    if (removedFeature) {
                        measureSource.removeFeature(removedFeature);
                    }
                    areaPointFeaturesArray.splice(removedPointIndex, 1);
                }
                
                if (areaCurrentPolygonFeature) {
                    measureSource.removeFeature(areaCurrentPolygonFeature);
                    areaCurrentPolygonFeature = null;
                }
                
                if (areaPointsArray.length >= 3) {
                    const polygonCoordinates = [];
                    for (let pointIndex = 0; pointIndex < areaPointsArray.length; pointIndex = pointIndex + 1) {
                        polygonCoordinates.push(areaPointsArray[pointIndex]);
                    }
                    polygonCoordinates.push(areaPointsArray[0]);
                    const polygonGeometry = new ol.geom.Polygon([polygonCoordinates]);
                    
                    const areaPolygonStyleObject = new ol.style.Style({
                        fill: new ol.style.Fill({
                            color: 'rgba(255, 0, 0, 0.3)'
                        }),
                        stroke: new ol.style.Stroke({
                            color: 'rgba(255, 0, 0, 1)',
                            width: 2
                        })
                    });
                    
                    areaCurrentPolygonFeature = new ol.Feature({
                        geometry: polygonGeometry
                    });
                    areaCurrentPolygonFeature.setStyle(areaPolygonStyleObject);
                    measureSource.addFeature(areaCurrentPolygonFeature);
                    
                    const calculatedArea = formatArea(polygonGeometry);
                    
                    for (let resultIndex = 0; resultIndex < areaResultsArray.length; resultIndex = resultIndex + 1) {
                        const currentResultItem = areaResultsArray[resultIndex];
                        if (currentResultItem.isPoint && currentResultItem.id !== itemId) {
                            currentResultItem.text = calculatedArea;
                        }
                    }
                } else {
                    for (let resultIndex = 0; resultIndex < areaResultsArray.length; resultIndex = resultIndex + 1) {
                        const currentResultItem = areaResultsArray[resultIndex];
                        if (currentResultItem.isPoint && currentResultItem.id !== itemId) {
                            if (currentResultItem.coord) {
                                currentResultItem.text = currentResultItem.coord[0].toFixed(4) + "," + currentResultItem.coord[1].toFixed(4);
                            }
                        }
                    }
                }
            }
        }
        

        areaResultsArray.splice(foundIndex, 1);
        updateAreaListFunction();
    } else {
        if (is3DModeActive) {
            if (cesiumViewer) {
                if (currentItem.feature) {
                    cesiumViewer.entities.remove(currentItem.feature);
                }
                if (currentItem.labelEntity) {
                    cesiumViewer.entities.remove(currentItem.labelEntity);
                }
                if (currentItem.pointEntities && currentItem.pointEntities.length > 0) {
                    for (let entityIndex = 0; entityIndex < currentItem.pointEntities.length; entityIndex = entityIndex + 1) {
                        const currentEntity = currentItem.pointEntities[entityIndex];
                        if (currentEntity) {
                            cesiumViewer.entities.remove(currentEntity);
                        }
                    }
                }
            }
        } else {
            if (currentItem.feature) {
                measureSource.removeFeature(currentItem.feature);
            }
            if (currentItem.pointFeatures && currentItem.pointFeatures.length > 0) {
                for (let featureIndex = 0; featureIndex < currentItem.pointFeatures.length; featureIndex = featureIndex + 1) {
                    const currentFeature = currentItem.pointFeatures[featureIndex];
                    if (currentFeature) {
                        measureSource.removeFeature(currentFeature);
                    }
                }
            }
        }
        
        areaResultsArray.splice(foundIndex, 1);
        updateAreaListFunction();
    }
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

window.startAreaMeasure = startAreaMeasure;
window.clearAreas = clearAreas;
window.removeAreaItem = removeAreaItem;
window.goToAreaEndPoint = goToAreaEndPoint;
window.updateAreaListFunction = updateAreaListFunction;
