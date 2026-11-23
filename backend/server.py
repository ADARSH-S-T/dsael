import sys
from app import create_app
from app.config import PORT, HOST

app = create_app()

if __name__ == "__main__":
    print(f"==================================================")
    print(f"  LabFlow Flask API Server Starting...")
    print(f"  Listening on http://{HOST}:{PORT}")
    print(f"  Health Check: http://127.0.0.1:{PORT}/api/health")
    print(f"==================================================")
    try:
        app.run(host=HOST, port=PORT, debug=False)
    except KeyboardInterrupt:
        print("\nLabFlow API Server stopped.")
        sys.exit(0)
