export class Junction {
    constructor(identifier, coordinates) {
        this.identifier = identifier;
        this.coordinates = coordinates;
        this.roads = [];
        this.greenlitRoads = [];
        this.roadPairs = [];
    }

    addRoad(road) {
        this.roads.push(road);
    }
}

export class Road {
    constructor(identifier, startJunction, endJunction, coordinates, func, roadName) {
        this.identifier = identifier;
        this.roadName = roadName;
        this.startJunction = startJunction;
        this.endJunction = endJunction;
        this.coordinates = coordinates;
        this.forwardTrafficQueue = [];
        this.backwardTrafficQueue = [];
        this.func = func;
    }
}

export const createGraph = (roadLinks, roadNodes) => {
    const junctionDict = {};
    const roadDict = {};

    roadNodes.features.forEach((feature) => {
        const identifier = feature.properties.identifier;
        const coordinates = feature.geometry.coordinates;

        const junction = new Junction(identifier, coordinates);
        junctionDict[identifier] = junction;
    })

    roadLinks.features.forEach((feature) => {
        const identifier = feature.properties.identifier;
        const startJunction = feature.properties.startNode;
        const endJunction = feature.properties.endNode;
        const coordinates = feature.geometry.coordinates;
        const func = feature.properties.function;
        const roadName = feature.properties.name1;

        const road = new Road(identifier, startJunction, endJunction, coordinates, func, roadName);
        roadDict[identifier] = road;

        junctionDict[startJunction].addRoad(road);
        junctionDict[endJunction].addRoad(road);
    })

    return {
        junctions: junctionDict,
        roads: roadDict,
    }
}