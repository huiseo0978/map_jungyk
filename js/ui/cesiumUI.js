function updateLevelInfo(height) {
    const levelInfoElement = document.getElementById("level-info");
    if (levelInfoElement) {
        const roundedHeight = Math.round(height);
        levelInfoElement.innerText = "높이: " + roundedHeight + "m";
    }
}

function updateCoordinateInfo(lon, lat) {
    const coordinateInfoElement = document.getElementById("coord-info");
    if (coordinateInfoElement) {
        coordinateInfoElement.innerText = "위치: " + lon.toFixed(4) + "," + lat.toFixed(4);
    }
}

function showPopup3D(screenPosition, content) {
    const popupContentElement = document.getElementById("popup-content");
    const popupElement = document.getElementById("popup");
    
    if (popupContentElement) {
        popupContentElement.innerHTML = content;
    }
    if (popupElement && screenPosition) {
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

function hidePopup3D() {
    const popupElement = document.getElementById("popup");
    if (popupElement) {
        popupElement.style.display = 'none';
    }
}

function setCursor3D(cursorType) {
    if (cesiumViewer) {
        const cesiumCanvasElement = cesiumViewer.scene.canvas;
        if (cesiumCanvasElement) {
            cesiumCanvasElement.style.cursor = cursorType || '';
        }
    }
}

function updateCityLabelVisibility(cityEntity, show) {
    if (cityEntity && cityEntity.label) {
        cityEntity.label.show = show;
    }
}
