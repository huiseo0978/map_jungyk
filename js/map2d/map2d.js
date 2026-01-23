const openStreetMapLayer = new ol.layer.Tile({ 
    source: new ol.source.OSM() 
});

const mainView = new ol.View({
    center: ol.proj.fromLonLat(mapCenter),
    zoom: 12,
    minZoom: 0,
    maxZoom: 20
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
        openStreetMapLayer, 
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

const cityStyleCache = {};
const cityPointStyle = function(feature) {
    const cityName = feature.get("name") || "";
    if (cityStyleCache[cityName]) {
        return cityStyleCache[cityName];
    }
  
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
    
    if (typeof window.getIsSyncingZoom === 'function' && window.getIsSyncingZoom()) {
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
            
            let viewportHeight = DEFAULT_VIEWPORT_HEIGHT;
            if (mapSize && mapSize[1] > 0) {
                viewportHeight = mapSize[1];
            }
            
            const viewportHeightInMeters = metersPerPixel * viewportHeight;
            const targetHeight = viewportHeightInMeters / (2 * tanHalfFOV);
            const clampedHeight = Math.max(MIN_CAMERA_HEIGHT, Math.min(MAX_CAMERA_HEIGHT, targetHeight));
            
            const currentCameraHeight = cesiumViewer.camera.positionCartographic.height;
            const heightDifference = Math.abs(clampedHeight - currentCameraHeight);
            const heightDifferencePercent = heightDifference / Math.max(currentCameraHeight, 1);
            
            if (heightDifferencePercent > ZOOM_DIFFERENCE_THRESHOLD) {
                if (typeof sync2DTo3D === 'function') {
                    sync2DTo3D({
                        lonlat: currentLonLat,
                        targetHeight: clampedHeight,
                        cesiumViewer: cesiumViewer,
                        is3DModeActive: is3DModeActive
                    });
                }
            }
        }
    }
});

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
