const visitorCount = document.getElementById("visitor-count");

const API_URL = "https://e511f1fzl6.execute-api.eu-north-1.amazonaws.com/prod/count";

async function loadVisitorCount() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        visitorCount.textContent = data.visitorCount;
    } catch (error) {
        console.error(error);
        visitorCount.textContent = "Error";
    }
}

loadVisitorCount();