import * as network from './networkGraph.js';
import * as geoForm from './geoFormulas.js';
import Agent from './agent.js';
import * as Dijkstra from './dijkstra.js';

const agentDisplay = document.querySelector('.agent-display');
const addAgentBtn = document.querySelector('#add-agent-btn');
const removeAgentBtn = document.querySelector('#remove-agent-btn');

const map = L.map('map', {zoomControl: false, minZoom: 16, maxZoom: 19}).setView([55.9581957731748, -3.1314852713325], 16);

map.on('zoom', e => {
    const zoom = map.getZoom();

    let scale = 1;
    
    switch(zoom) {
        case 16:
            scale = 0.2;
            break;
        case 17:
            scale = 0.3;
            break;
        case 18:
            scale = 0.4;
            break;
        case 19:
            scale = 0.6;
            break;
    }

    const trafficLights = document.querySelectorAll('.traffic-light-info');

    for(let i = 0; i < trafficLights.length; i++) {
        trafficLights[i].style.scale = scale;
    }

    const junctions = Object.keys(graph.junctions);

    for(let i = 0; i < junctions.length; i++) {
        for (let j = 0; j < graph.junctions[junctions[i]].lights.length; j++) {
            const light = graph.junctions[junctions[i]].lights[j];
            AdjustTrafficLightPos(light);
        }
    }
})

map.on('resize', e => {
    const junctions = Object.keys(graph.junctions);

    for(let i = 0; i < junctions.length; i++) {
        for (let j = 0; j < graph.junctions[junctions[i]].lights.length; j++) {
            const light = graph.junctions[junctions[i]].lights[j];
            AdjustTrafficLightPos(light);
        }
    }
})

const AdjustTrafficLightPos = trafficLight => {
    const {left, top} = trafficLight.marker.getElement().getBoundingClientRect();
    trafficLight.div.style.left = `${left}px`;
    trafficLight.div.style.top = `${top}px`;
}

let roadLinks = null;
let roadNodes = null;
let graph = null;

map.on('drag', () => {
    for(let i = 0; i < agents.length; i++) {
        AdjustMarkerInfoPos(agents[i]);
    }

    const junctions = Object.keys(graph.junctions);

    for(let i = 0; i < junctions.length; i++) {
        for (let j = 0; j < graph.junctions[junctions[i]].lights.length; j++) {
            const light = graph.junctions[junctions[i]].lights[j];
            AdjustTrafficLightPos(light);
        }
    }
})

const timeStep = 1000/30;

async function getGeoJson() {
    const response = await fetch('http://localhost:3000/geoJson');
    const json = await response.json();

    roadLinks = json.roadLink;
    roadNodes = json.roadNode;

    L.geoJson(roadLinks).addTo(map);
    //L.geoJson(json.roadNode).addTo(map);

    graph = network.createGraph(roadLinks, roadNodes);

    InitDijkstra(graph);
    InitialiseAgents(graph);
    agents[0].frontAgent = agents[1];
    agents[1].frontAgent = agents[0];
    UpdateJunctionSignals(graph);
    setInterval(() => {
        UpdateAgents(graph);
    }, timeStep)
}

getGeoJson();

let numAgents = 2;
const agents = [];

const InitDijkstra = graph => {
    let dijkstraGraph = new Dijkstra.WeightedGraph();

    const nodes = Object.keys(graph.junctions);

    for(let i = 0; i < nodes.length; i++) {
        dijkstraGraph.addVertex(nodes[i]);
    }

    for(let i = 0; i < nodes.length; i++) {
        AddDijkstraEdges(graph, dijkstraGraph, nodes[i])
    }

    graph.weightedGraph = dijkstraGraph;
}

const AddDijkstraEdges = (graph, dijkstraGraph, nodeID) => {
    const links = graph.junctions[nodeID].roads;
    for(let i = 0; i < links.length; i++) {
        let edgeNode = links[i].startJunction;

        if(edgeNode == nodeID) {
            edgeNode = links[i].endJunction;
        }

        dijkstraGraph.addEdge(nodeID, edgeNode, links[i].length);
    }
}

const InitialiseAgents = graph => {
    for(let i = 0; i < numAgents; i++) {
        AddAgent(graph, i);
    }
}

const CreateMarkerInfo = () => {
    const markerInfo = document.querySelector('#marker-info-clone');
    const markerInfoClone = markerInfo.cloneNode(true);
    markerInfoClone.removeAttribute('id');

    return markerInfoClone;
}

const ClickAgent = (agent, e) => {
    console.log(agent);
    console.log(agent.forwards ? agent.currentRoad.forwardTrafficQueue : agent.currentRoad.backwardTrafficQueue);
    const nextJuncIdentifier = agent.forwards ? agent.currentRoad.startJunction : agent.currentRoad.endJunction;
        const nextJunc = graph.junctions[nextJuncIdentifier];
    console.log(IsForwards(agent, nextJunc, agent.nextRoad) ? agent.nextRoad.forwardTrafficQueue : agent.nextRoad.backwardTrafficQueue);

    if (agent.markerInfo == null) {
        agent.markerInfo = CreateMarkerInfo();
        document.body.appendChild(agent.markerInfo);
        agent.markerInfo.children[0].innerHTML = `Agent ${agent.index + 1}`;

        AdjustMarkerInfoPos(agent);
    } else {
        agent.markerInfo.remove();
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
    const length = agent.links.length;
    agent.markerInfo.children[2].innerHTML = `Destination is ${length} Road${length > 1 ? 's' : ''} Away`
}

const AgentSpeedToMph = agentSpeed => {
    return agentSpeed * timeStep * 2.237 * 1000;
}

const AddAgent = (graph, index) => {
    const agent = new Agent();

    // Set junction to start on (random for now);
    const nodeKeys = Object.keys(graph.junctions);
    const startNode = graph.junctions[nodeKeys[nodeKeys.length * Math.random() << 0]];
    
    // Set junction to end on (random for now);
    let endNode = null;
    do {
        endNode = graph.junctions[nodeKeys[nodeKeys.length * Math.random() << 0]];
    } while(endNode == startNode);

    agent.links = graph.weightedGraph.Dijkstra(startNode.identifier, endNode.identifier);

    for (let i = 0; i < startNode.roads.length; i++) {
        const nextLinkIsEndJunction = startNode.roads[i].endJunction == agent.links[1];
        const nextLinkIsStartJunction = startNode.roads[i].startJunction == agent.links[1];

        if(nextLinkIsEndJunction || nextLinkIsStartJunction) {
            agent.currentRoad = startNode.roads[i];

            agent.forwards = nextLinkIsEndJunction;
            break;
        }
    }

    agent.links.splice(0, 1);
    
    const road = agent.currentRoad;

    if(agent.forwards) {
        agent.currentLat = road.coordinates[0][1];
        agent.currentLong = road.coordinates[0][0];
    }
    else {
        agent.currentLat = road.coordinates[road.coordinates.length - 1][1];
        agent.currentLong = road.coordinates[road.coordinates.length - 1][0];
    }

    let queue = agent.forwards ? agent.currentRoad.forwardTrafficQueue : agent.currentRoad.backwardTrafficQueue;
    queue.push(agent);

    agent.index = index;
    
    agent.marker = L.marker([agent.currentLat, agent.currentLong]).on('click', (e) => ClickAgent(agent, e)).addTo(map);
    agent.segmentIndex = agent.forwards ? 0 : road.coordinates.length - 1;
    agent.desiredSpeed = 80;
    agent.linkDistAcc = 0;

    const nextJunction = graph.junctions[agent.links[0]];

    for(let i = 0; i < nextJunction.roads.length; i++) {
        const foundStart = nextJunction.roads[i].startJunction == agent.links[1];
        const foundEnd = nextJunction.roads[i].endJunction == agent.links[1];

        if (foundStart || foundEnd) {
            agent.nextRoad = nextJunction.roads[i];
            break;
        }
    }

    const nextSegment = agent.forwards ? agent.segmentIndex + 1 : agent.segmentIndex - 1;
    agent.segmentBearing = geoForm.Bearing(agent.currentLat, road, road.coordinates[nextSegment][1], agent.currentRoad.coordinates[nextSegment][0]);

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
    AddAgent(graph, agents.length - 1);
});

removeAgentBtn.addEventListener('click', () => {
    if (graph == null || agents.length == 0) {
        return;
    }

    numAgents--;
    agentDisplay.removeChild(agentDisplay.lastChild);
    const agent = agents.pop();
    map.removeLayer(agent.marker);

    if (agent.markerInfo != null) {
        agent.markerInfo.remove();
    }
})

const                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       RemoveAgent = index => {
    if (graph == null || agents.length == 0) {
        return;
    }

    numAgents--;

    agentDisplay.removeChild(agentDisplay.children[index]);

    const agent = agents.splice(index, 1);
    map.removeLayer(agent[0].marker);

    if (agent[0].markerInfo != null) {
        agent[0].markerInfo.remove();
    }
}

const MphToMps = speedMph => {
    return speedMph / 2.237;
}

const DistBetweenAgents = (agent1, agent2) => {
    return geoForm.Distance(agent1.currentLat, agent1.currentLong, agent2.currentLat, agent2.currentLong);
}

const DesiredAgentSpeed = (agent) => {
    // speeds in metres per second

    let maximumAcceleration = 3.5 / timeStep;
    let desiredSpeed = MphToMps(agent.desiredSpeed);
    let reactionTime = 1.1;

    let speed =  2.5 * maximumAcceleration * reactionTime * (1 - (agent.speed*timeStep*1000)/desiredSpeed) * Math.pow((0.025 + (agent.speed*timeStep*1000)/desiredSpeed), 0.5);
    return agent.speed + (speed / timeStep / 1000);
}

const FrontAgent = (agent, graph) => {
    let queue = agent.forwards ? agent.currentRoad.forwardTrafficQueue : agent.currentRoad.backwardTrafficQueue;

    let frontAgent = CheckQueuePosFront(agent, queue);

    if (frontAgent == null) {
        if (agent.nextRoad == null) {
            return null;
        }

        const nextJuncIdentifier = agent.forwards ? agent.currentRoad.startJunction : agent.currentRoad.endJunction;
        const nextJunc = graph.junctions[nextJuncIdentifier];

        queue = IsForwards(agent, nextJunc, agent.nextRoad) ? agent.nextRoad.forwardTrafficQueue : agent.nextRoad.backwardTrafficQueue;
        frontAgent = CheckQueuePosFront(agent, queue);
    }

    return frontAgent;
}

const CheckQueuePosFront = (agent, queue) => {
    if (queue.length == 0) {
        return null;
    }

    const index = queue.indexOf(agent);

    if(index == 0) {
        return null;
    }
    else if (index == -1) {
        return queue[queue.length - 1];
    }
    else {
        return queue[index - 1];
    }
}

const IsForwards = (agent, startJunction, road) => {
    let forwards = startJunction.identifier == road.startJunction.identifier;

    // Sometimes the data is wrong, and the startJunction is actually the endJunction,
    // so we double check with a distance check

    const checkCoords = forwards ? road.coordinates[0] : road.coordinates[road.coordinates.length - 1];

    let dst = geoForm.Distance(startJunction.coordinates[1], startJunction.coordinates[0], checkCoords[1], checkCoords[0]);
    dst = Math.abs(dst - agent.segmentDistAcc/1000);
    
    if(dst > 0.01) {
        forwards = !forwards;
    }

    return forwards;
}

const ControlledSpeed = (agent, graph) => {
    const frontAgent = FrontAgent(agent, graph);

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

    if (junc.roadPairs[junc.greenRoadPairIndex].includes(agent.currentRoad)) {
        return 9999999;
    }

    let breakTimeCheck = agent.speed*1000*timeStep * reactionTime;
    let sqrt = Math.sqrt(Math.pow(maxDe, 2) * Math.pow(reactionTime, 2) - maxDe * (3*distCheck - breakTimeCheck));
    let speed = maxDe * reactionTime + sqrt;

    if (isNaN(speed) || speed < 0) {
        speed = 0;
    }

    return speed / 1000 / timeStep;
}

const UpdateJunctionSignals = graph => {
    for(const [key, value] of Object.entries(graph.junctions)) {
        FindRoadPairs(value);
    }
}

const FindRoadPairs = junction => {
    // 1, Check length of roads array is greater than 2, if not, always green
    // 2, Check road names
    // 3, If <= 2 roads remain, match up
    // 4, If > 2 roads remain, check bearings of roads and match most similair until (3) is reached

    const greenPairInterval = 30000;

    // 1
    if (junction.roads.length <= 2) {
        junction.roadPairs = [junction.roads];
        SwapGreenPairs(junction);
        setInterval(() => {
            SwapGreenPairs(junction);
        }, greenPairInterval);
        return;
    }

    // 2

    const matchingNameRoads = {};

    for(let i = 0; i < junction.roads.length - 1; i++) {
        for(let j = i + 1; j < junction.roads.length; j++) {
            if (junction.roads[i].roadName == junction.roads[j].roadName) {
                const roadName = junction.roads[i].roadName;
                if (matchingNameRoads[roadName] == undefined) {
                    matchingNameRoads[roadName] = new Set();
                }

                matchingNameRoads[roadName].add(junction.roads[i]);
                matchingNameRoads[roadName].add(junction.roads[j]);
                //junction.roadPairs.push([junction.roads[i], junction.roads[j]]);
            }
        }
    }

    const nameRoadKeys = Object.keys(matchingNameRoads);
    for(let i = 0; i < nameRoadKeys.length; i++) {
        const set = matchingNameRoads[nameRoadKeys[i]];
        if (set.size <= 2) {
            const setIter =  set.keys();

            const pair = [];
            for(let j = 0; j < set.size; j++) {
                pair.push(setIter.next().value);
            }

            junction.roadPairs.push(pair);
        }
        else if (set.size > 2) {
            const remainingRoads = Array.from(set);
            RoadPairBearingMatch(junction, remainingRoads); 
        }
    }

    // Find num/&objects of roads remaining
    let roadsRemaining = [];
    junction.roads.forEach(road => {
        let found = false;
        junction.roadPairs.forEach(pair => {
            pair.forEach(pairedRoad => {
                if (road.identifier == pairedRoad.identifier) {
                    found = true;
                }
            })
        })

        if (!found) {
            roadsRemaining.push(road);
        }
    })

    if(roadsRemaining.length == 0) {
        AddTrafficLights(junction);
        SwapGreenPairs(junction);
        setInterval(() => {
            SwapGreenPairs(junction);
        }, greenPairInterval);
        return;
    }

    // 3
    if(roadsRemaining.length <= 2) {
        junction.roadPairs.push(roadsRemaining);
        AddTrafficLights(junction)
        SwapGreenPairs(junction);
        setInterval(() => {
            SwapGreenPairs(junction);
        }, greenPairInterval);
        return;
    }

    // 4
    RoadPairBearingMatch(junction, roadsRemaining);

    AddTrafficLights(junction)
    SwapGreenPairs(junction);
    setInterval(() => {
        
        SwapGreenPairs(junction);
    }, greenPairInterval);
}

const AddTrafficLights = junction => {
    console.log(junction.roadPairs);

    for(let i = 0; i < junction.roadPairs.length; i++) {
        for (let j = 0; j < junction.roadPairs[i].length; j++) {
            const road = junction.roadPairs[i][j];
            const startOfRoad = road.startJunction == junction.identifier;

            const index1 = startOfRoad ? 0 : road.coordinates.length - 1;
            const index2 = startOfRoad ? 1 : road.coordinates.length - 2;
           
            const latLng1 = new L.LatLng(road.coordinates[index1][1], road.coordinates[index1][0]);
            const latLng2 = new L.LatLng(road.coordinates[index2][1], road.coordinates[index2][0]);

            const bearing = geoForm.Bearing(latLng1.lat, latLng1.lng, latLng2.lat, latLng2.lng);
            const [lat, long] = geoForm.WalkPosition(latLng1.lat, latLng1.lng, bearing, 5/1000);

            const latLng = new L.LatLng(lat, long);
            const trafficMarker = L.marker(latLng, {clickable: false}).addTo(map);
            trafficMarker.setOpacity(0);

            const trafficDiv = CloneTrafficLight();

            const {left, top} = trafficMarker.getElement().getBoundingClientRect();

            trafficDiv.style.top = `${top}px`;
            trafficDiv.style.left = `${left}px`;

            document.body.appendChild(trafficDiv);

            const light = new network.Light(latLng, trafficMarker, trafficDiv, road);

            junction.lights.push(light);
        }
    }

    
}

const CloneTrafficLight = () => {
    const trafficLight = document.querySelector('#traffic-light-info-clone');
    const trafficLightClone = trafficLight.cloneNode(true);
    trafficLightClone.removeAttribute('id');

    return trafficLightClone;
}

const SwapGreenPairs = junction => {
    junction.greenRoadPairIndex = (junction.greenRoadPairIndex + 1) % junction.roadPairs.length;

    const greenPairs = junction.roadPairs[junction.greenRoadPairIndex]
    const greenRoads = [];
    for(let i = 0; i < greenPairs.length; i++) {
        greenRoads.push(greenPairs[i]);
    }

    for(let i = 0; i < junction.lights.length; i++) {
        let green = false;

        for (let j = 0; j < greenRoads.length; j++) {
            if (junction.lights[i].road.identifier == greenRoads[j].identifier) {
                green = true;
            }
        }

        const colours = junction.lights[i].div.children;

        colours[0].style.backgroundColor = 'black';
        colours[1].style.backgroundColor = 'orange';
        colours[2].style.backgroundColor = green ? 'red' : 'black';

        setTimeout(() => {
            colours[0].style.backgroundColor = green ? 'green' : 'black';
            colours[1].style.backgroundColor = 'black';
            colours[2].style.backgroundColor = green ? 'black' : 'red';
        }, 3000);

        
    }
}

const RoadPairBearingMatch = (junction, roads) => {
    for(let i = 0; i < roads.length - 1; i++) {
        const bearing1 = FindRelativeRoadBearing(junction, roads[i]);
        let closestBearing = Infinity;
        let closestRoadIndex = null;
        for (let j = i + 1; j < roads.length; j++) {
            const bearing2 = FindRelativeRoadBearing(junction, roads[j]);

            if(Math.abs(bearing1 - bearing2) < closestBearing) {
                closestBearing = Math.abs(bearing1 - bearing2);
                closestRoadIndex = j;
            } 
        }

        junction.roadPairs.push([roads[i], roads[closestRoadIndex]]);
        roads.splice(closestRoadIndex, 1);
        roads.splice(i, 1);

        i--;
    }

    if (roads.length == 1) {
        junction.roadPairs.push(roads);
    }
}

const FindRelativeRoadBearing = (junction, road) => {
    const forwards = road.startJunction == junction.identifier;

    const coords = [];

    if (forwards) {
        coords.push(road.coordinates[0]);
        coords.push(road.coordinates[1]);
    }
    else {
        coords.push(road.coordinates[road.coordinates.length - 1]);
        coords.push(road.coordinates[road.coordinates.length - 2]);
    }

    let bearing = geoForm.Bearing(coords[0][1], coords[0][0], coords[1][1], coords[1][0]);

    if (bearing > 180) {
        bearing = 360 - bearing;
    }

    return bearing;
}

const UpdateAgents = graph => {
    agents.forEach((agent) => {

        agent.speed = Math.min(DesiredAgentSpeed(agent), ControlledSpeed(agent, graph), ControlledJunctionSpeed(agent, graph));

        /*
        if (agent.nextRoad != null && agent.nextRoad.func != agent.currentRoad.func) {
            agent.speed = Math.min(DesiredAgentSpeed(agent), ControlledSpeed(agent, graph), ControlledJunctionSpeed(agent, graph));
        }*/

        const [lat, long] = geoForm.WalkPosition(agent.currentLat, agent.currentLong, agent.segmentBearing, agent.speed);
        agent.currentLat = lat;
        agent.currentLong = long;
        agent.segmentDistAcc += agent.speed;

        if (agent.segmentDistAcc >= agent.segmentDist) {
            agent.segmentDistAcc -= agent.segmentDist

            let coords = agent.currentRoad.coordinates;

            agent.segmentIndex = agent.forwards ? agent.segmentIndex + 1 : agent.segmentIndex - 1;
            const nextRoad = agent.forwards ? (agent.segmentIndex + 1 >= coords.length) : agent.segmentIndex <= 0;

            if (nextRoad) {
                agent.links.splice(0, 1);

                let queue = agent.forwards ? agent.currentRoad.forwardTrafficQueue : agent.currentRoad.backwardTrafficQueue;
                queue.splice(queue.indexOf(agent), 1);

                if(agent.links.length == 0) {
                    try {
                        RemoveAgent(agents.indexOf(agent));
                    }
                    catch(error) {
                        console.log(error);
                        console.log(agent);
                    }
                    
                    return;
                }

                const currentJunction = graph.junctions[agent.forwards ? agent.currentRoad.endJunction : agent.currentRoad.startJunction];
                agent.forwards = IsForwards(agent, currentJunction, agent.nextRoad);
                agent.currentRoad = agent.nextRoad;

                coords = agent.currentRoad.coordinates;
                agent.segmentIndex = agent.forwards ? 0 : coords.length - 1;
                queue = agent.forwards ? agent.currentRoad.forwardTrafficQueue : agent.currentRoad.backwardTrafficQueue;
                queue.push(agent);

                const nextJunction = graph.junctions[agent.links[0]];

                for(let i = 0; i < nextJunction.roads.length; i++) {
                    const foundStart = nextJunction.roads[i].startJunction == agent.links[1];
                    const foundEnd = nextJunction.roads[i].endJunction == agent.links[1];
            
                    if (foundStart || foundEnd) {
                        agent.nextRoad = nextJunction.roads[i];
                        break;
                    }
                }
            }

            const index = agent.forwards ? agent.segmentIndex + 1 : agent.segmentIndex - 1;
            try {
                agent.segmentBearing = geoForm.Bearing(coords[agent.segmentIndex][1], coords[agent.segmentIndex][0], coords[index][1], coords[index][0]);
                agent.segmentDist = geoForm.Distance(coords[agent.segmentIndex][1], coords[agent.segmentIndex][0], coords[index][1], coords[index][0]);
            }
            catch(error) {
                console.log(error);
                console.log(agent);
            }
            

            const [lat, long] = geoForm.WalkPosition(coords[agent.segmentIndex][1], coords[agent.segmentIndex][0], agent.segmentBearing, agent.segmentDistAcc);
            agent.currentLat = lat;
            agent.currentLong = long;
        }

        agent.marker.setLatLng(L.latLng(agent.currentLat, agent.currentLong));
        AdjustMarkerInfoPos(agent);
    })
}