// src/App.js
import React, { useState } from 'react';
import { sendSymptom } from './services/api';

function App() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");

  const handleSubmit = async () => {
    const data = await sendSymptom("user_1", input);
    setResult(data.recommendation);
  };

  return (
    <div className="App">
      <h1>Symptom Seeker</h1>
      <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Describe symptoms..." />
      <button onClick={handleSubmit}>Get Advice</button>
      {result && <p>Recommendation: {result}</p>}
    </div>
  );
}

export default App;