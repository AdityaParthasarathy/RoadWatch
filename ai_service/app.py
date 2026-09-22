import os
from flask import Flask, request, jsonify
from detector import detect_damage, calculate_predictions

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "service": "RoadWatch AI Service"})

@app.route('/detect', methods=['POST'])
def detect():
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    img_bytes = file.read()
    
    result = detect_damage(img_bytes)
    return jsonify(result)

@app.route('/predict', methods=['POST'])
def predict():
    data = request.json
    if not data or 'issues' not in data:
        return jsonify({"error": "No historical issues provided"}), 400
    
    predictions = calculate_predictions(data['issues'])
    return jsonify(predictions)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"AI Analysis & Prediction Service starting on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=False)
