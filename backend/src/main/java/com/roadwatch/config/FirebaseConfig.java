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

import java.io.IOException;
import java.io.InputStream;

@Configuration
public class FirebaseConfig {

    private static final Logger logger = LoggerFactory.getLogger(FirebaseConfig.class);

    /**
     * Attempts to initialize Firebase and return a Firestore instance.
     *
     * Returns NULL if:
     *   - service-account.json is missing from resources
     *   - Credentials are invalid
     *   - Network is unreachable during init
     *
     * RoadIssueService uses @Autowired(required = false) to handle the null case
     * and falls back to in-memory storage automatically.
     */
    @Bean
    public Firestore firestore() {
        try {
            InputStream serviceAccount = getClass()
                    .getClassLoader()
                    .getResourceAsStream("service-account.json");

            if (serviceAccount == null) {
                logger.warn("========================================================");
                logger.warn("  service-account.json NOT FOUND in resources.");
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
