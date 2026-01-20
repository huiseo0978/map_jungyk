let globalErrorListenerAdded = false;
let globalUnhandledRejectionListenerAdded = false;
let globalResizeListenerAdded = false;

if (!globalErrorListenerAdded) {
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
    globalErrorListenerAdded = true;
}

if (!globalUnhandledRejectionListenerAdded) {
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
    globalUnhandledRejectionListenerAdded = true;
}

function initApp() {
    if (typeof map !== 'undefined' && map && typeof map.updateSize === 'function') {
        map.updateSize();
    }
    if (typeof cesiumViewer !== 'undefined' && cesiumViewer && typeof cesiumViewer.resize === 'function') {
        cesiumViewer.resize();
    }
}

if (!globalResizeListenerAdded) {
    window.addEventListener('resize', function() {
        initApp();
    });
    globalResizeListenerAdded = true;
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

let cesiumEventCoordinationSetup = false;

function setupCesiumEventCoordination() {
    if (cesiumEventCoordinationSetup) {
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
    
    cesiumEventCoordinationSetup = true;
}

let cesiumEventCoordinationRetryCount = 0;
const MAX_CESIUM_EVENT_COORDINATION_RETRIES = 50;

function trySetupCesiumEventCoordination() {
    if (cesiumEventCoordinationSetup) {
        return;
    }
    
    if (typeof setCesiumEventCallbacks === 'function' && typeof sync3DTo2D === 'function' && typeof map !== 'undefined' && typeof mainView !== 'undefined') {
        setupCesiumEventCoordination();
    } else {
        cesiumEventCoordinationRetryCount++;
        if (cesiumEventCoordinationRetryCount < MAX_CESIUM_EVENT_COORDINATION_RETRIES) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', trySetupCesiumEventCoordination);
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
