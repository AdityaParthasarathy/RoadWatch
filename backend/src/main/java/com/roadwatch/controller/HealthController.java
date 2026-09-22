package com.roadwatch.controller;

import com.google.cloud.firestore.Firestore;
import com.roadwatch.service.AiService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.Nullable;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/health")
@CrossOrigin(origins = "*")
public class HealthController {

    private static final Logger logger = LoggerFactory.getLogger(HealthController.class);

    @Autowired
    private AiService aiService;

    /** Null if Firebase did not initialize — see FirebaseConfig. */
    @Autowired(required = false)
    @Nullable
    private Firestore firestore;

    // -----------------------------------------------------------------------
    // GET /api/health
    // -----------------------------------------------------------------------

    /**
     * Returns the live status of all three subsystems.
     *
     * Response shape:
     * {
     *   "backend":   "UP",
     *   "ai":        "UP" | "DOWN",
     *   "firestore": "UP" | "DOWN"
     * }
     *
     * Always returns HTTP 200 — callers decide what to do with the statuses.
     */
    @GetMapping
    public ResponseEntity<Map<String, String>> health() {
        // Use LinkedHashMap to preserve insertion order in JSON response
        Map<String, String> status = new LinkedHashMap<>();

        status.put("backend", "UP");

        // ── AI service ───────────────────────────────────────────────────────
        boolean aiUp = aiService.isHealthy();
        status.put("ai", aiUp ? "UP" : "DOWN");

        // ── Firestore ────────────────────────────────────────────────────────
        status.put("firestore", checkFirestore());

        logger.info("Health check — backend: UP | ai: {} | firestore: {}",
                status.get("ai"), status.get("firestore"));

        return ResponseEntity.ok(status);
    }

    // -----------------------------------------------------------------------
    // PRIVATE HELPERS
    // -----------------------------------------------------------------------

    private String checkFirestore() {
        if (firestore == null) {
            return "DOWN";
        }
        try {
            // Lightweight read: fetch at most 1 document to verify connectivity
            firestore.collection("health_check").limit(1).get().get();
            return "UP";
        } catch (Exception e) {
            logger.warn("Firestore health check failed: {}", e.getMessage());
            return "DOWN";
        }
    }
}
