export default class Agent {
    constructor() {
        this.currentRoad = null;
        this.currentLat = null;
        this.currentLong = null;
        this.segmentIndex = 0;
        this.segmentDist = 0;
        this.segmentDistAcc = 0;
        this.segmentBearing = 0;
        this.marker = null;
        this.speed = 0;
        this.forwards = true;
        this.nextRoad = null;
    }
}