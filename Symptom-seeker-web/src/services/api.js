const API_URL = "http://127.0.0.1:8000"; // Backend address

export const sendSymptom = async (userId, symptomText) => {
    const response = await fetch(`${API_URL}/triage`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            user_id: userId,
            symptom: symptomText
        }),
    });
    return response.json();
};