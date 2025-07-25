from flask import Flask, request, jsonify
import pickle
import numpy as np
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

model = pickle.load(open('xgboost_model.pkl', 'rb'))

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
    app.run(host="0.0.0.0", port=5001, debug=True)