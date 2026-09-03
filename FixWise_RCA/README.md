# FixWise — AI-Powered Log Root Cause Analyzer

FixWise is a web application that analyzes application and infrastructure logs using OpenAI-compatible GPT Luna model. It identifies the likely root cause, explains the supporting evidence, estimates confidence, and recommends prioritized remediation steps.

## Key capabilities

- Upload `.log` and `.txt` files
- Validate file type, size, and empty uploads
- Display log metadata and the uploaded content
- Send log content to Baxter AIHub GPT Luna from the server
- Return structured analysis containing:
  - Root cause
  - Incident summary
  - Severity
  - Overall confidence score
  - Evidence found in the log
  - Recommended solutions
  - Confidence per solution
  - Verification steps
  - Prevention recommendations
- Handle large logs by limiting the number of characters sent to the model
- Keep the Baxter API key out of browser code
- Provide useful error responses when the model gateway is unavailable or returns invalid output

## Architecture

```text
Browser
  |
  | Upload log
  v
Flask application (app.py)
  |
  | Save and validate file
  | Read uploaded log
  v
POST /api/analyze/<filename>
  |
  | OpenAI-compatible JSON request
  | Authorization: Bearer API_KEY
  v
Baxter AIHub GPT Luna
  |
  | Structured JSON analysis
  v
Flask application
  |
  | Sanitize and return analysis
  v
Browser UI (static/js/script.js)
```

## Project structure

```text
FixWise/
├── app.py                    # Active Flask backend and Luna integration
├── requirements.txt           # Python dependencies
├── .env                       # Local configuration and secrets; never commit
├── templates/
│   └── index.html             # Main server-rendered page
├── static/
│   ├── js/
│   │   └── script.js          # Upload flow and dynamic result rendering
│   └── css/
│       └── style.css          # Application styling
├── uploads/                   # Uploaded log files; treat as runtime data
└── app/
    └── main.py                # Legacy FastAPI/Anthropic implementation
```

The active application is the Flask path: `app.py`, `templates/index.html`, and `static/js/script.js`. The React components and `app/main.py` are separate legacy code and are not required for the current Flask workflow.

## Prerequisites

- Python 3.10 or later recommended
- A valid API key
- The exact model name available to your team, currently configured as `gpt-5.6-luna`

## Installation

Create and activate a virtual environment:

Windows PowerShell:

```powershell
py -3 -m venv .venv
.venv\Scripts\Activate.ps1
```

Install dependencies:

```powershell
pip install -r requirements.txt
```

## Configuration

The application loads environment variables from `.env` in the project root. Use the following configuration pattern and replace the API key with your private key:

```dotenv
USE_GATEWAY=true
API_KEY=replace_with_your_private_api_key
LUNA_MODEL=gpt-5.6-luna
BASE_URL=enter the base url (optional)
FLASK_PORT=5000
FLASK_ENV=development
LOG_LEVEL=INFO
```

`provider: openai` is not required by the application. If it is retained in `.env`, it is not used. Standard dotenv syntax would be `PROVIDER=openai`.

## Running the application

Start the Flask server:

```powershell
py -3 app.py
```

Open the application at:

```text
http://127.0.0.1:5000
```

The startup port is controlled by `FLASK_PORT`.

## End-to-end request flow

1. The user selects or drops a `.log` or `.txt` file.
2. The browser validates the extension and the 100 MB maximum size.
3. `POST /api/upload` stores the file in `uploads/` using a sanitized filename.
4. The browser calls `GET /api/read/<filename>` to display file details and log content.
5. The browser calls `POST /api/analyze/<filename>`.
6. The backend reads a bounded amount of the stored log.
7. The backend sends a request to Baxter AIHub using the configured model and API key.
8. The model is instructed to return JSON only, using a defined analysis schema.
9. The backend parses and validates the returned JSON and clamps confidence values to `0-100`.
10. The browser renders the root cause, severity, confidence, evidence, and solutions.

## API endpoints

### `GET /`

Returns the main FixWise web page.

### `POST /api/upload`

Accepts a multipart form upload with the field name `file`.

Supported extensions:

- `.log`
- `.txt`

Maximum file size: `100 MB`.

### `GET /api/read/<filename>`

Returns the uploaded file content and metadata, including:

- Filename
- File size
- Upload time
- Total line count
- Display content
- Truncation information

### `POST /api/analyze/<filename>`

Sends the stored log to GPT Luna and returns an analysis response similar to:

```json
{
  "success": true,
  "analysis": {
    "root_cause": "...",
    "summary": "...",
    "severity": "high",
    "confidence": 87,
    "evidence": ["..."],
    "solutions": [
      {
        "title": "...",
        "description": "...",
        "confidence": 82,
        "verification": "..."
      }
    ],
    "prevention": ["..."]
  }
}
```

## Model prompt and structured output

The backend uses a low temperature to make the response more consistent and asks the model to:

- Base conclusions on evidence in the log
- Avoid inventing facts
- Express uncertainty when evidence is incomplete
- Return three to five prioritized solutions
- Provide confidence values from 0 to 100
- Include verification steps for proposed fixes

The backend accepts strict JSON and also handles JSON returned inside a Markdown code fence. Invalid model output is rejected rather than displayed as if it were trustworthy.

## Error handling

The backend returns appropriate errors for common failure scenarios:

- `400` — invalid upload or empty file
- `404` — uploaded file not found
- `502` — Baxter gateway failure or invalid model response
- `503` — missing Baxter API key
- `500` — unexpected server-side failure

Detailed failures are logged server-side, while browser responses avoid exposing credentials or internal request details.

## Security considerations

Current protections include:

- Filename sanitization using `secure_filename`
- Extension validation
- Maximum request size
- Path traversal checks
- API key kept on the backend
- Escaping of model-generated text before inserting it into HTML
- Bounded log content sent to the model

Recommended production improvements:

- Add authentication and authorization
- Store sessions and uploaded files outside process memory
- Use object storage with lifecycle deletion
- Add rate limiting and request quotas
- Delete uploaded logs after a defined retention period
- Add antivirus/content scanning if logs come from untrusted users
- Use HTTPS
- Disable Flask debug mode
- Add audit logging without storing sensitive log contents
- Consider redacting passwords, tokens, authorization headers, and personal data before model submission

### Design decisions

- **Backend model call:** Prevents API-key exposure and centralizes gateway configuration.
- **Structured JSON response:** Makes model output reliable and easy to render in the UI.
- **Evidence and confidence:** Helps users understand why a conclusion was reached and how certain it is.
- **Bounded log input:** Controls cost, latency, and model context usage.
- **Model-generated solutions:** Removes dependency on hardcoded keyword-to-solution mappings.
- **Verification steps:** Encourages safe operational changes instead of blindly applying recommendations.

## Future enhancements

- Streaming model responses
- Background jobs for very large logs
- Multi-file and time-window correlation
- Log redaction and PII detection
- Persistent incident history
- Feedback loops for solution quality
- Automated evidence highlighting in the displayed log
- Role-based access control
- Automated tests with a mocked Baxter gateway
- Observability metrics for latency, failures, token usage, and confidence distribution
