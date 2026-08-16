"""FastAPI AI service for the website-builder feature.

Runs as a separate microservice next to the existing Spring Boot backend.
It does NOT own login — it verifies the JWT that Spring Boot already issues.
"""
