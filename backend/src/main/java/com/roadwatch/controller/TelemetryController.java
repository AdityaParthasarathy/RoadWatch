package com.roadwatch.controller;

import com.roadwatch.model.TelemetryPoint;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/telemetry")
@CrossOrigin(origins = "*")
public class TelemetryController {

    // In-memory storage for trip segments (for demo purposes)
    private static final Map<String, List<TelemetryPoint>> tripSegments = new ConcurrentHashMap<>();

    @PostMapping
    public void recordTelemetry(@RequestBody TelemetryPoint point) {
        // Simple Roughness Calculation: 
        // Logic: Distance of Z-axis from 9.8 (gravity). 
        // More than 2.0 fluctuation is considered "rough".
        double baseline = 9.8;
        double diff = Math.abs(point.getZAccel() - baseline);
        point.setRoughness(Math.min(1.0, diff / 5.0));
        point.setTimestamp(System.currentTimeMillis());

        tripSegments.computeIfAbsent(point.getTripId(), k -> new ArrayList<>()).add(point);
    }

    @GetMapping("/trips")
    public Map<String, List<TelemetryPoint>> getAllTrips() {
        return tripSegments;
    }

    @DeleteMapping("/clear")
    public void clearTelemetry() {
        tripSegments.clear();
    }
}
