from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import anthropic
import os
from dotenv import load_dotenv
from datetime import datetime
import json
import logging
from typing import Dict
import uuid

load_dotenv()

# ===== Logging Setup =====
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ===== FastAPI Setup =====
app = FastAPI(
    title="Log Analyzer API",
    description="AI-powered log analysis API",
    version="1.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== Configuration =====
# Support both Baxter AIHub Gateway and Anthropic
USE_BAXTER_GATEWAY = os.getenv("USE_BAXTER_GATEWAY", "true").lower() == "true"

if USE_BAXTER_GATEWAY:
    BAXTER_API_KEY = os.getenv("BAXTER_API_KEY")
    BAXTER_BASE_URL = os.getenv("BAXTER_BASE_URL", "https://aihub-test-llm-gateway.aws.baxter.com/v1")
    
    if not BAXTER_API_KEY:
        raise ValueError("BAXTER_API_KEY not found in environment variables")
    
    logger.info(f"Using Baxter AIHub Gateway: {BAXTER_BASE_URL}")
    
    # Configure Anthropic client to use Baxter gateway
    client = anthropic.Anthropic(
        api_key=BAXTER_API_KEY,
        base_url=BAXTER_BASE_URL
    )
else:
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
    if not ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY not found in environment variables")
    
    logger.info("Using Anthropic public API")
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

# Store conversation history
conversations: Dict = {}

# ===== Helper Functions =====
def validate_file(filename: str, file_size: int) -> tuple:
    """Validate uploaded file"""
    allowed_extensions = ['log', 'txt']
    max_size = 104857600  # 100MB
    
    if file_size > max_size:
        return False, f"File size exceeds {max_size / 1024 / 1024}MB limit"
    
    file_extension = filename.split('.')[-1].lower()
    if file_extension not in allowed_extensions:
        return False, f"File type .{file_extension} not allowed. Use {', '.join(allowed_extensions)}"
    
    return True, ""

def truncate_log(content: str, max_chars: int = 3000) -> str:
    """Truncate log content for API calls"""
    if len(content) > max_chars:
        return content[:max_chars] + f"\n\n... [Log truncated - {len(content) - max_chars} more characters]"
    return content

# ===== API Routes =====

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    logger.info("Health check requested")
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "service": "Log Analyzer API"
    }

@app.post("/api/analyze-log")
async def analyze_log(file: UploadFile = File(...)):
    """Analyzes uploaded log file with Claude Haiku"""
    try:
        logger.info(f"Received log file: {file.filename}")
        
        # Read file content
        content = await file.read()
        file_size = len(content)
        
        # Validate file
        is_valid, error_msg = validate_file(file.filename, file_size)
        if not is_valid:
            logger.warning(f"File validation failed: {error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)
        
        # Decode content
        try:
            log_content = content.decode('utf-8')
        except UnicodeDecodeError:
            log_content = content.decode('utf-8', errors='ignore')
        
        logger.info(f"File decoded successfully. Size: {len(log_content)} characters")
        
        # Call Claude Haiku for analysis
        truncated_log = truncate_log(log_content)
        logger.info("Calling Claude Haiku for analysis")
        analysis_response = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=2048,
            messages=[
                {
                    "role": "user",
                    "content": f"""Analyze this log file and provide a detailed report:

1. **Root Cause**: What is causing the error(s)?
2. **Error Summary**: Brief description of what went wrong
3. **Severity**: Low/Medium/High/Critical
4. **Affected Components**: Which parts of the system are affected?
5. **Possible Solutions**: List 3-5 actionable steps to fix the issue
6. **Prevention**: How to prevent this in the future

Format your response clearly with headers and bullet points.

LOG FILE CONTENT:
{truncated_log}"""
                }
            ]
        )
        
        analysis_text = analysis_response.content[0].text
        logger.info("Analysis completed successfully")
        
        # Create conversation session
        session_id = str(uuid.uuid4())
        conversations[session_id] = {
            "history": [
                {
                    "role": "user",
                    "content": f"Analyze this log:\n{truncated_log}"
                },
                {
                    "role": "assistant",
                    "content": analysis_text
                }
            ],
            "log_content": log_content,
            "filename": file.filename,
            "file_size": file_size,
            "created_at": datetime.now().isoformat(),
            "messages_count": 0
        }
        
        logger.info(f"Session created: {session_id}")
        
        return {
            "status": "success",
            "session_id": session_id,
            "analysis": analysis_text,
            "filename": file.filename,
            "file_size": file_size,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing log: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error analyzing log: {str(e)}")

@app.post("/api/chat/{session_id}")
async def chat_with_claude(session_id: str, message_data: dict):
    """Continues chat with Claude for the specific log analysis session"""
    try:
        logger.info(f"Chat request for session: {session_id}")
        
        if session_id not in conversations:
            logger.warning(f"Session not found: {session_id}")
            raise HTTPException(status_code=404, detail="Session not found")
        
        user_message = message_data.get("message", "").strip()
        if not user_message:
            raise HTTPException(status_code=400, detail="Message cannot be empty")
        
        if len(user_message) > 5000:
            raise HTTPException(status_code=400, detail="Message too long (max 5000 characters)")
        
        session = conversations[session_id]
        
        # Check message limit per session
        if session["messages_count"] > 100:
            logger.warning(f"Message limit exceeded for session: {session_id}")
            raise HTTPException(status_code=429, detail="Message limit exceeded for this session")
        
        # Add user message to history
        session["history"].append({
            "role": "user",
            "content": user_message
        })
        
        logger.info(f"Processing message #{session['messages_count'] + 1} for session {session_id}")
        
        # Get response from Claude
        response = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=2048,
            system=f"""You are a professional technical support assistant helping to debug and fix logs.
            
The user is working with this log file: {session['filename']}

Provide clear, actionable solutions. Be concise but comprehensive. Use formatting like:
- **Bold** for important points
- Bullet points for lists
- Code blocks for commands

Always:
1. Understand the context from the log
2. Provide specific, tested solutions
3. Explain WHY you recommend each solution
4. Ask clarifying questions if needed""",
            messages=session["history"]
        )
        
        assistant_message = response.content[0].text
        
        # Add assistant response to history
        session["history"].append({
            "role": "assistant",
            "content": assistant_message
        })
        
        session["messages_count"] += 1
        
        logger.info(f"Response generated. Total messages: {session['messages_count']}")
        
        return {
            "status": "success",
            "message": assistant_message,
            "session_id": session_id,
            "message_count": session["messages_count"],
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing message: {str(e)}")

@app.get("/api/conversation/{session_id}")
async def get_conversation(session_id: str):
    """Retrieves full conversation history for a session"""
    try:
        logger.info(f"Retrieving conversation: {session_id}")
        
        if session_id not in conversations:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session = conversations[session_id]
        
        return {
            "session_id": session_id,
            "filename": session["filename"],
            "created_at": session["created_at"],
            "message_count": session["messages_count"],
            "history": session["history"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving conversation: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error retrieving conversation: {str(e)}")

@app.delete("/api/session/{session_id}")
async def delete_session(session_id: str):
    """Delete a session to free up memory"""
    try:
        logger.info(f"Deleting session: {session_id}")
        
        if session_id not in conversations:
            raise HTTPException(status_code=404, detail="Session not found")
        
        del conversations[session_id]
        
        logger.info(f"Session deleted: {session_id}")
        
        return {
            "status": "success",
            "message": "Session deleted successfully",
            "session_id": session_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting session: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error deleting session: {str(e)}")

@app.get("/api/sessions/active")
async def get_active_sessions():
    """Get count of active sessions"""
    logger.info("Getting active sessions count")
    return {
        "status": "success",
        "active_sessions": len(conversations),
        "sessions": list(conversations.keys())
    }