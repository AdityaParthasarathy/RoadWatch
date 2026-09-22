package com.roadwatch.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.firestore.Firestore;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.cloud.FirestoreClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import org.springframework.beans.factory.annotation.Value;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Base64;

@Configuration
public class FirebaseConfig {

    private static final Logger logger = LoggerFactory.getLogger(FirebaseConfig.class);

    @Value("${FIREBASE_SERVICE_ACCOUNT_BASE64:}")
    private String serviceAccountBase64;

    /**
     * Attempts to initialize Firebase and return a Firestore instance.
     *
     * Credentials are loaded, in order of preference:
     *   1. FIREBASE_SERVICE_ACCOUNT_BASE64 env var (base64-encoded JSON) — used in production
     *      so the real credential file never has to be committed to git.
     *   2. service-account.json on the classpath — used for local dev.
     *
     * Returns NULL if neither is available, credentials are invalid, or the network
     * is unreachable during init. RoadIssueService uses @Autowired(required = false)
     * to handle the null case and falls back to in-memory storage automatically.
     */
    @Bean
    public Firestore firestore() {
        try {
            InputStream serviceAccount;

            if (!serviceAccountBase64.isBlank()) {
                byte[] decoded = Base64.getDecoder().decode(serviceAccountBase64.trim());
                serviceAccount = new ByteArrayInputStream(decoded);
                logger.info("Loading Firebase credentials from FIREBASE_SERVICE_ACCOUNT_BASE64.");
            } else {
                serviceAccount = getClass()
                        .getClassLoader()
                        .getResourceAsStream("service-account.json");
            }

            if (serviceAccount == null) {
                logger.warn("========================================================");
                logger.warn("  No Firebase credentials found (env var or resources).");
                logger.warn("  Firestore is DISABLED. Using in-memory fallback.");
                logger.warn("========================================================");
                return null;
            }

            if (FirebaseApp.getApps().isEmpty()) {
                FirebaseOptions options = FirebaseOptions.builder()
                        .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                        .build();
                FirebaseApp.initializeApp(options);
                logger.info("Firebase initialized successfully.");
            }

            Firestore db = FirestoreClient.getFirestore();
            logger.info("Firestore client created successfully.");
            return db;

        } catch (IOException e) {
            logger.error("Firebase init failed (IO): {}. Firestore DISABLED.", e.getMessage());
            return null;
        } catch (Exception e) {
            logger.error("Firebase init failed (unexpected): {}. Firestore DISABLED.", e.getMessage());
            return null;
        }
    }
}
