function openTabExampleModal() {
    const tabExampleModalDiv = document.getElementById("tabExampleModal");
    if (tabExampleModalDiv != null) {
        modalZIndex += 10;
        tabExampleModalDiv.style.zIndex = modalZIndex;
        tabExampleModalDiv.style.display = "block";
        bringModalToFront(tabExampleModalDiv);
        updateMeasureListFunction();
        updateAreaListFunction();
    }
    setTimeout(function() {
        makeModalDraggable();
    }, 10);
}

function closeTabExampleModal() {
    const tabExampleModalDiv = document.getElementById("tabExampleModal");
    if (tabExampleModalDiv != null) {
        tabExampleModalDiv.style.display = "none";
    }
}

function switchTab(tabName) {
    const tabExampleModalDiv = document.getElementById("tabExampleModal");
    if (tabExampleModalDiv == null) {
        return;
    }
    const allTabButtonElements = tabExampleModalDiv.querySelectorAll(".tab-btn");
    for (let i = 0; i < allTabButtonElements.length; i = i + 1) {
        const currentButton = allTabButtonElements[i];
        currentButton.classList.remove("active");
    }
    const allTabPaneElements = tabExampleModalDiv.querySelectorAll(".tab-pane");
    for (let j = 0; j < allTabPaneElements.length; j = j + 1) {
        const currentPane = allTabPaneElements[j];
        currentPane.classList.remove("active");
    }
    const tabNavigationDiv = tabExampleModalDiv.querySelector(".tab-nav");
    if (tabNavigationDiv != null) {
        const tabNavigationButtons = tabNavigationDiv.querySelectorAll(".tab-btn");
        if (tabName === "distance") {
            if (tabNavigationButtons[0] != null) {
                tabNavigationButtons[0].classList.add("active");
            }
        }
        else if (tabName === "area") {
            if (tabNavigationButtons[1] != null) {
                tabNavigationButtons[1].classList.add("active");
            }
        }
    }
    const selectedTabPaneId = "tab-" + tabName;
    const selectedTabPaneElement = document.getElementById(selectedTabPaneId);
    if (selectedTabPaneElement != null) {
        selectedTabPaneElement.classList.add("active");
    }
    
    const tabDistanceFooter = document.getElementById("tab-distance-footer");
    const tabAreaFooter = document.getElementById("tab-area-footer");
    
    if (tabName === "distance") {
        if (tabDistanceFooter != null) {
            tabDistanceFooter.style.display = "flex";
        }
        if (tabAreaFooter != null) {
            tabAreaFooter.style.display = "none";
        }
    }
    else if (tabName === "area") {
        if (tabDistanceFooter != null) {
            tabDistanceFooter.style.display = "none";
        }
        if (tabAreaFooter != null) {
            tabAreaFooter.style.display = "flex";
        }
    }
}

function startMeasureFromTab() {
    startMeasure();
}

function clearMeasuresFromTab() {
    clearMeasures();
}

function startAreaMeasureFromTab() {
    startAreaMeasure();
}

function clearAreasFromTab() {
    clearAreas();
}

function handleTabDelete() {
    const tabExampleModalDiv = document.getElementById("tabExampleModal");
    if (tabExampleModalDiv == null) {
        return;
    }
    const activeTabPane = tabExampleModalDiv.querySelector(".tab-pane.active");
    if (activeTabPane == null) {
        return;
    }
    const activeTabId = activeTabPane.id;
    if (activeTabId === "tab-distance") {
        clearMeasures();
    } else if (activeTabId === "tab-area") {
        clearAreas();
    }
}

function handleTabReset() {
    clearMeasures();
    clearAreas();
}

window.openTabExampleModal = openTabExampleModal;
window.closeTabExampleModal = closeTabExampleModal;
window.switchTab = switchTab;
window.startMeasureFromTab = startMeasureFromTab;
window.clearMeasuresFromTab = clearMeasuresFromTab;
window.startAreaMeasureFromTab = startAreaMeasureFromTab;
window.clearAreasFromTab = clearAreasFromTab;
window.handleTabDelete = handleTabDelete;
window.handleTabReset = handleTabReset;
