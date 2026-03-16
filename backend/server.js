import express from 'express';
import cors from 'cors';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, 'serviceAccountKey.json'), 'utf8')
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const app = express();

app.use(cors());
app.use(express.json());

const OLLAMA_URL = 'http://127.0.0.1:11434/api/generate';

// Helper to generate a unique conversation ID if one isn't provided
const generateId = () => Math.random().toString(36).substring(2, 15);

// 1. Fetch all conversations for a user
app.get('/api/conversations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const conversationsRef = db.collection('users').doc(userId).collection('conversations');
    const snapshot = await conversationsRef.orderBy('updatedAt', 'desc').get();
    
    if (snapshot.empty) {
      return res.json([]);
    }

    const conversations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Fetch specific conversation history
app.get('/api/conversations/:userId/:conversationId', async (req, res) => {
  try {
    const { userId, conversationId } = req.params;
    const messagesRef = db
      .collection('users').doc(userId)
      .collection('conversations').doc(conversationId)
      .collection('messages');
      
    const snapshot = await messagesRef.orderBy('timestamp', 'asc').get();
    
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Post a new message, proxy to Ollama, and save both to Firestore
app.post('/api/chat', async (req, res) => {
  try {
    const { userId, prompt } = req.body;
    let { conversationId } = req.body;

    if (!userId || !prompt) {
      return res.status(400).json({ error: 'userId and prompt are required' });
    }

    // Create new conversation document if it's the first message
    if (!conversationId) {
      conversationId = generateId();
      await db.collection('users').doc(userId)
        .collection('conversations').doc(conversationId)
        .set({
          title: prompt.substring(0, 30) + (prompt.length > 30 ? '...' : ''),
          createdAt: new Date(),
          updatedAt: new Date()
        });
    }

    const conversationRef = db.collection('users').doc(userId).collection('conversations').doc(conversationId);
    const messagesRef = conversationRef.collection('messages');

    // 1. Save User Message
    const userMessage = {
      role: 'user',
      content: prompt,
      timestamp: new Date()
    };
    await messagesRef.add(userMessage);

    // 2. Request from Ollama
    const ollamaResponse = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.1',
        prompt: prompt,
        stream: false
      })
    });

    if (!ollamaResponse.ok) {
      throw new Error(`Ollama responded with ${ollamaResponse.status}`);
    }

    const ollamaData = await ollamaResponse.json();
    const assistantReply = ollamaData.response;

    // 3. Save Assistant Message
    const assistantMessage = {
      role: 'assistant',
      content: assistantReply,
      timestamp: new Date()
    };
    await messagesRef.add(assistantMessage);

    // Update conversation timestamp
    await conversationRef.update({ updatedAt: new Date() });

    // 4. Return to Frontend
    res.json({
      conversationId,
      message: assistantMessage
    });

  } catch (error) {
    console.error('Chat API Error:', error);
    res.status(500).json({ error: 'Failed to process chat request' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
