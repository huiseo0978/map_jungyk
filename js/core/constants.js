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

const DEFAULT_CAMERA_HEIGHT = 15000;
const MIN_CAMERA_HEIGHT = 100;
const MAX_CAMERA_HEIGHT = 40000000;
const DEFAULT_VIEWPORT_HEIGHT = 512;
const ZOOM_DIFFERENCE_THRESHOLD = 0.01;
const CLOSEST_DISTANCE_THRESHOLD = 0.01;
const CENTER_SYNC_DISTANCE_THRESHOLD_METERS = 1000;
const ANIMATION_DURATION = 300;
const SYNC_DELAY = 400;
const DEFAULT_ZOOM_LEVEL = 13;
const CITY_ZOOM_LEVEL = 16;
const METERS_PER_PIXEL_AT_EQUATOR = 156543.03392;
const EPSILON = Number.EPSILON || 1e-10;
const COS_LAT_THRESHOLD = 1e-6;