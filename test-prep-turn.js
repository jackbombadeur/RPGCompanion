import fetch from 'node-fetch';

async function testPrepTurn() {
  try {
    // Create a session
    console.log('Creating session...');
    const createSessionResponse = await fetch('http://localhost:5000/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Session',
        gmId: 'test-gm-id'
      })
    });
    
    const sessionData = await createSessionResponse.json();
    console.log('Session created:', sessionData);
    
    const sessionId = sessionData.session.id;
    const gmUserId = sessionData.user.id;
    
    // Join a player
    console.log('Joining player...');
    const joinResponse = await fetch(`http://localhost:5000/api/sessions/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionCode: sessionData.session.code,
        userId: 'test-player-id',
        playerName: 'Test Player'
      })
    });
    
    const joinData = await joinResponse.json();
    console.log('Player joined:', joinData);
    
    // Create an encounter
    console.log('Creating encounter...');
    const encounterResponse = await fetch(`http://localhost:5000/api/sessions/${sessionId}/encounter`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: gmUserId,
        sentence: 'The BaSke LiPo runs quickly',
        threat: '3',
        difficulty: '2',
        length: '4',
        noun: 'BaSke',
        verb: 'LiPo',
        adjective: 'quickly'
      })
    });
    
    const encounterData = await encounterResponse.json();
    console.log('Encounter created:', encounterData);
    
    // Wait a moment for the backend to process
    console.log('Waiting for backend processing...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get session data to check prep turn status
    console.log('Getting session data...');
    const sessionResponse = await fetch(`http://localhost:5000/api/sessions/${sessionId}`);
    const finalSessionData = await sessionResponse.json();
    console.log('Final session data:', JSON.stringify(finalSessionData, null, 2));
    
    // Check if words were added to dictionary
    console.log('Getting session words...');
    const wordsResponse = await fetch(`http://localhost:5000/api/sessions/${sessionId}/words`);
    const wordsData = await wordsResponse.json();
    console.log('Session words:', wordsData);
    
    // Try to get pending words as well
    console.log('Getting pending words...');
    const pendingWordsResponse = await fetch(`http://localhost:5000/api/sessions/${sessionId}/words/pending`);
    const pendingWordsData = await pendingWordsResponse.json();
    console.log('Pending words:', pendingWordsData);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testPrepTurn(); 