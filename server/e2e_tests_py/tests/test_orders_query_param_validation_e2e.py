"""End-to-end tests for GET /orders/with-payments query parameter validation."""

import logging

import pytest

from ambrosia.api_utils import assert_status_code

logger = logging.getLogger(__name__)

BASE = "/orders/with-payments"


class TestOrdersQueryParamValidation:
    """Tests for query parameter validation on GET /orders/with-payments."""

    @pytest.mark.asyncio
    async def test_invalid_start_date_format_returns_400(self, admin_client):
        """startDate that is not YYYY-MM-DD should return 400."""
        response = await admin_client.get(f"{BASE}?startDate=01-01-2026")
        assert_status_code(response, 400, "Invalid startDate format should be rejected")
        logger.info("✓ Invalid startDate format correctly rejected")

    @pytest.mark.asyncio
    async def test_invalid_end_date_format_returns_400(self, admin_client):
        """endDate that is not YYYY-MM-DD should return 400."""
        response = await admin_client.get(f"{BASE}?endDate=not-a-date")
        assert_status_code(response, 400, "Invalid endDate format should be rejected")
        logger.info("✓ Invalid endDate format correctly rejected")

    @pytest.mark.asyncio
    async def test_start_date_after_end_date_returns_400(self, admin_client):
        """startDate later than endDate should return 400."""
        response = await admin_client.get(
            f"{BASE}?startDate=2026-12-31&endDate=2026-01-01"
        )
        assert_status_code(response, 400, "startDate > endDate should be rejected")
        logger.info("✓ startDate > endDate correctly rejected")

    @pytest.mark.asyncio
    async def test_valid_date_range_succeeds(self, admin_client):
        """Valid startDate and endDate should return 200."""
        response = await admin_client.get(
            f"{BASE}?startDate=2026-01-01&endDate=2026-12-31"
        )
        assert_status_code(response, 200, "Valid date range should be accepted")
        logger.info("✓ Valid date range correctly accepted")

    @pytest.mark.asyncio
    async def test_invalid_sort_by_returns_400(self, admin_client):
        """sortBy value not in allowed set should return 400."""
        response = await admin_client.get(f"{BASE}?sortBy=name")
        assert_status_code(response, 400, "Invalid sortBy should be rejected")
        logger.info("✓ Invalid sortBy correctly rejected")

    @pytest.mark.asyncio
    async def test_valid_sort_by_date_succeeds(self, admin_client):
        """sortBy=date should return 200."""
        response = await admin_client.get(f"{BASE}?sortBy=date")
        assert_status_code(response, 200, "sortBy=date should be accepted")
        logger.info("✓ sortBy=date correctly accepted")

    @pytest.mark.asyncio
    async def test_invalid_sort_order_returns_400(self, admin_client):
        """sortOrder value not in allowed set should return 400."""
        response = await admin_client.get(f"{BASE}?sortOrder=descending")
        assert_status_code(response, 400, "Invalid sortOrder should be rejected")
        logger.info("✓ Invalid sortOrder correctly rejected")

    @pytest.mark.asyncio
    async def test_valid_sort_order_desc_succeeds(self, admin_client):
        """sortOrder=desc should return 200."""
        response = await admin_client.get(f"{BASE}?sortOrder=desc")
        assert_status_code(response, 200, "sortOrder=desc should be accepted")
        logger.info("✓ sortOrder=desc correctly accepted")

    @pytest.mark.asyncio
    async def test_nonnumeric_min_total_returns_400(self, admin_client):
        """Non-numeric minTotal should return 400."""
        response = await admin_client.get(f"{BASE}?minTotal=abc")
        assert_status_code(response, 400, "Non-numeric minTotal should be rejected")
        logger.info("✓ Non-numeric minTotal correctly rejected")

    @pytest.mark.asyncio
    async def test_nonnumeric_max_total_returns_400(self, admin_client):
        """Non-numeric maxTotal should return 400."""
        response = await admin_client.get(f"{BASE}?maxTotal=abc")
        assert_status_code(response, 400, "Non-numeric maxTotal should be rejected")
        logger.info("✓ Non-numeric maxTotal correctly rejected")

    @pytest.mark.asyncio
    async def test_min_total_greater_than_max_total_returns_400(self, admin_client):
        """minTotal greater than maxTotal should return 400."""
        response = await admin_client.get(f"{BASE}?minTotal=100&maxTotal=50")
        assert_status_code(response, 400, "minTotal > maxTotal should be rejected")
        logger.info("✓ minTotal > maxTotal correctly rejected")

    @pytest.mark.asyncio
    async def test_valid_total_range_succeeds(self, admin_client):
        """Valid minTotal and maxTotal should return 200."""
        response = await admin_client.get(f"{BASE}?minTotal=0&maxTotal=1000")
        assert_status_code(response, 200, "Valid total range should be accepted")
        logger.info("✓ Valid total range correctly accepted")
