package com.roadwatch.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class RoadIssue {
    private String id;
    private String type; // pothole, crack, waterlogging
    private double latitude;
    private double longitude;
    private double severityScore; // 0.0 to 1.0
    private String imageUrl;
    private long timestamp;
}
