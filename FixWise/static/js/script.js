// ============================================
// DOM ELEMENTS
// ============================================

const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const statusMessage = document.getElementById('statusMessage');
const uploadSection = document.getElementById('uploadSection');
const resultsSection = document.getElementById('resultsSection');
const backBtn = document.getElementById('backBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const progressSection = document.getElementById('progressSection');

// ============================================
// FILE UPLOAD HANDLERS
// ============================================

browseBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files.length > 0) {
        uploadFile(files[0]);
    }
});

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        uploadFile(files[0]);
    }
});

uploadArea.addEventListener('click', () => {
    fileInput.click();
});

// ============================================
// UPLOAD FILE FUNCTION
// ============================================

function uploadFile(file) {
    // Validate file
    if (!file.name.endsWith('.log') && !file.name.endsWith('.txt')) {
        showStatus('error', '❌ Invalid file type. Please upload .log or .txt files only.');
        return;
    }

    if (file.size > 100 * 1024 * 1024) {
        showStatus('error', '❌ File is too large. Maximum size is 100 MB.');
        return;
    }

    showLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    fetch('/api/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        showLoading(false);
        if (data.success) {
            showStatus('success', `✅ ${data.message}`);
            setTimeout(() => {
                readFile(data.filename);
            }, 1000);
        } else {
            showStatus('error', `❌ ${data.error}`);
        }
    })
    .catch(error => {
        showLoading(false);
        console.error('Upload error:', error);
        showStatus('error', `❌ Upload failed: ${error.message}`);
    });
}

// ============================================
// READ FILE FUNCTION
// ============================================

function readFile(filename) {
    fetch(`/api/read/${filename}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayResults(data);
                displayAnalysis(data.content);
            } else {
                showStatus('error', `❌ ${data.error}`);
            }
        })
        .catch(error => {
            console.error('Read error:', error);
            showStatus('error', `❌ Failed to read file: ${error.message}`);
        });
}

// ============================================
// DISPLAY RESULTS
// ============================================

function displayResults(data) {
    document.getElementById('resultFileName').textContent = data.filename;
    document.getElementById('resultFileSize').textContent = data.file_size;
    document.getElementById('resultUploadTime').textContent = data.upload_time;
    document.getElementById('resultLineCount').textContent = data.line_count.toLocaleString();
    document.getElementById('logText').textContent = data.content;

    uploadSection.style.display = 'none';
    resultsSection.style.display = 'block';
    window.scrollTo(0, 0);
}

// ============================================
// ANALYSIS LOGIC
// ============================================

const errorPatterns = {
    database: {
        keywords: ['database', 'db', 'connection', 'sql', 'postgres', 'mysql', 'mongo'],
        rootCause: 'Database Connection Failed',
        severity: 'critical',
        confidence: 92,
        errors: [
            'Database server is unreachable or not responding',
            'Connection timeout occurred',
            'Authentication credentials are invalid'
        ],
        solutions: [
            { title: 'Verify Database Server Status', description: 'Check if database service is running and accessible' },
            { title: 'Check Network Connectivity', description: 'Ensure network connection between application and database' },
            { title: 'Validate Credentials', description: 'Verify database username and password are correct' },
            { title: 'Check Port Configuration', description: 'Ensure database is listening on configured port' }
        ]
    },
    authentication: {
        keywords: ['auth', 'token', 'jwt', 'unauthorized', 'forbidden', '401', '403'],
        rootCause: 'Authentication/Authorization Error',
        severity: 'critical',
        confidence: 88,
        errors: [
            'Invalid or expired authentication token',
            'User does not have required permissions',
            'Session has expired or become invalid'
        ],
        solutions: [
            { title: 'Refresh Authentication Token', description: 'Generate new authentication token and retry request' },
            { title: 'Verify User Permissions', description: 'Ensure user has required roles and permissions' },
            { title: 'Check Token Expiration', description: 'Validate token expiration time and refresh if needed' },
            { title: 'Review Access Control', description: 'Check access control list (ACL) and permission rules' }
        ]
    },
    timeout: {
        keywords: ['timeout', 'timed out', 'deadline', 'slow', 'latency', 'long running'],
        rootCause: 'Request Timeout',
        severity: 'warning',
        confidence: 85,
        errors: [
            'API request exceeded maximum timeout duration',
            'Long-running operation took too long to complete',
            'Database query or external service is slow'
        ],
        solutions: [
            { title: 'Optimize Query Performance', description: 'Review and optimize slow database queries with indexing' },
            { title: 'Increase Timeout Threshold', description: 'Adjust timeout configuration for long-running operations' },
            { title: 'Implement Caching', description: 'Add caching layer to reduce database load' },
            { title: 'Scale Resources', description: 'Increase server resources (CPU, memory) if bottleneck identified' }
        ]
    },
    memory: {
        keywords: ['memory', 'oom', 'out of memory', 'heap', 'allocation', 'gc overhead'],
        rootCause: 'Memory Exhaustion',
        severity: 'critical',
        confidence: 90,
        errors: [
            'Out of memory: Java heap space',
            'Memory allocation failed',
            'GC overhead limit exceeded'
        ],
        solutions: [
            { title: 'Increase Heap Size', description: 'Increase JVM heap memory allocation' },
            { title: 'Optimize Memory Usage', description: 'Review code for memory leaks and optimize data structures' },
            { title: 'Enable Memory Monitoring', description: 'Monitor memory usage in production environment' },
            { title: 'Implement Garbage Collection Tuning', description: 'Optimize GC parameters for your workload' }
        ]
    },
    error: {
        keywords: ['error', 'exception', 'failed', 'null pointer', 'segmentation', 'crash'],
        rootCause: 'Application Error',
        severity: 'critical',
        confidence: 90,
        errors: [
            'Unhandled exception in application code',
            'Null pointer or invalid reference detected',
            'Logic error in critical business function'
        ],
        solutions: [
            { title: 'Review Error Stack Trace', description: 'Examine full stack trace to identify exact error location' },
            { title: 'Check Recent Code Changes', description: 'Review recent commits that may have introduced the error' },
            { title: 'Run Unit Tests', description: 'Execute unit tests to identify broken functionality' },
            { title: 'Enable Debug Logging', description: 'Add detailed logging to trace execution flow' }
        ]
    },
    default: {
        keywords: [],
        rootCause: 'General System Issue',
        severity: 'info',
        confidence: 60,
        errors: [
            'Unable to determine specific root cause from logs',
            'Multiple potential issues identified'
        ],
        solutions: [
            { title: 'Collect More Logs', description: 'Enable verbose logging and reproduce the issue' },
            { title: 'Check System Resources', description: 'Monitor CPU, memory, disk usage during error occurrence' },
            { title: 'Review Configuration', description: 'Verify all configuration settings are correct' },
            { title: 'Consult Documentation', description: 'Review application and infrastructure documentation' }
        ]
    }
};

function analyzeLogContent(logContent) {
    const logLower = logContent.toLowerCase();
    
    let matchedPattern = errorPatterns.default;
    let maxMatches = 0;
    
    for (const [key, pattern] of Object.entries(errorPatterns)) {
        if (key === 'default') continue;
        
        const matches = pattern.keywords.filter(keyword => logLower.includes(keyword)).length;
        if (matches > maxMatches) {
            maxMatches = matches;
            matchedPattern = pattern;
        }
    }
    
    return matchedPattern;
}

function displayAnalysis(logContent) {
    const analysis = analyzeLogContent(logContent);
    
    // Update root cause
    document.getElementById('rootCauseText').textContent = analysis.rootCause;
    document.getElementById('rootCauseSeverity').textContent = analysis.severity.toUpperCase();
    document.getElementById('rootCauseSeverity').className = `severity-badge ${analysis.severity}`;
    
    // Animate confidence fill
    const confidenceFill = document.getElementById('confidenceFill');
    setTimeout(() => {
        confidenceFill.style.width = analysis.confidence + '%';
    }, 100);
    document.getElementById('confidenceValue').textContent = analysis.confidence + '%';
    
    // Update error details
    const errorDetailsHTML = analysis.errors
        .map(error => `<div class="error-item"><p><strong>Error:</strong> ${error}</p></div>`)
        .join('');
    document.getElementById('errorDetails').innerHTML = errorDetailsHTML;
    
    // Update solutions
    const solutionsHTML = analysis.solutions
        .map((solution, index) => `
            <div class="solution-item">
                <div class="solution-number">${index + 1}</div>
                <div class="solution-content">
                    <p class="solution-title">${solution.title}</p>
                    <p class="solution-description">${solution.description}</p>
                </div>
            </div>
        `)
        .join('');
    document.getElementById('solutionsList').innerHTML = solutionsHTML;
}

// ============================================
// TAB SWITCHING
// ============================================

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(tabName + '-tab').classList.add('active');
    });
});

// ============================================
// BACK BUTTON
// ============================================

backBtn.addEventListener('click', () => {
    resultsSection.style.display = 'none';
    uploadSection.style.display = 'block';
    fileInput.value = '';
    statusMessage.style.display = 'none';
    window.scrollTo(0, 0);
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

function showStatus(type, message) {
    statusMessage.className = `status-message ${type}`;
    statusMessage.innerHTML = `<i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i> ${message}`;
    statusMessage.style.display = 'flex';
    
    if (type === 'success') {
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 3000);
    }
}

function showLoading(show) {
    loadingIndicator.style.display = show ? 'block' : 'none';
    progressSection.style.display = show ? 'block' : 'none';
    statusMessage.style.display = 'none';
}