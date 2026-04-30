
import pytest
import logging
import random
from ambrosia.http_client import AmbrosiaHttpClient
from ambrosia.auth_utils import login_user, create_role, create_user

logger = logging.getLogger(__name__)

@pytest.mark.asyncio
async def test_login_after_role_deleted(server_url: str):
    suffix = random.randint(1000, 9999)
    user_name = f"repro_user_{suffix}"
    
    async with AmbrosiaHttpClient(server_url) as admin_client:
        # 1. Login as admin
        await login_user(admin_client)
        
        # 2. Create a temporary role
        role_id = await create_role(admin_client, f"TempRole_{suffix}")
        
        # 3. Create a user with that role
        user_pin = "1234"
        await create_user(admin_client, user_name, user_pin, role_id)
        
        # 4. Delete the role
        response = await admin_client.delete(f"/roles/{role_id}")
        assert response.status_code == 204
        
        # 5. Try to login as the new user
        async with AmbrosiaHttpClient(server_url) as user_client:
            response = await user_client.post("/auth/login", json={"name": user_name, "pin": user_pin})
            
            # This should fail with the specific message we want to implement
            assert response.status_code == 401
            assert response.json()["message"] == "No assigned role for this user, contact Admin"
