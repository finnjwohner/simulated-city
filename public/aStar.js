const aStar = (graph, start, goal) => {

    const nodeKeys = Object.keys(graph.junctions);
    const distances = [];

    for(let i = 0; i < nodeKeys.length; i++) {
        distances[i] = Infinity;
    }

    distances[start] = 0;

    const visitied = [];

    while (true) {
        let lowest
    }
}