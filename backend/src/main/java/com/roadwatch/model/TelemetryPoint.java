package com.roadwatch.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class TelemetryPoint {
    private String tripId;
    private double latitude;
    private double longitude;
    private double zAccel; // Accelerometer Z-axis reading
    private double roughness; // Calculated locally: 0 (smooth) to 1 (rough)
    private long timestamp;
}
