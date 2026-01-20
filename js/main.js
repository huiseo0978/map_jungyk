if (!window.__globalErrorListenerAdded) {
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
    window.__globalErrorListenerAdded = true;
}

if (!window.__globalUnhandledRejectionListenerAdded) {
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
    window.__globalUnhandledRejectionListenerAdded = true;
}

function initApp() {
    if (typeof map !== 'undefined' && map && typeof map.updateSize === 'function') {
        map.updateSize();
    }
    if (typeof cesiumViewer !== 'undefined' && cesiumViewer && typeof cesiumViewer.resize === 'function') {
        cesiumViewer.resize();
    }
}

if (!window.__globalResizeListenerAdded) {
    window.addEventListener('resize', function() {
        initApp();
    });
    window.__globalResizeListenerAdded = true;
}

if (typeof initApp === 'function') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            initApp();
        });
    } else {
        initApp();
    }
}

function setupCesiumEventCoordination() {
    if (window.__cesiumEventCoordinationSetup) {
        return;
    }
    
    if (typeof setCesiumEventCallbacks !== 'function') {
        return;
    }
    
    setCesiumEventCallbacks({
        onCameraChanged: function(data) {
            if (typeof sync3DTo2D === 'function' && is3DModeActive) {
                sync3DTo2D({
                    cameraHeight: data.height,
                    cameraPosition: data.position,
                    map: map,
                    mainView: mainView,
                    is3DModeActive: is3DModeActive
                });
            }
        },
        
        onMouseMove: function(eventData) {
            if (isMeasuringNow || isAreaMeasuringNow) {
                return { shouldProcessEntity: false };
            }
            return { shouldProcessEntity: true };
        }
    });
    
    window.__cesiumEventCoordinationSetup = true;
}

if (!window.__cesiumEventCoordinationRetryCount) {
    window.__cesiumEventCoordinationRetryCount = 0;
}
const MAX_CESIUM_EVENT_COORDINATION_RETRIES = 50;

function trySetupCesiumEventCoordination() {
    if (window.__cesiumEventCoordinationSetup) {
        return;
    }
    
    if (typeof setCesiumEventCallbacks === 'function' && typeof sync3DTo2D === 'function' && typeof map !== 'undefined' && typeof mainView !== 'undefined') {
        setupCesiumEventCoordination();
    } else {
        window.__cesiumEventCoordinationRetryCount++;
        if (window.__cesiumEventCoordinationRetryCount < MAX_CESIUM_EVENT_COORDINATION_RETRIES) {
            if (document.readyState === 'loading') {
                if (!window.__cesiumEventCoordinationDOMListenerAdded) {
                    document.addEventListener('DOMContentLoaded', trySetupCesiumEventCoordination);
                    window.__cesiumEventCoordinationDOMListenerAdded = true;
                }
            } else {
                if (typeof requestAnimationFrame !== 'undefined') {
                    requestAnimationFrame(trySetupCesiumEventCoordination);
                }
            }
        }
    }
}

if (typeof setupCesiumEventCoordination === 'function') {
    trySetupCesiumEventCoordination();
}
