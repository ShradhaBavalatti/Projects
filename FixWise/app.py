from flask import Flask, render_template, request, jsonify
import os
from datetime import datetime
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Configuration
UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
ALLOWED_EXTENSIONS = {'log', 'txt'}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
MAX_LINES_TO_DISPLAY = 5000  # Limit lines displayed

# Create uploads folder if it doesn't exist
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

def allowed_file(filename):
    """Check if file has allowed extension"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_file_size_display(size_bytes):
    """Convert bytes to human readable format"""
    for unit in ['B', 'KB', 'MB']:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} GB"

def handle_duplicate_filename(filename):
    """Handle duplicate filenames by adding counter"""
    base_path = os.path.join(UPLOAD_FOLDER, filename)
    
    if not os.path.exists(base_path):
        return filename
    
    name, ext = os.path.splitext(filename)
    counter = 1
    
    while True:
        new_filename = f"{name}_{counter}{ext}"
        new_path = os.path.join(UPLOAD_FOLDER, new_filename)
        if not os.path.exists(new_path):
            return new_filename
        counter += 1

@app.route('/')
def index():
    """Render main page"""
    print("Serving index.html")
    return render_template('index.html')

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Handle file upload - optimized"""
    try:
        # Check if file is present
        if 'file' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No file provided. Please select a file.'
            }), 400
        
        file = request.files['file']
        
        # Check if filename is not empty
        if file.filename == '':
            return jsonify({
                'success': False,
                'error': 'No file selected.'
            }), 400
        
        # Validate file extension
        if not allowed_file(file.filename):
            return jsonify({
                'success': False,
                'error': 'Invalid file type. Only .log and .txt files are allowed.'
            }), 400
        
        # Check file size before saving
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size == 0:
            return jsonify({
                'success': False,
                'error': 'File is empty. Please upload a file with content.'
            }), 400
        
        if file_size > MAX_FILE_SIZE:
            return jsonify({
                'success': False,
                'error': f'File size exceeds {get_file_size_display(MAX_FILE_SIZE)} limit.'
            }), 400
        
        # Save file
        original_filename = secure_filename(file.filename)
        filename = handle_duplicate_filename(original_filename)
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        
        file.save(filepath)
        
        # Get upload time
        upload_time = datetime.now()
        
        print(f"✅ File uploaded successfully: {filename}")
        
        return jsonify({
            'success': True,
            'filename': filename,
            'original_filename': original_filename,
            'file_size': get_file_size_display(file_size),
            'upload_time': upload_time.strftime('%d-%b-%Y %I:%M %p'),
            'message': 'File uploaded successfully!'
        }), 200
    
    except Exception as e:
        print(f"❌ Upload error: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Upload failed: {str(e)}'
        }), 500

@app.route('/api/read/<filename>', methods=['GET'])
def read_file(filename):
    """Read and return file contents - optimized for large files"""
    try:
        # Secure the filename
        filename = secure_filename(filename)
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        
        # Check if file exists
        if not os.path.exists(filepath):
            return jsonify({
                'success': False,
                'error': 'File not found.'
            }), 404
        
        # Security check - prevent directory traversal
        if not os.path.abspath(filepath).startswith(os.path.abspath(UPLOAD_FOLDER)):
            return jsonify({
                'success': False,
                'error': 'Invalid file path.'
            }), 403
        
        # Get file statistics before reading
        file_stat = os.stat(filepath)
        file_size = file_stat.st_size
        upload_time = datetime.fromtimestamp(file_stat.st_mtime)
        
        # Read file content efficiently
        try:
            with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
                lines = f.readlines()
            
            total_lines = len(lines)
            
            # Check if file is empty
            if total_lines == 0:
                return jsonify({
                    'success': False,
                    'error': 'File is empty.'
                }), 400
            
            # Limit lines for display (show first MAX_LINES_TO_DISPLAY lines)
            display_lines = lines[:MAX_LINES_TO_DISPLAY]
            
            if len(lines) > MAX_LINES_TO_DISPLAY:
                # Add truncation message
                truncation_msg = f"\n\n... [File truncated - Showing first {MAX_LINES_TO_DISPLAY} of {total_lines} lines] ...\n"
                content = ''.join(display_lines) + truncation_msg
            else:
                content = ''.join(display_lines)
            
            print(f"✅ File read successfully: {filename} ({total_lines} lines)")
            
            return jsonify({
                'success': True,
                'filename': filename,
                'content': content,
                'file_size': get_file_size_display(file_size),
                'upload_time': upload_time.strftime('%d-%b-%Y %I:%M %p'),
                'line_count': total_lines,
                'is_truncated': len(lines) > MAX_LINES_TO_DISPLAY,
                'displayed_lines': len(display_lines)
            }), 200
        
        except UnicodeDecodeError:
            return jsonify({
                'success': False,
                'error': 'Unable to read file. File may be corrupted or not a valid text file.'
            }), 400
    
    except Exception as e:
        print(f"❌ Read error: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Failed to read file: {str(e)}'
        }), 500

if __name__ == '__main__':
    print("🚀 Starting FixWise Flask Server...")
    print("📍 Visit: http://127.0.0.1:5000")
    print("🛑 Press CTRL+C to stop")
    app.run(debug=True, port=5000, threaded=True)