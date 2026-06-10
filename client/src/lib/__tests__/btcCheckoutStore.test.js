import "fake-indexeddb/auto";

if (typeof structuredClone === "undefined") {
  global.structuredClone = (value) => JSON.parse(JSON.stringify(value));
}

import {
  deleteCheckout,
  getCompletedCheckouts,
  getPendingCheckouts,
  markCheckoutCompleted,
  registerBtcCheckoutSync,
  savePendingCheckout,
} from "../btcCheckoutStore";

function clearStore() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("ambrosia-btc", 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("pending-checkouts")) {
        db.createObjectStore("pending-checkouts", { keyPath: "paymentHash" });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("pending-checkouts", "readwrite");
      transaction.objectStore("pending-checkouts").clear();
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    };
    request.onerror = () => reject(request.error);
  });
}

describe("btcCheckoutStore", () => {
  beforeEach(async () => {
    await clearStore();
  });

  it("savePendingCheckout stores an entry retrievable via getPendingCheckouts", async () => {
    const checkoutPayload = { userId: "user-1", items: [], amount: 10 };

    await savePendingCheckout({ paymentHash: "hash-1", checkoutPayload });

    const pending = await getPendingCheckouts();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      paymentHash: "hash-1",
      checkoutPayload,
      status: "pending",
    });
    expect(typeof pending[0].savedAt).toBe("number");
  });

  it("markCheckoutCompleted updates an existing pending entry to completed", async () => {
    const checkoutPayload = { userId: "user-1", items: [], amount: 10 };
    await savePendingCheckout({ paymentHash: "hash-1", checkoutPayload });

    await markCheckoutCompleted("hash-1", { orderId: "order-1" });

    const completed = await getCompletedCheckouts();
    expect(completed).toHaveLength(1);
    expect(completed[0]).toMatchObject({
      paymentHash: "hash-1",
      checkoutPayload,
      status: "completed",
      completedResult: { orderId: "order-1" },
    });
    expect(typeof completed[0].completedAt).toBe("number");

    const pending = await getPendingCheckouts();
    expect(pending).toHaveLength(0);
  });

  it("markCheckoutCompleted creates a completed entry when none exists", async () => {
    await markCheckoutCompleted("hash-2", { orderId: "order-2" });

    const completed = await getCompletedCheckouts();
    expect(completed).toHaveLength(1);
    expect(completed[0]).toMatchObject({
      paymentHash: "hash-2",
      status: "completed",
      completedResult: { orderId: "order-2" },
    });
  });

  it("getPendingCheckouts and getCompletedCheckouts only return entries matching their status", async () => {
    await savePendingCheckout({ paymentHash: "pending-hash", checkoutPayload: {} });
    await markCheckoutCompleted("completed-hash", { orderId: "order-3" });

    const pending = await getPendingCheckouts();
    const completed = await getCompletedCheckouts();

    expect(pending.map((entry) => entry.paymentHash)).toEqual(["pending-hash"]);
    expect(completed.map((entry) => entry.paymentHash)).toEqual(["completed-hash"]);
  });

  it("deleteCheckout removes the entry from the store", async () => {
    await savePendingCheckout({ paymentHash: "hash-to-delete", checkoutPayload: {} });

    await deleteCheckout("hash-to-delete");

    const pending = await getPendingCheckouts();
    expect(pending).toHaveLength(0);
  });

  it("registerBtcCheckoutSync resolves without throwing when Background Sync is unsupported", async () => {
    await expect(registerBtcCheckoutSync()).resolves.toBeUndefined();
  });
});
