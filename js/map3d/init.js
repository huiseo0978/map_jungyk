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
            }
        } catch (e) {
        }

        try {
            if (typeof Cesium.createOsmBuildings === 'function') {
                const osmBuildings = Cesium.createOsmBuildings();
                cesiumViewer.scene.primitives.add(osmBuildings);
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
        
        if (typeof setupCesiumEvents === 'function') {
            setupCesiumEvents();
        }
        if (typeof setupCesiumUIHandlers === 'function') {
            setupCesiumUIHandlers();
        }
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
