//import roadLinkJSON from './geoJson/roadLinkJSON.js';
//import roadNodeJSON from './geoJson/roadNodeJSON.js';

var map = L.map('map', {zoomControl: false, minZoom: 16, maxZoom: 19}).setView([55.9581957731748, -3.1314852713325], 16);

async function getGeoJson() {
    const response = await fetch('http://localhost:3000/geoJson');
    const json = await response.json();

    console.log(json.roadLink);

    L.geoJson(json.roadLink).addTo(map);
    //L.geoJson(json.roadNode).addTo(map);

    console.log('Added');
}

getGeoJson();

