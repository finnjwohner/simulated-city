// geo formulas aquired from https://www.movable-type.co.uk/scripts/latlong.html

// Given a start and end point, calculate the bearing from the start point to the end point.
export const Bearing = (lat1, long1, lat2, long2) => {
    lat1 *= Math.PI/180;
    lat2 *= Math.PI/180;

    const longDiff = (long2 - long1) * Math.PI/180;

    const y = Math.sin(longDiff) * Math.cos(lat2);
    const x = Math.cos(lat1)*Math.sin(lat2) - Math.sin(lat1)*Math.cos(lat2)*Math.cos(longDiff);
    const theta = Math.atan2(y, x);
    return (theta*180/Math.PI + 360) % 360; // in degrees
}

// Given a point, a bearing, and distance in km, get the new location
export const WalkPosition = (lat1, long1, brng, dst) => {
    const R = 6371;

    lat1 *= Math.PI/180;
    long1 *= Math.PI/180;
    brng *= Math.PI/180;

    let lat2 = Math.asin( Math.sin(lat1)*Math.cos(dst/R) + Math.cos(lat1)*Math.sin(dst/R)*Math.cos(brng) );

    let long2 = long1 + Math.atan2(Math.sin(brng)*Math.sin(dst/R)*Math.cos(lat1),
        Math.cos(dst/R)-Math.sin(lat1)*Math.sin(lat2));

    lat2 *= (180/Math.PI);
    long2 *= (180/Math.PI);

    return [lat2, long2];
}

// Calculate the distance between two points in metres (0.3% error)
export const Distance = (lat1, long1, lat2, long2) => {
    const R = 6371; // metres
    const lat1Radians = lat1 * Math.PI/180; // φ, λ in radians
    const lat2Radians = lat2 * Math.PI/180;
    const latDiff = (lat2-lat1) * Math.PI/180;
    const longDiff = (long2-long1) * Math.PI/180;

    const a = Math.sin(latDiff/2) * Math.sin(latDiff/2) +
            Math.cos(lat1Radians) * Math.cos(lat2Radians) *
            Math.sin(longDiff/2) * Math.sin(longDiff/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in km
}