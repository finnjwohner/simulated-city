import * as network from './networkGraph.js';
import * as geoForm from './geoFormulas.js';
import Agent from './agent.js';

const agentDisplay = document.querySelector('.agent-display');
const addAgentBtn = document.querySelector('#add-agent-btn');
const removeAgentBtn = document.querySelector('#remove-agent-btn');

const map = L.map('map', {zoomControl: false, minZoom: 16, maxZoom: 19}).setView([55.9581957731748, -3.1314852713325], 16);

let roadLinks = null;
let roadNodes = null;
let graph = null;

async function getGeoJson() {
    const response = await fetch('http://localhost:3000/geoJson');
    const json = await response.json();

    roadLinks = json.roadLink;
    roadNodes = json.roadNode;

    L.geoJson(roadLinks).addTo(map);
    //L.geoJson(json.roadNode).addTo(map);

    graph = network.createGraph(roadLinks, roadNodes);

    InitialiseAgents(graph);
    setInterval(() => {
        UpdateAgents(graph);
    }, 1000/30)
    
}

getGeoJson();

let started = false;
let currentRoad = null;
let currentLat = null;
let currentLong = null;
let segmentIndex = 0;
let segmentDist = 0;
let segmentDistAcc = 0;
let segmentBearing = 0;
let marker = null;
let forwards = true;

const numAgents = 1;
const agents = [];

const InitialiseAgents = graph => {
    for(let i = 0; i < numAgents; i++) {
        AddAgent(graph, i);
    }
}

const AddAgent = (graph, index) => {
    const agent = new Agent();

    // Pick random road to start on. (for now)
    const keys = Object.keys(graph.roads);
    const road = graph.roads[keys[keys.length * Math.random() << 0]];

    agent.currentRoad = road;
    agent.currentLat = road.coordinates[0][1];
    agent.currentLong = road.coordinates[0][0];
    agent.marker = L.marker([road.coordinates[0][1], road.coordinates[0][0]]).addTo(map);
    agent.segmentIndex = agent.forwards ? 0 : road.coordinates.length - 1;

    const nextSegment = agent.forwards ? segmentIndex + 1 : segmentIndex - 1;
    agent.segmentBearing = geoForm.Bearing(agent.currentLat, agent.currentLong, road.coordinates[nextSegment][1], road.coordinates[nextSegment][0]);

    agents.push(agent);

    const p = document.createElement('p');
    p.innerHTML = `Agent${index + 1}`;
    agentDisplay.appendChild(p);
}

addAgentBtn.addEventListener('click', () => {
    if (graph == null) {
        return;
    }

    AddAgent(graph, agents.length);
});

removeAgentBtn.addEventListener('click', () => {
    if (graph == null || agents.length == 0) {
        return;
    }

    agentDisplay.removeChild(agentDisplay.lastChild);
    const agent = agents.pop();
    map.removeLayer(agent.marker);
})

const UpdateAgents = graph => {
    agents.forEach((agent) => {
        const speed = 2/1000;

        const [lat, long] = geoForm.WalkPosition(agent.currentLat, agent.currentLong, agent.segmentBearing, speed);
        agent.currentLat = lat;
        agent.currentLong = long;
        agent.segmentDistAcc += speed;

        if (agent.segmentDistAcc >= agent.segmentDist) {
            agent.segmentDistAcc -= agent.segmentDist

            let coords = agent.currentRoad.coordinates;

            agent.segmentIndex = agent.forwards ? agent.segmentIndex + 1 : agent.segmentIndex - 1;
            const nextRoad = agent.forwards ? (agent.segmentIndex + 1 >= coords.length) : agent.segmentIndex == 0;

            if (nextRoad) {
                const nextJunction = agent.forwards ? agent.currentRoad.endJunction : agent.currentRoad.startJunction;
                const junction = graph.junctions[nextJunction];

                if (junction.roads.length > 1) {
                    const avoidIndex = junction.roads.indexOf(agent.currentRoad);

                    let rand = 0
                    do {
                        rand = Math.floor(Math.random() * (junction.roads.length));
                    } while(rand == avoidIndex);

                    agent.currentRoad = junction.roads[rand];
                } else {
                    agent.currentRoad = junction.roads[0];
                }
                
                // Sometimes the data is wrong, and the startJunction is actually the endJunction,
                // so we double check with a distance check
                agent.forwards = agent.currentRoad.startJunction.identifier == junction.identifier;

                const checkCoords = agent.forwards ? agent.currentRoad.coordinates[0] : agent.currentRoad.coordinates[agent.currentRoad.coordinates.length - 1];

                let dst = geoForm.Distance(agent.currentLat, agent.currentLong, checkCoords[1], checkCoords[0]);
                dst = Math.abs(dst - agent.segmentDistAcc/1000);
                
                if(dst > 0.01) {
                    agent.forwards = !agent.forwards;
                }

                coords = agent.currentRoad.coordinates;
                agent.segmentIndex = agent.forwards ? 0 : coords.length - 1;
            }

            const index = agent.forwards ? agent.segmentIndex + 1 : agent.segmentIndex - 1;

            agent.segmentBearing = geoForm.Bearing(coords[agent.segmentIndex][1], coords[agent.segmentIndex][0], coords[index][1], coords[index][0]);
            agent.segmentDist = geoForm.Distance(coords[agent.segmentIndex][1], coords[agent.segmentIndex][0], coords[index][1], coords[index][0]);

            const [lat, long] = geoForm.WalkPosition(coords[agent.segmentIndex][1], coords[agent.segmentIndex][0], agent.segmentBearing, agent.segmentDistAcc);
            agent.currentLat = lat;
            agent.currentLong = long;
        }

        agent.marker.setLatLng(L.latLng(agent.currentLat, agent.currentLong));
    })
}

const moveMarker = graph => {
    if (!started) {
        currentRoad = graph.roads['2FAD6BB1-ED23-4C2D-95B6-9F9142B6AF3B'];
        started = true;
        marker = L.marker([currentRoad.coordinates[segmentIndex][1], currentRoad.coordinates[segmentIndex][0]]).addTo(map);
        currentLat = currentRoad.coordinates[0][1];
        currentLong = currentRoad.coordinates[0][0];
    }
    else {
        console.log(`Forwards: ${forwards}\n SegmentIndex: ${segmentIndex}\n SegmentDist: ${segmentDist}\n SegmentDistAcc: ${segmentDistAcc}`)
        const speed = 2/1000;

        const [lat, long] = geoForm.WalkPosition(currentLat, currentLong, segmentBearing, speed);
        currentLat = lat;
        currentLong = long;
        segmentDistAcc += speed;

        if (segmentDistAcc >= segmentDist) {
            segmentDistAcc -= segmentDist

            let coords = currentRoad.coordinates;

            segmentIndex = forwards ? segmentIndex + 1 : segmentIndex - 1;
            const nextRoad = forwards ? (segmentIndex + 1 >= coords.length) : segmentIndex == 0;

            if (nextRoad) {
                console.log('NEXT ROAD')
                const nextJunction = forwards ? currentRoad.endJunction : currentRoad.startJunction;
                const junction = graph.junctions[nextJunction];

                if (junction.roads.length > 1) {
                    const avoidIndex = junction.roads.indexOf(currentRoad);

                    let rand = 0
                    do {
                        rand = Math.floor(Math.random() * (junction.roads.length));
                    } while(rand == avoidIndex);

                    currentRoad = junction.roads[rand];
                } else {
                    currentRoad = junction.roads[0];
                }
                
                // Sometimes the data is wrong, and the startJunction is actually the endJunction,
                // so we double check with a distance check
                forwards = currentRoad.startJunction.identifier == junction.identifier;

                const checkCoords = forwards ? currentRoad.coordinates[0] : currentRoad.coordinates[currentRoad.coordinates.length - 1];

                let dst = geoForm.Distance(currentLat, currentLong, checkCoords[1], checkCoords[0]);
                dst = Math.abs(dst - segmentDistAcc/1000);
                
                if(dst > 0.01) {
                    forwards = !forwards;
                }

                coords = currentRoad.coordinates;
                segmentIndex = forwards ? 0 : coords.length - 1;
            }

            const index = forwards ? segmentIndex + 1 : segmentIndex - 1;

            segmentBearing = geoForm.Bearing(coords[segmentIndex][1], coords[segmentIndex][0], coords[index][1], coords[index][0]);
            segmentDist = geoForm.Distance(coords[segmentIndex][1], coords[segmentIndex][0], coords[index][1], coords[index][0]);
            console.log(`Bearing: ${segmentBearing}, dist: ${segmentDist}`);

            const [lat, long] = geoForm.WalkPosition(coords[segmentIndex][1], coords[segmentIndex][0], segmentBearing, segmentDistAcc);
            currentLat = lat;
            currentLong = long;
        }

        marker.setLatLng(L.latLng(currentLat, currentLong));
    }
}