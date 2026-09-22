package com.roadwatch.controller;

import com.roadwatch.model.RoadIssue;
import com.roadwatch.service.AiService;
import com.roadwatch.service.RoadIssueService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/issues")
@CrossOrigin(origins = "*")
public class RoadIssueController {

    private static final Logger logger = LoggerFactory.getLogger(RoadIssueController.class);

    @Autowired
    private RoadIssueService issueService;

    @Autowired
    private AiService aiService;

    // -----------------------------------------------------------------------
    // GET /api/issues
    // -----------------------------------------------------------------------

    @GetMapping
    public ResponseEntity<List<RoadIssue>> getIssues() {
        try {
            List<RoadIssue> issues = issueService.getAllIssues();
            return ResponseEntity.ok(issues);
        } catch (Exception e) {
            // Should never reach here — RoadIssueService never throws — but guard anyway
            logger.error("Unexpected error fetching issues: {}", e.getMessage(), e);
            return ResponseEntity.ok(List.of());
        }
    }

    // -----------------------------------------------------------------------
    // POST /api/issues/upload
    // -----------------------------------------------------------------------

    /**
     * Accepts a road image + GPS coordinates.
     * Steps:
     *   1. Forward image to Python AI service for damage detection (optional).
     *   2. Build a RoadIssue from the result (or safe defaults if AI is down).
     *   3. Persist the issue (Firestore or in-memory fallback).
     *   4. Return HTTP 201 with the saved issue.
     *
     * This endpoint NEVER returns 500. All external failures are absorbed.
     */
    @PostMapping("/upload")
    public ResponseEntity<RoadIssue> uploadAndDetect(
            @RequestParam("file") MultipartFile file,
            @RequestParam("lat") double lat,
            @RequestParam("lng") double lng) {

        logger.info("Upload received — file: {}, size: {} bytes, lat: {}, lng: {}",
                file.getOriginalFilename(), file.getSize(), lat, lng);

        // ── Step 1: AI Detection (never throws) ─────────────────────────────
        Map<String, Object> aiResult = aiService.detectDamage(file);

        String detectedType = (String) aiResult.getOrDefault("type", "unknown");
        double severityScore = parseSeverity(aiResult.getOrDefault("severity", 0));

        // ── Step 2: Build issue ──────────────────────────────────────────────
        RoadIssue issue = new RoadIssue();
        issue.setType(detectedType);
        issue.setLatitude(lat);
        issue.setLongitude(lng);
        issue.setSeverityScore(severityScore);
        issue.setImageUrl(
                "https://images.unsplash.com/photo-1544620347-c4fd4a3d5997?auto=format&fit=crop&q=80&w=200"
        );

        // ── Step 3: Persist (never throws) ──────────────────────────────────
        issueService.saveRoadIssue(issue);

        logger.info("Issue created — id: {}, type: {}, severity: {}", issue.getId(), issue.getType(), issue.getSeverityScore());

        // ── Step 4: Respond ─────────────────────────────────────────────────
        return ResponseEntity.status(HttpStatus.CREATED).body(issue);
    }

    // -----------------------------------------------------------------------
    // POST /api/issues/report  — mobile sensor direct report (no image)
    // -----------------------------------------------------------------------

    /**
     * Accepts a JSON payload from the mobile sensor page.
     * The phone already computed severity from accelerometer data,
     * so no AI service call is needed here.
     *
     * Expected body: { "type": "pothole", "latitude": 13.08, "longitude": 80.27, "severityScore": 0.76 }
     */
    @PostMapping("/report")
    public ResponseEntity<RoadIssue> reportFromSensor(@RequestBody Map<String, Object> body) {
        try {
            RoadIssue issue = new RoadIssue();
            issue.setType((String) body.getOrDefault("type", "pothole"));
            issue.setLatitude(((Number) body.get("latitude")).doubleValue());
            issue.setLongitude(((Number) body.get("longitude")).doubleValue());
            issue.setSeverityScore(((Number) body.get("severityScore")).doubleValue());
            issue.setImageUrl(null);

            issueService.saveRoadIssue(issue);

            logger.info("Mobile sensor report — id: {}, type: {}, severity: {}",
                    issue.getId(), issue.getType(), issue.getSeverityScore());

            return ResponseEntity.status(HttpStatus.CREATED).body(issue);
        } catch (Exception e) {
            logger.error("Failed to save mobile sensor report: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }

    // -----------------------------------------------------------------------
    // HELPERS
    // -----------------------------------------------------------------------

    /**
     * Safely converts the AI severity (1–10 int scale) to a 0.0–1.0 double.
     * Returns 0.0 for any invalid input.
     */
    private double parseSeverity(Object rawValue) {
        try {
            double raw = ((Number) rawValue).doubleValue();
            return Math.min(1.0, Math.max(0.0, raw / 10.0));
        } catch (Exception e) {
            logger.warn("Could not parse severity value '{}' — defaulting to 0.0", rawValue);
            return 0.0;
        }
    }
}
