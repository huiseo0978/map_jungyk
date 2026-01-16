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
