from datetime import datetime, timezone
from flask import Flask, jsonify, request
from flask_cors import CORS
from app.routes.auth import auth_bp
from app.routes.patients import patients_bp
from app.routes.queue import queue_bp
from app.routes.staff import staff_bp
from app.routes.admin import admin_bp
from app.routes.biometric import biometric_bp

def create_app():
    app = Flask(__name__)

    # Enable CORS for all routes matching the React frontend Vite dev server & production
    CORS(
        app,
        resources={r"/api/*": {"origins": "*"}},
        supports_credentials=True,
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"]
    )

    # Simple request logger
    @app.before_request
    def log_request_info():
        print(f"[LabFlow API] {request.method} {request.path}")

    # Health check endpoint
    @app.route("/api/health", methods=["GET"])
    def health():
        return jsonify({
            "status": "healthy",
            "system": "LabFlow - Smart Laboratory Test Management System",
            "framework": "Python Flask",
            "version": "1.0.0",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

    # Register Blueprints
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(patients_bp, url_prefix="/api/patients")
    app.register_blueprint(queue_bp, url_prefix="/api/queue")
    app.register_blueprint(staff_bp, url_prefix="/api/staff")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(biometric_bp, url_prefix="/api/biometric")

    # 404 JSON Handler
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            "success": False,
            "error": f"Endpoint not found: {request.method} {request.path}"
        }), 404

    # 500 JSON Handler
    @app.errorhandler(500)
    def internal_error(error):
        print(f"[API Internal Error]: {error}")
        return jsonify({
            "success": False,
            "error": "Internal server error occurred."
        }), 500

    return app
