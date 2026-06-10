"""End-to-end tests for the BTC payment recovery checkout-if-paid endpoint."""

import logging
import uuid

import pytest

from ambrosia.api_utils import assert_status_code

logger = logging.getLogger(__name__)


async def _get_current_user_id(admin_client) -> str:
    response = await admin_client.get("/users/me")
    assert_status_code(response, 200, "Failed to fetch current user")
    return response.json()["user"]["userId"]


def _checkout_payload(
    user_id: str,
    payment_method_id: str,
    currency_id: str,
    payment_hash: str | None,
    items: list[dict] | None = None,
) -> dict:
    return {
        "userId": user_id,
        "items": items
        if items is not None
        else [{"productId": str(uuid.uuid4()), "quantity": 1, "priceAtOrder": 1000}],
        "paymentMethodId": payment_method_id,
        "currencyId": currency_id,
        "amount": 10.0,
        "paymentHash": payment_hash,
    }


class TestCheckoutIfPaid:
    """Tests for POST /store/orders/checkout-if-paid."""

    @pytest.fixture
    async def user_id(self, admin_client):
        """Fetch the current admin user's ID."""
        return await _get_current_user_id(admin_client)

    @pytest.fixture
    async def method_id(self, admin_client):
        """Fetch the first available payment method ID from the server."""
        response = await admin_client.get("/payments/methods")
        assert_status_code(response, 200, "Failed to fetch payment methods")
        return response.json()[0]["id"]

    @pytest.fixture
    async def currency_id(self, admin_client):
        """Fetch the first available currency ID from the server."""
        response = await admin_client.get("/payments/currencies")
        assert_status_code(response, 200, "Failed to fetch currencies")
        return response.json()[0]["id"]

    @pytest.fixture
    async def category_id(self, admin_client):
        """Create a temporary product-type category and clean it up after."""
        uid = str(uuid.uuid4())[:8]
        response = await admin_client.post(
            "/categories",
            json={"name": f"test_cat_{uid}", "type": "product"},
        )
        assert_status_code(response, 201, "Failed to create test category fixture")
        cid = response.json()["id"]
        yield cid
        await admin_client.delete(f"/categories/{cid}?type=product")

    @pytest.fixture
    async def product_id(self, admin_client, category_id):
        """Create a temporary product with stock for checkout tests."""
        uid = str(uuid.uuid4())[:8]
        response = await admin_client.post(
            "/products",
            json={
                "SKU": f"SKU-{uid}",
                "name": f"test_product_{uid}",
                "costCents": 500,
                "priceCents": 1000,
                "quantity": 10,
                "minStockThreshold": 2,
                "maxStockThreshold": 50,
                "categoryIds": [category_id],
            },
        )
        assert_status_code(response, 201, "Failed to create test product fixture")
        pid = response.json()["id"]
        yield pid
        await admin_client.delete(f"/products/{pid}")

    @pytest.mark.asyncio
    async def test_checkout_if_paid_without_payment_hash_returns_400(
        self, admin_client, user_id, method_id, currency_id
    ):
        """POST /store/orders/checkout-if-paid without paymentHash should return 400."""
        payload = _checkout_payload(user_id, method_id, currency_id, payment_hash=None)

        response = await admin_client.post(
            "/store/orders/checkout-if-paid", json=payload
        )

        assert_status_code(response, 400, "Missing paymentHash should be rejected")
        logger.info("✓ Missing paymentHash correctly rejected with 400")

    @pytest.mark.asyncio
    async def test_checkout_if_paid_with_unknown_payment_hash_returns_pending(
        self, admin_client, user_id, method_id, currency_id
    ):
        """An unrecorded, unpaid paymentHash should return 202 pending without creating an order."""
        unknown_hash = f"unknown-{uuid.uuid4()}"
        payload = _checkout_payload(
            user_id, method_id, currency_id, payment_hash=unknown_hash
        )

        response = await admin_client.post(
            "/store/orders/checkout-if-paid", json=payload
        )

        assert_status_code(
            response, 202, "Unknown unpaid paymentHash should return 202 pending"
        )
        assert response.json()["status"] == "pending"
        logger.info("✓ Unknown unpaid paymentHash correctly returns 202 pending")

    @pytest.mark.asyncio
    async def test_checkout_if_paid_returns_existing_checkout_without_duplicating(
        self, admin_client, user_id, method_id, currency_id, product_id
    ):
        """A paymentHash already recorded on a sale should be returned as-is (idempotent)."""
        payment_hash = f"recovered-{uuid.uuid4()}"
        items = [{"productId": product_id, "quantity": 1, "priceAtOrder": 1000}]

        checkout_response = await admin_client.post(
            "/store/orders/checkout",
            json=_checkout_payload(
                user_id, method_id, currency_id, payment_hash, items=items
            ),
        )
        assert_status_code(checkout_response, 201, "Failed to create initial checkout")
        original = checkout_response.json()

        recovery_response = await admin_client.post(
            "/store/orders/checkout-if-paid",
            json=_checkout_payload(
                user_id, method_id, currency_id, payment_hash, items=items
            ),
        )

        assert_status_code(
            recovery_response, 200, "Existing paymentHash should return 200"
        )
        recovered = recovery_response.json()
        assert recovered["status"] == "completed"
        assert recovered["orderId"] == original["orderId"]
        assert recovered["ticketId"] == original["ticketId"]
        assert recovered["paymentId"] == original["paymentId"]
        logger.info(
            "✓ Recovery for an existing paymentHash returns the original checkout, no duplicate"
        )
