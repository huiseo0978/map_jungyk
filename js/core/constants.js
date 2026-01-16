const mapCenter = [127.0276, 37.4979];

const cityInfos = {
    seoul: { 
        name: "서울", 
        lonlat: [126.9780, 37.5665] 
    },
    daegu: { 
        name: "대구", 
        lonlat: [128.6014, 35.8714] 
    },
    busan: { 
        name: "부산", 
        lonlat: [129.0756, 35.1796] 
    },
    jeju: { 
        name: "제주", 
        lonlat: [126.5312, 33.4996] 
    }
};

const markerIconImageUrl = 'https://maps.google.com/mapfiles/ms/icons/red-dot.png';

const BLINK_COUNT = 5;
const BLINK_INTERVAL = 250;
