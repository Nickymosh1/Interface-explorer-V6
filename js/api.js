// Fetches the main data file and returns the parsed JSON.
export async function fetchData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Could not load interface data:", error);
        // You can enhance this to show a more user-friendly error in the UI
        return null;
    }
}
