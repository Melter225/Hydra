from flask import Flask, request, jsonify
import pickle
import numpy as np
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app, origins=["https://hydraapp.vercel.app"])

model_path = os.path.join(os.path.dirname(__file__), 'xgboost_model.pkl')
model = pickle.load(open(model_path, 'rb'))

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        if isinstance(data, list):
            features = data
        elif isinstance(data, dict) and 'features' in data:
            features = data['features']
        
        features_array = np.array(features).reshape(1, -1)
        prediction = model.predict(features_array)
        
        return jsonify({
            'prediction': prediction.tolist(),
            'success': True
        })
    except Exception as e:
        return jsonify({
            'error': str(e),
            'success': False
        })
    
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)