const API = async <T>(uri : string) : Promise<T> => {
    const response : Response = await fetch(uri);

    if (!response.ok) {
        throw new Error(response.statusText);
    }
    
    return response.json() as Promise<T>;
}

export default API;