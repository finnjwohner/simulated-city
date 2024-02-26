import LatLong from "./latLong";
import API from './api';
import * as geoJson from 'geojson';
import * as path from 'path';
import * as fs from 'fs';


// Converts British National Grid (BNG) coordinate into a latitude
// and longitude coordinate (lat/long) using an API provided by
// the British Geological Survey
const BNGToLatlong = async (bngEasting : number, bngNorthing : number) : Promise<LatLong> => {
    const uri : string = `http://webapps.bgs.ac.uk/data/webservices/CoordConvert_LL_BNG.cfc?method=BNGtoLatLng&easting=${bngEasting}&northing=${bngNorthing}`;
    
    try {
        const latLong : LatLong = await API<LatLong>(uri);
        return latLong;
    }
    catch(error : any) {
        console.error(error);
        return null;
    }
    
}

// Converts a GeoJson's Feature's coordinates from BNG to Lat/Long.
// Does not work with MultiLineString, Polygon, MultiPolygon or GeometryCollection
// feature types.
const ConvertFeatureToLatLong = async (feature : geoJson.Feature) => {
    if (feature.geometry.type == 'Point') {
        const coords : geoJson.Position = (feature.geometry as geoJson.Point).coordinates;
        const latLong : LatLong = await BNGToLatlong(coords[0], coords[1]);
        (feature.geometry as geoJson.Point).coordinates[0] = latLong.LONGITUDE;
        (feature.geometry as geoJson.Point).coordinates[1] = latLong.LATITUDE;

        return;
    }

    else if (['MultiPoint', 'LineString'].includes(feature.geometry.type)) {
        const coords : geoJson.Position[] = (feature.geometry as geoJson.LineString).coordinates;
        
        for (let i = 0; i < coords.length; i++) {
            const latLong : LatLong = await BNGToLatlong(coords[i][0], coords[i][1]);
            (feature.geometry as geoJson.LineString).coordinates[i][0] = latLong.LONGITUDE;
            (feature.geometry as geoJson.LineString).coordinates[i][1] = latLong.LATITUDE;
        }
        return;
    }
}

const ConvertFeatureCollection = async (filepath : string, outputFilepath : string) => {
    const data : Buffer = fs.readFileSync(filepath);
    const featureCollection : GeoJSON.FeatureCollection = JSON.parse(data.toString()) as geoJson.FeatureCollection;
    
    console.log(`Converting BNG Coordinates to Lat/Long in FeatureCollection at > ${filepath}`);
    
    for(let i = 0; i < featureCollection.features.length; i++) {
        await ConvertFeatureToLatLong(featureCollection.features[i]);
    }

    fs.writeFileSync(outputFilepath, JSON.stringify(featureCollection, null, 4), 'utf8');

    console.log(`Finished Converting BNG Coordinates to Lat/Long in FeatureCollection at > ${filepath}`);
}

const roadLinkBNGPath = path.join(__dirname, '../geoJson/roadLinkBNG.json');
const roadLinkOutput = path.join(__dirname, '../geoJson/roadLinkLatLong.json');

const roadNodeBNGPath = path.join(__dirname, '../geoJson/roadNodeBNG.json');
const roadNodeOutput = path.join(__dirname, '../geoJson/roadNodeLatLong.json');

ConvertFeatureCollection(roadLinkBNGPath, roadLinkOutput);
ConvertFeatureCollection(roadNodeBNGPath, roadNodeOutput);