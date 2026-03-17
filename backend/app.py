import json
from flask import Flask, request, jsonify, Response, send_file  # pyre-ignore[21]
from flask_cors import CORS  # pyre-ignore[21]
import uuid
import datetime
import os

# LiveKit — optional; token endpoint returns error if unavailable
try:
    from livekit import api as livekit_api  # pyre-ignore[21]
    _LIVEKIT_OK = True
except Exception as _lk_err:
    print(f"[App] LiveKit not available: {_lk_err}")
    livekit_api = None
    _LIVEKIT_OK = False

# Import modular backend files
from firebase_admin import firestore # pyre-ignore[21]
from firebase import db # pyre-ignore[21]
from nlp import process_query # pyre-ignore[21]
from ragmodel import ingest_document, retrieve_context # pyre-ignore[21]
from xtts_engine import generate_voice # pyre-ignore[21]

# Import llama reasoning engine
from llama_reasoner import generate_response # pyre-ignore[21]




app = Flask(__name__)
CORS(app)

def generate_id():
    return str(uuid.uuid4())

# 1. Fetch all conversations for a user
@app.route('/api/conversations/<user_id>', methods=['GET'])
def get_conversations(user_id):
    try:
        conversations_ref = db.collection('users').document(user_id).collection('conversations')
        # Order by updatedAt descending
        docs = conversations_ref.order_by('updatedAt', direction=firestore.Query.DESCENDING).stream()
        
        conversations = []
        for doc in docs:
            data = doc.to_dict()
            data['id'] = doc.id
            conversations.append(data)
            
        return jsonify(conversations), 200
    except Exception as e:
        print(f"Error fetching conversations: {e}")
        return jsonify({'error': str(e)}), 500

# 2. Fetch specific conversation history
@app.route('/api/conversations/<user_id>/<conversation_id>', methods=['GET'])
def get_messages(user_id, conversation_id):
    try:
        messages_ref = db.collection('users').document(user_id) \
                         .collection('conversations').document(conversation_id) \
                         .collection('messages')
                         
        # Order by timestamp ascending
        docs = messages_ref.order_by('timestamp', direction=firestore.Query.ASCENDING).stream()
        
        messages = []
        for doc in docs:
            data = doc.to_dict()
            data['id'] = doc.id
            messages.append(data)
            
        return jsonify(messages), 200
    except Exception as e:
        print(f"Error fetching messages: {e}")
        return jsonify({'error': str(e)}), 500

# 3. Post a new message, proxy to Ollama, and save both to Firestore
@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        if request.content_type and 'multipart/form-data' in request.content_type:
            user_id = request.form.get('userId')
            prompt = request.form.get('prompt', '')
            conversation_id = request.form.get('conversationId')
            attached_file = request.files.get('file')
            
            if attached_file:
                prompt += f"\n\n[USER ATTACHED FILE: {attached_file.filename}] (Note: Backend processing for {attached_file.filename} is partially ready)"
        else:
            data = request.json or {}
            user_id = data.get('userId')
            prompt = data.get('prompt', '')
            conversation_id = data.get('conversationId')

        if not user_id or not prompt:
            return jsonify({'error': 'userId and prompt are required'}), 400

        # Create new conversation document if it's the first message
        if not conversation_id:
            conversation_id = generate_id()
            title = prompt[:30] + ('...' if len(prompt) > 30 else '')
            db.collection('users').document(user_id) \
              .collection('conversations').document(conversation_id) \
              .set({
                  'title': title,
                  'createdAt': firestore.SERVER_TIMESTAMP,
                  'updatedAt': firestore.SERVER_TIMESTAMP
              })
              
        conversation_ref = db.collection('users').document(user_id).collection('conversations').document(conversation_id)
        messages_ref = conversation_ref.collection('messages')

        # 1. Save User Message
        user_message = {
            'role': 'user',
            'content': prompt,
            'timestamp': firestore.SERVER_TIMESTAMP
        }
        messages_ref.add(user_message)

        def stream_response():
            # Send initial payload to give frontend the conversationId
            yield f"data: {json.dumps({'type': 'init', 'conversationId': conversation_id})}\n\n"
            
            # --- MODULAR RAG PIPELINE ---
            try:
                # 1. NLP Processing
                nlp_info = process_query(prompt)
                
                # 2. Context Retrieval (RAG)
                context = retrieve_context(prompt)
                
                # 3. Llama3.2 Reasoning Engine (Streaming)
                assistant_reply = ""
                for chunk in generate_response(prompt, context, nlp_info):
                    assistant_reply += chunk
                    yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
                            
            except Exception as e:
                print(f"Error in modular RAG pipeline: {e}")
                error_msg = f"Error: Failed to process query through Legal AI pipeline. {str(e)}"
                assistant_reply = "\n" + error_msg
                yield f"data: {json.dumps({'type': 'error', 'content': error_msg})}\n\n"

            # 3. Save Assistant Message
            assistant_message = {
                'role': 'assistant',
                'content': assistant_reply,
                'timestamp': firestore.SERVER_TIMESTAMP
            }
            messages_ref.add(assistant_message)
            
            # --- VOICE GENERATION ---
            # Now that the message is saved and text is streamed, generate the audio
            if '[USER ATTACHED FILE:' not in prompt: # Skip voice for big document context processing just to save time
                try:
                    audio_filename = f"resp_{conversation_id}_{int(datetime.datetime.now().timestamp())}.wav"
                    audio_path = generate_voice(text=assistant_reply, filename=audio_filename)
                    if audio_path:
                        yield f"data: {json.dumps({'type': 'voice', 'audio_url': f'/api/audio/{audio_filename}'})}\n\n"
                except Exception as e:
                    print(f"Voice Generation Error: {e}")
            
            # Update conversation timestamp
            conversation_ref.update({'updatedAt': firestore.SERVER_TIMESTAMP})

            # Signal end of stream
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        return Response(stream_response(), mimetype='text/event-stream')

    except Exception as e:
        print(f"Chat API Error: {e}")
        return jsonify({'error': 'Failed to process chat request', 'details': str(e)}), 500

# 4. Rename a conversation
@app.route('/api/conversations/<user_id>/<conversation_id>', methods=['PUT'])
def rename_conversation(user_id, conversation_id):
    try:
        data = request.json
        new_title = data.get('title')
        if not new_title:
            return jsonify({'error': 'Title is required'}), 400
            
        conversation_ref = db.collection('users').document(user_id).collection('conversations').document(conversation_id)
        conversation_ref.update({'title': new_title, 'updatedAt': firestore.SERVER_TIMESTAMP})
        
        return jsonify({'id': conversation_id, 'title': new_title}), 200
    except Exception as e:
        print(f"Error renaming conversation: {e}")
        return jsonify({'error': str(e)}), 500

# 5. Delete specific conversation
@app.route('/api/conversations/<user_id>/<conversation_id>', methods=['DELETE'])
def delete_conversation(user_id, conversation_id):
    try:
        conversation_ref = db.collection('users').document(user_id).collection('conversations').document(conversation_id)
        # Delete messages subcollection
        messages_ref = conversation_ref.collection('messages')
        for msg in messages_ref.stream():
            msg.reference.delete()
        # Delete the conversation document
        conversation_ref.delete()
        
        return jsonify({'success': True}), 200
    except Exception as e:
        print(f"Error deleting conversation: {e}")
        return jsonify({'error': str(e)}), 500

# 6. Delete all conversations for a user
@app.route('/api/conversations/<user_id>', methods=['DELETE'])
def delete_all_conversations(user_id):
    try:
        conversations_ref = db.collection('users').document(user_id).collection('conversations')
        for conv in conversations_ref.stream():
            # Delete messages subcollection
            messages_ref = conv.reference.collection('messages')
            for msg in messages_ref.stream():
                msg.reference.delete()
            # Delete the conversation document
            conv.reference.delete()
            
        return jsonify({'success': True}), 200
    except Exception as e:
        print(f"Error deleting all conversations: {e}")
        return jsonify({'error': str(e)}), 500

# 7. Generate LiveKit Access Token
@app.route('/api/livekit-token', methods=['GET'])
def get_livekit_token():
    if not _LIVEKIT_OK or livekit_api is None:
        return jsonify({'error': 'LiveKit not configured on this server'}), 503
    try:
        user_id = request.args.get('userId', 'anonymous_user')
        room_name = request.args.get('room', 'legal-assistant-room')

        api_key = os.environ.get('LIVEKIT_API_KEY', 'APInCF42PrCnsua')
        api_secret = os.environ.get('LIVEKIT_API_SECRET', 'HpeZXGWI4I8ICPeX7Kvs4bT5jOLQ0N5UMlB2aILWe3LA')

        assert livekit_api is not None  # guarded by _LIVEKIT_OK check above
        token = livekit_api.AccessToken(api_key, api_secret) \
            .with_identity(user_id) \
            .with_name(user_id) \
            .with_grants(livekit_api.VideoGrants(
                room_join=True,
                room=room_name
            ))
        return jsonify({'token': token.to_jwt()}), 200
    except Exception as e:
        print(f"Error generating LiveKit token: {e}")
        return jsonify({'error': str(e)}), 500

# 8. Serve Generated Audio Files
@app.route('/api/audio/<filename>', methods=['GET'])
def get_audio(filename):
    try:
        audio_dir = os.path.join(os.path.dirname(__file__), "audio_outputs")
        file_path = os.path.join(audio_dir, filename)
        if not os.path.exists(file_path):
            return jsonify({'error': 'Audio file not found'}), 404
        return send_file(file_path, mimetype="audio/wav")
    except Exception as e:
        print(f"Error serving audio: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("Starting Flask Backend on http://localhost:5000")
    app.run(port=5000, debug=True, use_reloader=False)
