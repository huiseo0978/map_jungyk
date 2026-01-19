let cesiumUIHandlersInitialized = false;

function setupCesiumUIHandlers() {
    if (typeof setCesiumEventCallbacks !== 'function') {
        return;
    }
    
    if (cesiumUIHandlersInitialized) {
        return;
    }
    
    const existingCallbacks = {};
    if (typeof getCesiumEventCallbacks === 'function') {
        const current = getCesiumEventCallbacks();
        if (current.onCameraChanged) {
            existingCallbacks.onCameraChanged = current.onCameraChanged;
        }
        if (current.onMouseMove) {
            existingCallbacks.onMouseMove = current.onMouseMove;
        }
        if (current.onDoubleClick) {
            existingCallbacks.onDoubleClick = current.onDoubleClick;
        }
    }
    
    setCesiumEventCallbacks({
        onCameraChanged: function(data) {
            if (existingCallbacks.onCameraChanged) {
                existingCallbacks.onCameraChanged(data);
            }
            if (typeof updateLevelInfo === 'function') {
                updateLevelInfo(data.height);
            }
        },
        
        onMouseMove: function(eventData) {
            let result = null;
            if (existingCallbacks.onMouseMove) {
                result = existingCallbacks.onMouseMove(eventData);
            }
            
            if (!eventData || result && result.shouldProcessEntity === false) {
                return result;
            }
            
            if (eventData.coordinate) {
                if (typeof updateCoordinateInfo === 'function') {
                    updateCoordinateInfo(eventData.coordinate.lon, eventData.coordinate.lat);
                }
            }
            
            if (eventData.markerData) {
                const content = "위치<br>경도: " + eventData.markerData.lonlat[0].toFixed(6) + "<br>위도: " + eventData.markerData.lonlat[1].toFixed(6);
                if (typeof showPopup3D === 'function') {
                    showPopup3D(eventData.markerData.screenPosition, content);
                }
                if (typeof setCursor3D === 'function') {
                    setCursor3D('pointer');
                }
            } else if (eventData.cityData) {
                if (typeof showPopup3D === 'function') {
                    showPopup3D(eventData.cityData.screenPosition, eventData.cityData.name);
                }
                if (typeof setCursor3D === 'function') {
                    setCursor3D('pointer');
                }
            } else {
                if (typeof hidePopup3D === 'function') {
                    hidePopup3D();
                }
                if (typeof setCursor3D === 'function') {
                    setCursor3D('');
                }
            }
            
            if (eventData.cityLabelStates) {
                for (let i = 0; i < eventData.cityLabelStates.length; i = i + 1) {
                    const state = eventData.cityLabelStates[i];
                    if (typeof updateCityLabelVisibility === 'function') {
                        updateCityLabelVisibility(state.entity, state.show);
                    }
                }
            }
            
            return result;
        },
        
        onDoubleClick: function() {
            if (existingCallbacks.onDoubleClick) {
                existingCallbacks.onDoubleClick();
            }
            
            if (isMeasuringNow) {
                finishMeasureFunction();
            } else if (isAreaMeasuringNow) {
                finishAreaMeasureFunction();
            } else {
                if (document.body.classList.contains("topbar-hidden")) {
                    window.toggleTopbar();
                }
            }
        }
    });
    
    cesiumUIHandlersInitialized = true;
}
