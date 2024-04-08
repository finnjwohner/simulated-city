const express = require('express');
const app = express();
const port = 3000;
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const corsOptions = {
    origin: 'https://www.edinburghtrafficsim.com',
    optionsSuccessStatus: 200
}

const roadLinkPath = path.join(__dirname, './geoJson/roadLinkLatLong.json');
const roadNodePath = path.join(__dirname, './geoJson/roadNodeLatLong.json');

const roadLinkJson = JSON.parse(fs.readFileSync(roadLinkPath).toString());
const roadNodeJson = JSON.parse(fs.readFileSync(roadNodePath).toString());

app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
})

app.get('/geoJson', cors(corsOptions), (req, res) => {
    res.json({
        roadLink: roadLinkJson,
        roadNode: roadNodeJson,
    })
})

app.listen(port, () => {
    console.log('Listening');
})