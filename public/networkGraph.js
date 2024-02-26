export class Junction {
    constructor(identifier, coordinates) {
        this.identifier = identifier;
        this.coordinates = coordinates;
        this.roads = [];
    }

    addRoad(road) {
        this.roads.push(road);
    }
}

export class Road {
    constructor(identifier, startJunction, endJunction, coordinates) {
        this.identifier = identifier;
        this.startJunction = startJunction;
        this.endJunction = endJunction;
        this.coordinates = coordinates;
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

        const road = new Road(identifier, startJunction, endJunction, coordinates);
        roadDict[identifier] = road;

        junctionDict[startJunction].addRoad(road);
        junctionDict[endJunction].addRoad(road);
    })

    return {
        junctions: junctionDict,
        roads: roadDict,
    }
}