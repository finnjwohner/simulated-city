import * as network from './networkGraph.js';
import * as geoForm from './geoFormulas.js';
import Agent from './agent.js';

const agentDisplay = document.querySelector('.agent-display');
const addAgentBtn = document.querySelector('#add-agent-btn');
const removeAgentBtn = document.querySelector('#remove-agent-btn');

const map = L.map('map', {zoomControl: false, minZoom: 16, maxZoom: 19}).setView([55.9581957731748, -3.1314852713325], 16);

map.on('drag', () => {
    for(let i = 0; i < agents.length; i++) {
        AdjustMarkerInfoPos(agents[i]);
    }
})

let roadLinks = null;
let roadNodes = null;
let graph = null;

const timeStep = 1000/30;

async function getGeoJson() {
    const response = await fetch('http://localhost:3000/geoJson');
    const json = await response.json();

    roadLinks = json.roadLink;
    roadNodes = json.roadNode;

    L.geoJson(roadLinks).addTo(map);
    //L.geoJson(json.roadNode).addTo(map);

    graph = network.createGraph(roadLinks, roadNodes);

    InitialiseAgents(graph);
    agents[0].frontAgent = agents[1];
    agents[1].frontAgent = agents[0];
    setInterval(() => {
        UpdateAgents(graph);
    }, timeStep)
    
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

let numAgents = 2;
const agents = [];

const InitialiseAgents = graph => {
    for(let i = 0; i < numAgents; i++) {
        AddAgent(graph, i);
    }
}

let selectedAgent = null;

const CreateMarkerInfo = () => {
    const markerInfo = document.querySelector('#marker-info-clone');
    const markerInfoClone = markerInfo.cloneNode(true);
    markerInfoClone.removeAttribute('id');

    return markerInfoClone;
}

const ClickAgent = (agent, e) => {
    if (agent.markerInfo == null) {
        console.log('Adding');
        agent.markerInfo = CreateMarkerInfo();
        document.body.appendChild(agent.markerInfo);
        agent.markerInfo.children[0].innerHTML = `Agent ${agent.index + 1}`;

        AdjustMarkerInfoPos(agent);
    } else {
        agent.markerInfo.remove();
        console.log('Removing');
        agent.markerInfo = null;
    }
}

const AdjustMarkerInfoPos = agent => {
    if (agent.markerInfo == null) {
        return;
    }

    const {left, top} = agent.marker.getElement().getBoundingClientRect();
    const {width, height} = agent.markerInfo.getBoundingClientRect();
    agent.markerInfo.style.left = `${left - width/2.3}px`;
    agent.markerInfo.style.top = `${top - height - 8}px`;

    const mph = Math.round(AgentSpeedToMph(agent.speed));
    agent.markerInfo.children[1].innerHTML = `${mph} Miles Per Hour`;
}

const AddAgent = (graph, index) => {
    const agent = new Agent();

    // Pick random road to start on. (for now)
    const keys = Object.keys(graph.roads);
    const road = graph.roads[keys[keys.length * Math.random() << 0]];

    agent.currentRoad = road;
    agent.index = index;
    let queue = agent.forwards ? agent.currentRoad.forwardTrafficQueue : agent.currentRoad.backwardTrafficQueue;
    queue.push(agent);
    agent.currentLat = road.coordinates[0][1];
    agent.currentLong = road.coordinates[0][0];
    agent.marker = L.marker([road.coordinates[0][1], road.coordinates[0][0]]).on('click', (e) => ClickAgent(agent, e)).addTo(map);
    agent.segmentIndex = agent.forwards ? 0 : road.coordinates.length - 1;
    agent.desiredSpeed = 80;

    const nextJunction = agent.forwards ? agent.currentRoad.endJunction : agent.currentRoad.startJunction;
    const junction = graph.junctions[nextJunction];

    if (junction.roads.length > 1) {
        const avoidIndex = junction.roads.indexOf(agent.currentRoad);

        let rand = 0
        do {
            rand = Math.floor(Math.random() * (junction.roads.length));
        } while(rand == avoidIndex);

        agent.nextRoad = junction.roads[rand];
    } else {
        agent.nextRoad = junction.roads[0];
    }

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

    numAgents++;
    AddAgent(graph, agents.length);
});

removeAgentBtn.addEventListener('click', () => {
    if (graph == null || agents.length == 0) {
        return;
    }

    numAgents--;
    agentDisplay.removeChild(agentDisplay.lastChild);
    const agent = agents.pop();
    map.removeLayer(agent.marker);
})

const distanceRequiredToStop = speedMph => {
    return 0.015 * speedMph * speedMph;
}

const MphToMps = speedMph => {
    return speedMph / 2.237;
}

const AgentSpeedToMph = agentSpeed => {
    return agentSpeed * timeStep * 2.237 * 1000;
}

const MphToAgentSpeed = speedMph => {
    return MphToMps(speedMph) / timeStep / 1000;
}

const DistBetweenAgents = (agent1, agent2) => {
    return geoForm.Distance(agent1.currentLat, agent1.currentLong, agent2.currentLat, agent2.currentLong);
}

const DesiredAgentSpeed = (agent) => {
    // speeds in metres per second

    let maximumAcceleration = 1.5 / timeStep;
    let desiredSpeed = MphToMps(agent.desiredSpeed);
    let reactionTime = 1.1;

    let speed =  2.5 * maximumAcceleration * reactionTime * (1 - (agent.speed*timeStep*1000)/desiredSpeed) * Math.pow((0.025 + (agent.speed*timeStep*1000)/desiredSpeed), 0.5);
    return agent.speed + (speed / timeStep / 1000);
}

const FrontAgent = agent => {
    let queue = agent.forwards ? agent.currentRoad.forwardTrafficQueue : agent.currentRoad.backwardTrafficQueue;

    let index = queue.indexOf(agent);
    if (index == 0) {
        return null;
    }
    else {
        return queue[index - 1];
    }
}

const ControlledSpeed = agent => {
    const frontAgent = FrontAgent(agent);

    if (frontAgent == null) {
        return 999999;
    }

    let maxDe = -1.5;
    let reactionTime = 1.1;

    let distCheck = (DistBetweenAgents(agent, frontAgent)) * 1000 - 4;
    let breakTimeCheck = agent.speed*1000*timeStep * reactionTime + (Math.pow(frontAgent.speed*1000*timeStep, 2) / -3);
    let sqrt = Math.sqrt(Math.pow(maxDe, 2) * Math.pow(reactionTime, 2) - maxDe * (2*distCheck - breakTimeCheck));
    let speed = maxDe * reactionTime + sqrt;

    if (isNaN(speed) || speed < 0) {
        speed = 0;
    }

    return speed / 1000 / timeStep;
}

const ControlledJunctionSpeed = (agent, graph) => {
    let maxDe = -3.5;
    let reactionTime = 1.1;
    const targetJunction = agent.forwards ? agent.currentRoad.endJunction : agent.currentRoad.startJunction;
    let junc = graph.junctions[targetJunction];
    let distCheck = geoForm.Distance(agent.currentLat, agent.currentLong, junc.coordinates[1], junc.coordinates[0]) * 1000 - 5;
    let breakTimeCheck = agent.speed*1000*timeStep * reactionTime;
    let sqrt = Math.sqrt(Math.pow(maxDe, 2) * Math.pow(reactionTime, 2) - maxDe * (3*distCheck - breakTimeCheck));
    let speed = maxDe * reactionTime + sqrt;

    if (isNaN(speed) || speed < 0) {
        speed = 0;
    }

    return speed / 1000 / timeStep;
}

const UpdateAgents = graph => {
    agents.forEach((agent) => {

        agent.speed = Math.min(DesiredAgentSpeed(agent), ControlledSpeed(agent));

        if (agent.nextRoad.func != agent.currentRoad.func) {
            agent.speed = Math.min(DesiredAgentSpeed(agent), ControlledSpeed(agent), ControlledJunctionSpeed(agent, graph));
        }

        const [lat, long] = geoForm.WalkPosition(agent.currentLat, agent.currentLong, agent.segmentBearing, agent.speed);
        agent.currentLat = lat;
        agent.currentLong = long;
        agent.segmentDistAcc += agent.speed;

        if (agent.segmentDistAcc >= agent.segmentDist) {
            agent.segmentDistAcc -= agent.segmentDist

            let coords = agent.currentRoad.coordinates;

            agent.segmentIndex = agent.forwards ? agent.segmentIndex + 1 : agent.segmentIndex - 1;
            const nextRoad = agent.forwards ? (agent.segmentIndex + 1 >= coords.length) : agent.segmentIndex == 0;

            if (nextRoad) {
            
                let queue = agent.forwards ? agent.currentRoad.forwardTrafficQueue : agent.currentRoad.backwardTrafficQueue;
                queue.splice(queue.indexOf(agent), 1);

                const currentJunction = graph.junctions[agent.forwards ? agent.currentRoad.endJunction : agent.currentRoad.startJunction];
                agent.forwards = agent.currentRoad.startJunction.identifier == currentJunction.identifier;
                agent.currentRoad = agent.nextRoad;

                // Sometimes the data is wrong, and the startJunction is actually the endJunction,
                // so we double check with a distance check

                const checkCoords = agent.forwards ? agent.currentRoad.coordinates[0] : agent.currentRoad.coordinates[agent.currentRoad.coordinates.length - 1];

                let dst = geoForm.Distance(agent.currentLat, agent.currentLong, checkCoords[1], checkCoords[0]);
                dst = Math.abs(dst - agent.segmentDistAcc/1000);
                
                if(dst > 0.01) {
                    agent.forwards = !agent.forwards;
                }

                coords = agent.currentRoad.coordinates;
                agent.segmentIndex = agent.forwards ? 0 : coords.length - 1;
                queue = agent.forwards ? agent.currentRoad.forwardTrafficQueue : agent.currentRoad.backwardTrafficQueue;
                queue.push(agent);

                const nextJunction = agent.forwards ? agent.currentRoad.endJunction : agent.currentRoad.startJunction;
                const junction = graph.junctions[nextJunction];

                if (junction.roads.length > 1) {
                    const avoidIndex = junction.roads.indexOf(agent.currentRoad);

                    let rand = 0
                    do {
                        rand = Math.floor(Math.random() * (junction.roads.length));
                    } while(rand == avoidIndex);

                    agent.nextRoad = junction.roads[rand];
                } else {
                    agent.nextRoad = junction.roads[0];
                }
            }

            const index = agent.forwards ? agent.segmentIndex + 1 : agent.segmentIndex - 1;

            agent.segmentBearing = geoForm.Bearing(coords[agent.segmentIndex][1], coords[agent.segmentIndex][0], coords[index][1], coords[index][0]);
            agent.segmentDist = geoForm.Distance(coords[agent.segmentIndex][1], coords[agent.segmentIndex][0], coords[index][1], coords[index][0]);

            const [lat, long] = geoForm.WalkPosition(coords[agent.segmentIndex][1], coords[agent.segmentIndex][0], agent.segmentBearing, agent.segmentDistAcc);
            agent.currentLat = lat;
            agent.currentLong = long;
        }

        agent.marker.setLatLng(L.latLng(agent.currentLat, agent.currentLong));
        AdjustMarkerInfoPos(agent);
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

        const [lat, long] = geoForm.WalkPosition(currentLat, currentLong, segmentBearing, agent.speed);
        currentLat = lat;
        currentLong = long;
        segmentDistAcc += agent.speed;

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