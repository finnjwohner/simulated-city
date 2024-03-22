# Simulated City: Spatial Agent Based Modelling
Heriot-Watt University 2023-2024 Dissertation, Finn Wohner

This project aims to implement a microscopic traffic simulator using spatial driver-vehicle agents to analyse and evaluate the traffic control strategies of a sub-region in Edinburgh.

## Project Details

A web-based spatial agent based modelling system for urban transport. Ideally the system will work with real world coordinates and a map base, implementing multiple agents including the environment (map, traffic lights, vehicles of different kinds including bicycles). The system's target platform is a web browser, most likely implemented through Node. Users should be allowed to edit input parameters such as traffic light sequences and congestion. 

## Build & Run

1. Clone the repo onto your local machine
2. Run `npm install` in the repo root directory
3. Run `npm run build` in the repo root directory
4. Run `npm run convertCoords` in the repo root directory
5. Run `npm run start`
6. Navigate to localhost:3000

## Next Steps (Note to self)

- Allow for queue target find to check agent's next road.