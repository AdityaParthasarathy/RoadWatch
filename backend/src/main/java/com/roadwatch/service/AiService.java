package com.roadwatch.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import jakarta.annotation.PostConstruct;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Encapsulates all communication with the Python AI microservice.
 *
 * Design contract:
 *   - detectDamage()    → NEVER throws. Returns fallback {"type":"unknown","severity":0} on failure.
 *   - getPredictions()  → NEVER throws. Returns empty list on failure.
 *   - isHealthy()       → NEVER throws. Returns boolean.
 */
@Service
public class AiService {

    private static final Logger logger = LoggerFactory.getLogger(AiService.class);

    @Value("${ai.service.url:http://localhost:5000}")
    private String aiServiceUrl;

    @Value("${ai.service.connect-timeout:3000}")
    private int connectTimeout;

    @Value("${ai.service.read-timeout:5000}")
    private int readTimeout;

    private RestTemplate restTemplate;

    @PostConstruct
    public void init() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeout);
        factory.setReadTimeout(readTimeout);
        this.restTemplate = new RestTemplate(factory);
        logger.info("AiService ready — endpoint: {}, connectTimeout: {}ms, readTimeout: {}ms",
                aiServiceUrl, connectTimeout, readTimeout);
    }

    // -----------------------------------------------------------------------
    // PUBLIC API
    // -----------------------------------------------------------------------

    /**
     * Calls POST {aiServiceUrl}/detect with the uploaded file.
     * If the AI service is unreachable or returns an error, returns safe defaults.
     */
    public Map<String, Object> detectDamage(MultipartFile file) {
        String url = aiServiceUrl + "/detect";
        logger.info("Calling AI detection: {}", url);

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("file", file.getResource());

            HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);

            @SuppressWarnings("unchecked")
            Map<String, Object> result = restTemplate.postForObject(url, request, Map.class);

            if (result == null) {
                logger.warn("AI detection returned null. Using fallback.");
                return buildFallback();
            }

            logger.info("AI detection succeeded — type={}, severity={}", result.get("type"), result.get("severity"));
            return result;

        } catch (Exception e) {
            logger.warn("AI detection unavailable [{}]: {}. Using fallback values.", url, e.getMessage());
            return buildFallback();
        }
    }

    /**
     * Calls POST {aiServiceUrl}/predict with historical issues payload.
     * Returns an empty list if the AI service is unavailable.
     */
    public List<Map<String, Object>> getPredictions(Map<String, Object> payload) {
        String url = aiServiceUrl + "/predict";
        logger.info("Calling AI predictions: {}", url);

        try {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> predictions = restTemplate.postForObject(url, payload, List.class);

            if (predictions == null) {
                logger.warn("AI predictions returned null. Returning empty list.");
                return List.of();
            }

            logger.info("AI predictions received — {} zones.", predictions.size());
            return predictions;

        } catch (Exception e) {
            logger.warn("AI predictions unavailable [{}]: {}. Returning empty list.", url, e.getMessage());
            return List.of();
        }
    }

    /**
     * Lightweight connectivity check against the AI service.
     * A 404 from the service counts as UP (server is running, endpoint just doesn't exist).
     */
    public boolean isHealthy() {
        try {
            restTemplate.getForObject(aiServiceUrl + "/health", String.class);
            return true;
        } catch (HttpClientErrorException e) {
            // 4xx means the server responded — it's UP
            return true;
        } catch (Exception e) {
            // Connection refused, timeout, etc — server is DOWN
            return false;
        }
    }

    // -----------------------------------------------------------------------
    // PRIVATE HELPERS
    // -----------------------------------------------------------------------

    private Map<String, Object> buildFallback() {
        Map<String, Object> fallback = new HashMap<>();
        fallback.put("type", "unknown");
        fallback.put("severity", 0);
        return fallback;
    }
}
