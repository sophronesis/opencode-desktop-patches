// hey-api responses are `{ data, error, request, response }`; tests mock the `{ data }` subset.
export function unwrapData(response) {
    if (!response || typeof response !== "object")
        return response;
    if ("data" in response)
        return response.data;
    return response;
}
