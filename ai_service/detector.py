import cv2
import numpy as np

def detect_damage(image_bytes):
    # Convert bytes to opencv image
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        return {"type": "none", "severity": 0}

    # Preprocessing
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    
    # 1. Pothole Detection (using thresholding and contour circularity)
    _, thresh = cv2.threshold(blurred, 60, 255, cv2.THRESH_BINARY_INV)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    max_pothole_severity = 0
    pothole_detected = False
    
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < 500: continue
        
        perimeter = cv2.arcLength(cnt, True)
        if perimeter == 0: continue
        
        circularity = 4 * np.pi * (area / (perimeter * perimeter))
        
        if 0.5 < circularity < 1.2: # Likely a pothole
            pothole_detected = True
            # Severity based on relative area (simplified)
            severity = min(10, int((area / (img.shape[0] * img.shape[1])) * 500))
            max_pothole_severity = max(max_pothole_severity, severity)

    # 2. Crack Detection (using Canny edge detection)
    edges = cv2.Canny(blurred, 50, 150)
    crack_contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    max_crack_severity = 0
    crack_detected = False
    
    for cnt in crack_contours:
        length = cv2.arcLength(cnt, False)
        if length > 100: # Long edges
            crack_detected = True
            severity = min(10, int(length / 200)) # Simplified severity
            max_crack_severity = max(max_crack_severity, severity)

    # Decision Logic
    if pothole_detected and max_pothole_severity >= max_crack_severity:
        return {"type": "pothole", "severity": max_pothole_severity or 1}
    elif crack_detected:
        return {"type": "crack", "severity": max_crack_severity or 1}
    
    return {"type": "none", "severity": 0}

def calculate_predictions(historical_issues):
    """
    Groups issues by area and calculates a 'Risk Score' based on:
    - Frequency of reports
    - Average Severity
    - Deterioration Trend (increasing severity over time)
    """
    if not historical_issues:
        return []

    # Group by area (rounded to 3 decimal places ~100m)
    areas = {}
    for issue in historical_issues:
        area_key = (round(issue['latitude'], 3), round(issue['longitude'], 3))
        if area_key not in areas:
            areas[area_key] = []
        areas[area_key].append(issue)

    predictions = []
    current_time = 0 # would be current time in real scenario
    if historical_issues:
        current_time = max(i['timestamp'] for i in historical_issues)

    for (lat, lng), issues in areas.items():
        # Sort by timestamp
        sorted_issues = sorted(issues, key=lambda x: x['timestamp'])
        
        count = len(issues)
        avg_severity = sum(i['severityScore'] for i in issues) / count
        
        # Deterioration Trend: check if severity is increasing
        trend = 0
        if count >= 2:
            last_sev = sorted_issues[-1]['severityScore']
            prev_sev = sorted_issues[-2]['severityScore']
            trend = (last_sev - prev_sev) * 5 # Weighted impact of most recent change

        # Risk Score Calculation (Scale 0.0 - 1.0)
        # Factors: Frequency (weight 0.3), Avg Severity (weight 0.4), Trend (weight 0.3)
        risk_score = min(1.0, (count * 0.05) + (avg_severity * 0.4) + (max(0, trend) * 0.3))

        if risk_score > 0.4: # Only return significant risk zones
            reason = "Frequent reports"
            if trend > 0.1: reason = "Rapid deterioration detected"
            elif avg_severity > 0.7: reason = "High severity cluster"

            predictions.append({
                "latitude": lat,
                "longitude": lng,
                "riskScore": risk_score,
                "reason": reason,
                "lastReported": sorted_issues[-1]['timestamp']
            })

    return predictions
