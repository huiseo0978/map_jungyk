let moveMapClickHandler = null;
let cesiumMoveMapClickHandler = null;
let isMoveModalOpen = false;

function openMoveModal() {
    const moveModalElement = document.getElementById("moveModal");
    if (moveModalElement) {
        modalZIndex += 10;
        moveModalElement.style.zIndex = modalZIndex;
        moveModalElement.style.display = "block";
        bringModalToFront(moveModalElement);
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

function bringModalToFront(modalElement) {
    modalZIndex += 1;
    modalElement.style.zIndex = modalZIndex;
}

function getTopModal() {
    const modals = document.querySelectorAll('.modal');
    let topModal = null;
    let topZIndex = 0;
    for (let i = 0; i < modals.length; i++) {
        const modal = modals[i];
        if (modal.style.display === 'block') {
            const zIndex = parseInt(window.getComputedStyle(modal).zIndex) || 0;
            if (zIndex > topZIndex) {
                topZIndex = zIndex;
                topModal = modal;
            }
        }
    }
    return topModal;
}

function closeTopModal() {
    const topModal = getTopModal();
    if (topModal) {
        const modalId = topModal.id;
        if (modalId === 'moveModal') {
            closeMoveModal();
        } else if (modalId === 'measureModal') {
            closeMeasureModal();
        } else if (modalId === 'areaModal') {
            closeAreaModal();
        } else if (modalId === 'tabExampleModal') {
            closeTabExampleModal();
        }
    }
}

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' || event.keyCode === 27) {
        closeTopModal();
    }
});

document.addEventListener('click', function(event) {
    const clickedModal = event.target.closest('.modal');
    if (clickedModal && clickedModal.style.display === 'block') {
       if (!event.target.classList.contains('modal-close')) {
            bringModalToFront(clickedModal);
        }
    }
});

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

window.openMoveModal = openMoveModal;
window.closeMoveModal = closeMoveModal;
window.moveToCoordinates = moveToCoordinates;
window.moveToCenter = moveToCenter;
