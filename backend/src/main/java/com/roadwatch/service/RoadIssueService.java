package com.roadwatch.service;

import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.*;
import com.roadwatch.model.RoadIssue;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Persistence layer for RoadIssue objects.
 *
 * Primary store  : Firestore (if available)
 * Fallback store : In-memory CopyOnWriteArrayList (thread-safe)
 *
 * Both methods NEVER throw — callers always receive a result.
 */
@Service
public class RoadIssueService {

    private static final Logger logger = LoggerFactory.getLogger(RoadIssueService.class);
    private static final String COLLECTION = "road_issues";

    /**
     * Injected as optional — will be null if Firebase failed to initialise.
     * See FirebaseConfig.firestore() for details.
     */
    @Autowired(required = false)
    @Nullable
    private Firestore firestore;

    /** Thread-safe in-memory fallback. Survives for the lifetime of the JVM process. */
    private final List<RoadIssue> inMemoryStore = new CopyOnWriteArrayList<>();

    // -----------------------------------------------------------------------
    // WRITE
    // -----------------------------------------------------------------------

    /**
     * Persists a RoadIssue.
     * Tries Firestore first; silently falls back to in-memory on any failure.
     *
     * @return the assigned document/record ID
     */
    public String saveRoadIssue(RoadIssue issue) {
        // Always stamp the timestamp here so neither path can forget it
        issue.setTimestamp(System.currentTimeMillis());

        if (firestore != null) {
            try {
                DocumentReference docRef = firestore.collection(COLLECTION).document();
                issue.setId(docRef.getId());
                docRef.set(issue).get(); // blocking — ensures write completes
                logger.info("Saved issue [{}] to Firestore.", issue.getId());
                return issue.getId();
            } catch (Exception e) {
                logger.warn("Firestore write failed: {}. Falling back to in-memory store.", e.getMessage());
                // Fall through to in-memory
            }
        } else {
            logger.warn("Firestore not available. Persisting issue to in-memory store.");
        }

        // Ensure ID is assigned before in-memory store
        if (issue.getId() == null || issue.getId().isBlank()) {
            issue.setId("mem-" + UUID.randomUUID());
        }
        inMemoryStore.add(issue);
        logger.info("Saved issue [{}] to in-memory store. Store size: {}.",
                issue.getId(), inMemoryStore.size());
        return issue.getId();
    }

    // -----------------------------------------------------------------------
    // READ
    // -----------------------------------------------------------------------

    /**
     * Retrieves all persisted issues.
     * Tries Firestore first; falls back to in-memory on any failure.
     *
     * @return a non-null (possibly empty) list
     */
    public List<RoadIssue> getAllIssues() {
        if (firestore != null) {
            try {
                ApiFuture<QuerySnapshot> future = firestore.collection(COLLECTION).get();
                QuerySnapshot snapshot = future.get(); // blocking
                List<RoadIssue> issues = new ArrayList<>();
                for (QueryDocumentSnapshot doc : snapshot.getDocuments()) {
                    issues.add(doc.toObject(RoadIssue.class));
                }
                logger.info("Fetched {} issue(s) from Firestore.", issues.size());
                return issues;
            } catch (Exception e) {
                logger.warn("Firestore read failed: {}. Returning in-memory issues.", e.getMessage());
            }
        } else {
            logger.warn("Firestore not available. Returning in-memory issues.");
        }

        List<RoadIssue> snapshot = new ArrayList<>(inMemoryStore);
        logger.info("Returning {} issue(s) from in-memory store.", snapshot.size());
        return snapshot;
    }
}
