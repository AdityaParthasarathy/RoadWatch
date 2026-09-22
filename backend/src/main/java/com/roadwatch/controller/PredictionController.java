package com.roadwatch.controller;

import com.roadwatch.model.RoadIssue;
import com.roadwatch.service.AiService;
import com.roadwatch.service.RoadIssueService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/predictions")
@CrossOrigin(origins = "*")
public class PredictionController {

    private static final Logger logger = LoggerFactory.getLogger(PredictionController.class);

    @Autowired
    private RoadIssueService issueService;

    @Autowired
    private AiService aiService;

    // -----------------------------------------------------------------------
    // GET /api/predictions
    // -----------------------------------------------------------------------

    /**
     * Fetches historical issues, then forwards them to the AI service to
     * compute risk-zone predictions.
     *
     * Returns an empty list (not an error) if either:
     *   - Firestore is unavailable (issues come from in-memory fallback)
     *   - Python AI service is unavailable
     */
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getPredictions() {
        logger.info("Predictions requested.");

        // Step 1: Fetch issues — never throws (in-memory fallback handles failures)
        List<RoadIssue> historicalIssues = issueService.getAllIssues();
        logger.info("Loaded {} historical issue(s) for prediction.", historicalIssues.size());

        if (historicalIssues.isEmpty()) {
            logger.info("No historical issues found. Returning empty predictions.");
            return ResponseEntity.ok(List.of());
        }

        // Step 2: Build payload and call AI — never throws
        Map<String, Object> payload = new HashMap<>();
        payload.put("issues", historicalIssues);

        List<Map<String, Object>> predictions = aiService.getPredictions(payload);
        logger.info("Returning {} prediction zone(s).", predictions.size());

        return ResponseEntity.ok(predictions);
    }
}
