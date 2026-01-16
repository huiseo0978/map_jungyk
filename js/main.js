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

function initApp() {
    if (typeof map !== 'undefined' && map && typeof map.updateSize === 'function') {
        map.updateSize();
    }
    if (typeof cesiumViewer !== 'undefined' && cesiumViewer && typeof cesiumViewer.resize === 'function') {
        cesiumViewer.resize();
    }
}

window.addEventListener('resize', function() {
    initApp();
});

if (typeof initApp === 'function') {
    setTimeout(function() {
        initApp();
    }, 100);
}
