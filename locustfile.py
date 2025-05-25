import random
import json
from locust import HttpUser, task, between, events
from requests.exceptions import JSONDecodeError

# Funnel ratios
REGISTER_PROB = 0.25  # 25% of users register/login
BROWSE_PROB   = 0.50  # 50% of users view products
PURCHASE_PROB = 0.05  # 5% of users complete a purchase
REVIEW_PROB   = 0.30  # 30% of purchasers leave a review

MAX_PRODUCTS = 7

REVIEW_TEMPLATES = [
    "Absolutely love this product!",
    "Pretty decent, does the job.",
    "Exceeded my expectations!",
    "Not what I expected, but okay.",
    "Could be better, but worth the price.",
    "Five stars! Will buy again.",
    "Terrible quality, do not buy!",
    "Solid purchase, highly recommend."
]

def random_email():
    return f"locust_{random.randint(1,10_000)}@example.com"


class EcommerceUser(HttpUser):
    host = "http://35.190.215.149:3000"
    wait_time = between(1, 3)

    def on_start(self):
        # Everyone lands on the homepage
        self.client.get("/", name="dashboard")

        # Attempt registration+login ~25% of the time,
        # but only flip is_registered if both calls succeed.
        self.is_registered = False
        if random.random() < REGISTER_PROB:
            email = random_email()
            password = "Passw0rd!"

            # Try to register (ignore 400s like "already registered")
            with self.client.post(
                "/api/register",
                json={"name": "LocustUser", "email": email, "password": password},
                name="register",
                catch_response=True
            ) as resp:
                if resp.status_code == 201:
                    resp.success()
                else:
                    # swallow any bad‐request
                    resp.success()

            # Try to log in
            with self.client.post(
                "/api/login",
                json={"email": email, "password": password},
                name="login",
                catch_response=True
            ) as resp:
                if resp.status_code == 200:
                    resp.success()
                    self.is_registered = True
                else:
                    resp.failure(f"login failed: {resp.status_code}")

    @task(50)
    def browse_products(self):
        self.client.get("/", name="dashboard")
        if random.random() > BROWSE_PROB:
            return

        with self.client.get("/api/products", name="/api/products", catch_response=True) as resp:
            if resp.status_code != 200:
                resp.failure(f"list_products: Expected 200, got {resp.status_code}")
                return
            try:
                products = resp.json()
            except JSONDecodeError:
                resp.failure(f"list_products: Invalid JSON")
                return

        pid = random.choice(products).get("id") if products else random.randint(1, MAX_PRODUCTS)
        self.client.get(f"/product-page/{pid}", name="view_product")

    @task(25)
    def view_dashboard(self):
        self.client.get("/", name="dashboard")

    @task(3)
    def purchase_flow(self):
        # only actually run this for users who successfully logged in
        if not self.is_registered:
            return

        self.client.get("/", name="dashboard")
        if random.random() > PURCHASE_PROB:
            return

        with self.client.get("/api/products", name="/api/products", catch_response=True) as resp:
            if resp.status_code != 200:
                resp.failure(f"checkout_products: Expected 200, got {resp.status_code}")
                return
            try:
                products = resp.json()
            except JSONDecodeError:
                resp.failure("checkout_products: Invalid JSON")
                return

        item = random.choice(products) if products else {"id": random.randint(1, MAX_PRODUCTS), "price": 1}
        pid  = item.get("id")
        price = item.get("price") or 1

        self.client.get(f"/product-page/{pid}", name="view_product")
        self.client.get("/payment", name="checkout_page")

        cart = [{"id": pid, "quantity": 1, "price": price}]
        payload = {
            "cardNumber": "4111111111111111",
            "expiry":     "12/30",
            "cvv":        "123",
            "cart":       cart,
            "address":    "123 Main St",
        }

        with self.client.post("/api/payment", json=payload, name="payment_api", catch_response=True) as pay_resp:
            if pay_resp.status_code != 200:
                pay_resp.failure(f"payment: Expected 200, got {pay_resp.status_code}")
                return
            try:
                invoice_id = pay_resp.json().get("invoice_id") or pay_resp.json().get("orderId")
            except Exception:
                invoice_id = None

        self.client.get(f"/invoice/{invoice_id or 1}", name="view_invoice")

        if random.random() < REVIEW_PROB:
            self._leave_review(pid)

    def _leave_review(self, pid):
        if not self.is_registered:
            return

        self.client.get(f"/product-page/{pid}", name="view_product")
        rating = random.randint(1, 5)
        comment = random.choice(REVIEW_TEMPLATES)
        full_comment = f"{comment} ({rating} stars)"

        self.client.post(
            "/api/ratings",
            json={"productId": pid, "rating": rating},
            name="api_ratings",
        )
        self.client.post(
            "/api/comments",
            json={"productId": pid, "comment_text": full_comment},
            name="api_comments",
        )


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    print("\n--- Locust run complete ---")
